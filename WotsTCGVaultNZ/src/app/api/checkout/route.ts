import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validations/order";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { calculateFeeBreakdown } from "@/lib/money";
import { getPaymentSettings } from "@/lib/platform-settings";
import { reserveListing, releaseReservation, ReservationError } from "@/lib/reservations";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Creates a Stripe Checkout Session for a single listing under the
 * separate-charges-and-transfers model: the buyer's charge settles on the
 * PLATFORM's own Stripe account (no `transfer_data`/`application_fee_amount`
 * here — that would be a destination charge, which transfers to the seller
 * immediately and defeats the whole point of a delayed payout). The
 * seller's share is only ever moved later, by lib/payouts.ts, once
 * delivery + the inspection period + no-dispute conditions are all met.
 *
 * Flow: validate listing -> re-price server-side (never trust a
 * client-supplied amount) -> atomically reserve inventory -> create a
 * PENDING_PAYMENT Order -> create the Stripe Checkout Session -> return the
 * redirect URL. The Order is finalized to PAID only by the
 * `checkout.session.completed` webhook — never by this response.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Add STRIPE_SECRET_KEY to enable checkout." },
      { status: 503 }
    );
  }

  const limited = rateLimit(`checkout:${session.user.id}`, 10, 5 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many checkout attempts. Please wait a moment and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // --- Server-side validation (never trust the client for any of this) ---
  const listing = await prisma.listing.findUnique({
    where: { id: data.listingId },
    include: { shippingOptions: true, seller: { include: { payoutAccount: true } } },
  });

  if (!listing || listing.status !== "ACTIVE" || listing.deletedAt) {
    return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
  }
  if (listing.soldAt) {
    return NextResponse.json({ error: "This item has already sold." }, { status: 409 });
  }
  if (listing.sellerId === session.user.id) {
    return NextResponse.json({ error: "You cannot purchase your own listing." }, { status: 400 });
  }
  if (listing.seller.status !== "ACTIVE") {
    return NextResponse.json({ error: "This seller is not currently eligible to sell." }, { status: 400 });
  }
  const available = listing.quantity - listing.reservedQuantity;
  if (data.quantity > available) {
    return NextResponse.json(
      { error: available <= 0 ? "This item is currently reserved by another buyer." : "Not enough stock available." },
      { status: 409 }
    );
  }

  const shippingOption = listing.shippingOptions.find((o) => o.id === data.shippingOptionId);
  if (!shippingOption) {
    return NextResponse.json({ error: "Select a valid shipping option." }, { status: 400 });
  }

  const payoutAccount = listing.seller.payoutAccount;
  if (!payoutAccount?.stripeConnectAccountId || !payoutAccount.payoutsEnabled) {
    return NextResponse.json(
      { error: "This seller hasn't finished payout setup yet — checkout is temporarily unavailable." },
      { status: 400 }
    );
  }

  // --- Re-price entirely from the database + admin settings, ignoring any
  // price the client might have sent (checkoutSchema doesn't even accept
  // one — see lib/validations/order.ts) ---
  const settings = await getPaymentSettings();
  const subtotalCents = listing.priceCents * data.quantity;
  const breakdown = calculateFeeBreakdown({
    subtotalCents,
    shippingCents: shippingOption.priceCents,
    platformCommissionBps: settings.platformCommissionBps,
    platformFixedFeeCents: settings.platformFixedFeeCents,
    buyerPaysFees: settings.buyerPaysFees,
    buyerFeeBps: settings.buyerFeeBps,
    reserveBps: settings.reserveBps,
  });

  // --- Reserve inventory atomically before creating any Stripe objects ---
  let reservation;
  try {
    reservation = await reserveListing({ listingId: listing.id, buyerId: session.user.id, quantity: data.quantity });
  } catch (err) {
    if (err instanceof ReservationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  try {
    const order = await prisma.order.create({
      data: {
        buyerId: session.user.id,
        status: "PENDING_PAYMENT",
        subtotalCents,
        shippingCents: shippingOption.priceCents,
        platformFeeCents: breakdown.platformCommissionCents + breakdown.platformFixedFeeCents,
        totalCents: breakdown.totalCents,
        // Populated from Stripe's own address collection once the buyer
        // completes checkout — see the checkout.session.completed webhook.
        shippingName: "",
        shippingAddress1: "",
        shippingCity: "",
        shippingPostcode: "",
        shippingMethod: shippingOption.name,
        items: {
          create: [
            {
              listingId: listing.id,
              sellerId: listing.sellerId,
              titleSnapshot: listing.title,
              priceCents: listing.priceCents,
              quantity: data.quantity,
            },
          ],
        },
      },
    });

    await prisma.listingReservation.update({ where: { id: reservation.reservation.id }, data: { orderId: order.id } });

    const idempotencyKey = randomUUID();
    const stripe = getStripe();

    const lineItems = [
      {
        price_data: {
          currency: "nzd",
          unit_amount: listing.priceCents,
          product_data: { name: listing.title },
        },
        quantity: data.quantity,
      },
      {
        price_data: {
          currency: "nzd",
          unit_amount: shippingOption.priceCents,
          product_data: { name: `Shipping — ${shippingOption.name}` },
        },
        quantity: 1,
      },
      ...(breakdown.buyerFeeCents > 0
        ? [
            {
              price_data: {
                currency: "nzd",
                unit_amount: breakdown.buyerFeeCents,
                product_data: { name: "Payment processing fee" },
              },
              quantity: 1,
            },
          ]
        : []),
    ];

    // No transfer_data / application_fee_amount here on purpose — see the
    // module docblock. This is a plain charge to the platform's own
    // account.
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: session.user.email ?? undefined,
        shipping_address_collection: { allowed_countries: ["NZ"] },
        line_items: lineItems,
        // Stripe requires Checkout Session expiry to be at least 30 minutes
        // out; clamp in case an admin sets a shorter reservation TTL.
        expires_at: Math.max(
          Math.floor(Date.now() / 1000) + 30 * 60,
          Math.floor(reservation.expiresAt.getTime() / 1000)
        ),
        payment_intent_data: {
          transfer_group: order.id,
          metadata: { orderId: order.id },
        },
        metadata: { orderId: order.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/buyer?orderId=${order.id}&status=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/listing/${listing.slug}?checkout=cancelled`,
      },
      { idempotencyKey }
    );

    await prisma.payment.create({
      data: {
        orderId: order.id,
        amountCents: breakdown.totalCents,
        status: "CREATED",
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: (checkoutSession.payment_intent as string | null) ?? undefined,
        idempotencyKey,
      },
    });

    // Keep the reservation's expiry in lockstep with the Checkout Session's
    // actual expiry (Stripe may have clamped it to its own 30-min minimum
    // above), so the cleanup sweep never releases inventory out from under
    // a still-valid, in-progress Stripe session.
    if (checkoutSession.expires_at) {
      await prisma.listingReservation.update({
        where: { id: reservation.reservation.id },
        data: { expiresAt: new Date(checkoutSession.expires_at * 1000) },
      });
    }

    return NextResponse.json({ url: checkoutSession.url, breakdown });
  } catch (err) {
    // Any failure past this point must release the reservation, or a
    // failed checkout would permanently lock the listing.
    await releaseReservation(reservation.reservation.id).catch(() => null);
    throw err;
  }
}

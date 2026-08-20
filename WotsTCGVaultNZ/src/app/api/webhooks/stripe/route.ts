import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { claimWebhookEvent, markWebhookEventProcessed, markWebhookEventFailed } from "@/lib/webhook-events";
import { consumeReservation, releaseReservation } from "@/lib/reservations";
import { syncPayoutAccountFromStripe } from "@/lib/connect-account";
import { holdPayoutsForOrder, releasePayoutHoldForOrder } from "@/lib/payouts";
import { notifyUser, notifyAdmins } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

/**
 * Stripe webhooks are the ONLY source of truth for payment/payout/dispute
 * state — the client-side checkout redirect is never trusted. Signature
 * verification requires the raw request body, so this route must not call
 * req.json(). Idempotency is enforced at the top via `claimWebhookEvent`
 * (unique constraint on the Stripe event id), before any business logic
 * runs, so a duplicate delivery — which Stripe explicitly says can happen
 * and your handler must tolerate — is a guaranteed no-op.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  const claim = await claimWebhookEvent(event);
  if (claim.alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case "charge.dispute.updated":
        await handleChargeDisputeUpdated(event.data.object as Stripe.Dispute);
        break;
      case "charge.dispute.closed":
        await handleChargeDisputeClosed(event.data.object as Stripe.Dispute);
        break;
      case "account.updated":
        await syncPayoutAccountFromStripe(event.data.object as Stripe.Account);
        break;
      case "transfer.created":
      case "transfer.reversed":
        await handleTransferEvent(event.type, event.data.object as Stripe.Transfer);
        break;
      case "payout.created":
      case "payout.paid":
      case "payout.failed":
        // Connected-account-level Payout objects (Connect balance -> the
        // seller's bank). These only reach this endpoint if Connect event
        // listening is explicitly enabled on the webhook endpoint — see
        // docs/PAYMENTS.md "Stripe limitations". We record them for
        // visibility but they don't drive any of our own state machine,
        // since our Payout model tracks the platform->seller Transfer,
        // not the seller's own bank payout schedule.
        await logAudit({ actorId: null, action: `stripe.${event.type}`, targetType: "StripeEvent", targetId: event.id });
        break;
      default:
        break;
    }

    await markWebhookEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries with backoff — do NOT mark PROCESSED.
    const message = err instanceof Error ? err.message : "Unknown error";
    await markWebhookEventFailed(event.id, message);
    await notifyAdmins({
      title: "Stripe webhook processing failed",
      body: `Event ${event.id} (${event.type}) failed: ${message}`,
    }).catch(() => null);
    return NextResponse.json({ error: "Webhook handler failed, will retry." }, { status: 500 });
  }
}

async function handleCheckoutCompleted(checkoutSession: Stripe.Checkout.Session) {
  const orderId = checkoutSession.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } });
  if (!order || !order.payment) return;
  // Idempotent even without the event-id guard: a second delivery of this
  // same event type for an order already past PENDING_PAYMENT is a no-op.
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_PROCESSING") return;

  const isPaid = checkoutSession.payment_status === "paid";
  const shippingDetails = checkoutSession.shipping_details;
  const address = shippingDetails?.address ?? checkoutSession.customer_details?.address;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: isPaid ? "AWAITING_SHIPMENT" : "PAYMENT_PROCESSING",
      paidAt: isPaid ? new Date() : undefined,
      shippingName: shippingDetails?.name ?? checkoutSession.customer_details?.name ?? "",
      shippingAddress1: address?.line1 ?? "",
      shippingAddress2: address?.line2 ?? undefined,
      shippingSuburb: address?.state ?? undefined,
      shippingCity: address?.city ?? "",
      shippingPostcode: address?.postal_code ?? "",
    },
  });

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: isPaid ? "SUCCEEDED" : "REQUIRES_ACTION",
      stripePaymentIntentId: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : undefined,
    },
  });

  if (isPaid) {
    await consumeReservation(orderId);
    await prisma.shippingRecord.upsert({
      where: { orderId },
      update: {},
      create: { orderId, status: "AWAITING_TRACKING" },
    });

    const [buyer, seller] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.buyerId } }),
      prisma.user.findUnique({ where: { id: order.items[0]?.sellerId } }),
    ]);
    if (buyer) {
      await notifyUser({
        userId: buyer.id,
        type: "ORDER_UPDATE",
        title: "Payment successful",
        body: `Your payment for order #${order.id.slice(-8)} was successful. The seller has been notified to ship your item.`,
        link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/buyer`,
        email: { to: buyer.email, name: buyer.fullName },
      });
    }
    if (seller) {
      await notifyUser({
        userId: seller.id,
        type: "ORDER_UPDATE",
        title: "You have a new order to ship",
        body: `Order #${order.id.slice(-8)} has been paid. Please ship the item and upload tracking information.`,
        link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
        email: { to: seller.email, name: seller.fullName },
      });
    }
  }
}

async function handleCheckoutExpired(checkoutSession: Stripe.Checkout.Session) {
  const orderId = checkoutSession.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { reservation: true } });
  if (!order || order.status !== "PENDING_PAYMENT") return;

  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  await prisma.payment.update({ where: { orderId }, data: { status: "CANCELLED" } }).catch(() => null);
  if (order.reservation) await releaseReservation(order.reservation.id);
}

async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: intent.id } });
  if (!payment) return;

  const chargeId =
    typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED", stripeChargeId: chargeId ?? undefined },
  });
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: intent.id }, include: { order: true } });
  if (!payment) return;

  // Deliberately NOT cancelling the order/releasing the reservation here —
  // the buyer can still retry payment within the same still-open Checkout
  // Session. Only an explicit cancellation/expiry frees the reservation.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", failureReason: intent.last_payment_error?.message },
  });

  const buyer = await prisma.user.findUnique({ where: { id: payment.order.buyerId } });
  if (buyer) {
    await notifyUser({
      userId: buyer.id,
      type: "ORDER_UPDATE",
      title: "Payment failed",
      body: `Your payment for order #${payment.orderId.slice(-8)} did not go through${intent.last_payment_error?.message ? `: ${intent.last_payment_error.message}` : "."} You can try again from the listing page.`,
      email: { to: buyer.email, name: buyer.fullName },
    });
  }
}

async function handlePaymentIntentCanceled(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: intent.id }, include: { order: { include: { reservation: true } } } });
  if (!payment) return;
  if (payment.order.status !== "PENDING_PAYMENT") return;

  await prisma.order.update({ where: { id: payment.orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  if (payment.order.reservation) await releaseReservation(payment.order.reservation.id);
}

/**
 * Reconciles refunds issued directly from the Stripe Dashboard (i.e. NOT
 * through our own /api/admin/refunds -> lib/refunds.ts path, which already
 * records a Refund row synchronously). If we don't already have a Refund
 * row for this charge/amount, we create one now so the audit trail stays
 * complete regardless of where the refund was initiated.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const payment = await prisma.payment.findFirst({ where: { stripeChargeId: charge.id } });
  if (!payment) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
      refundedAmountCents: charge.amount_refunded,
    },
  });

  const existingTotal = await prisma.refund.aggregate({
    where: { orderId: payment.orderId, status: "PROCESSED" },
    _sum: { amountCents: true },
  });
  const unrecorded = charge.amount_refunded - (existingTotal._sum.amountCents ?? 0);

  if (unrecorded > 0) {
    await prisma.refund.create({
      data: {
        orderId: payment.orderId,
        amountCents: unrecorded,
        reason: "Refund issued directly via Stripe (reconciled from webhook)",
        type: isFullRefund ? "FULL" : "PARTIAL",
        status: "PROCESSED",
        isPartial: !isFullRefund,
        processedBy: null,
      },
    });
  }

  await prisma.order.update({
    where: { id: payment.orderId },
    data: { status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" },
  });
}

async function handleChargeDisputeCreated(stripeDispute: Stripe.Dispute) {
  const chargeId = typeof stripeDispute.charge === "string" ? stripeDispute.charge : stripeDispute.charge.id;
  const payment = await prisma.payment.findFirst({ where: { stripeChargeId: chargeId }, include: { order: { include: { items: true } } } });
  if (!payment) return;

  const existing = await prisma.dispute.findUnique({ where: { orderId: payment.orderId } });
  if (existing) {
    await prisma.dispute.update({
      where: { id: existing.id },
      data: { stripeDisputeId: stripeDispute.id, status: "UNDER_REVIEW", payoutOnHold: true },
    });
  } else {
    await prisma.dispute.create({
      data: {
        orderId: payment.orderId,
        filedById: payment.order.buyerId,
        source: "STRIPE_CHARGEBACK",
        reason: stripeDispute.reason,
        description: `Stripe chargeback — reason: ${stripeDispute.reason}`,
        status: "UNDER_REVIEW",
        stripeDisputeId: stripeDispute.id,
        evidenceDueBy: stripeDispute.evidence_details?.due_by
          ? new Date(stripeDispute.evidence_details.due_by * 1000)
          : undefined,
        payoutOnHold: true,
      },
    });
  }

  await prisma.order.update({ where: { id: payment.orderId }, data: { status: "DISPUTED" } });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "DISPUTED" } });

  await holdPayoutsForOrder(payment.orderId);

  const seller = await prisma.user.findUnique({ where: { id: payment.order.items[0]?.sellerId } });
  if (seller) {
    await notifyUser({
      userId: seller.id,
      type: "DISPUTE",
      title: "A chargeback was filed against your sale",
      body: `Stripe reports a chargeback on order #${payment.orderId.slice(-8)} (${stripeDispute.reason}). Your payout for this order is on hold. Please provide evidence via the admin/support team before the deadline.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
      email: { to: seller.email, name: seller.fullName },
    });
  }
  await notifyAdmins({
    title: "Stripe chargeback opened",
    body: `Order #${payment.orderId.slice(-8)}: ${stripeDispute.reason}`,
    link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/disputes`,
  });
}

async function handleChargeDisputeUpdated(stripeDispute: Stripe.Dispute) {
  await prisma.dispute.updateMany({
    where: { stripeDisputeId: stripeDispute.id },
    data: {
      evidenceDueBy: stripeDispute.evidence_details?.due_by
        ? new Date(stripeDispute.evidence_details.due_by * 1000)
        : undefined,
    },
  });
}

async function handleChargeDisputeClosed(stripeDispute: Stripe.Dispute) {
  const dispute = await prisma.dispute.findFirst({ where: { stripeDisputeId: stripeDispute.id }, include: { order: { include: { items: true } } } });
  if (!dispute) return;

  // Stripe's dispute.status on close is "won" (we keep the funds) or "lost"
  // (Stripe already debited us — funds are gone regardless of what our
  // order status says, so we record it and flag admin review rather than
  // attempting another refund on money Stripe already took).
  const won = stripeDispute.status === "won";

  await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: won ? "RESOLVED_SELLER" : "RESOLVED_BUYER",
      payoutOnHold: !won,
      resolvedAt: new Date(),
      resolutionNotes: `Stripe chargeback closed: ${stripeDispute.status}.`,
    },
  });

  if (won) {
    await prisma.order.update({ where: { id: dispute.orderId }, data: { status: "PAYOUT_ELIGIBLE" } });
    await releasePayoutHoldForOrder(dispute.orderId);
  } else {
    await prisma.order.update({
      where: { id: dispute.orderId },
      data: { status: "ADMIN_REVIEW", adminReviewNote: "Chargeback lost — funds already debited by Stripe. Seller payout must stay withheld; review for recovery if already paid out." },
    });
  }

  const seller = await prisma.user.findUnique({ where: { id: dispute.order.items[0]?.sellerId } });
  if (seller) {
    await notifyUser({
      userId: seller.id,
      type: "DISPUTE",
      title: `Chargeback ${won ? "won" : "lost"}`,
      body: `The Stripe chargeback on order #${dispute.orderId.slice(-8)} was ${won ? "resolved in your favour — your payout will proceed." : "lost. Please contact support."}`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
      email: { to: seller.email, name: seller.fullName },
    });
  }
}

async function handleTransferEvent(type: string, transfer: Stripe.Transfer) {
  await logAudit({
    actorId: null,
    action: `stripe.${type}`,
    targetType: "Transfer",
    targetId: transfer.id,
    metadata: {
      amount: transfer.amount,
      destination: typeof transfer.destination === "string" ? transfer.destination : (transfer.destination?.id ?? null),
    },
  });

  if (type === "transfer.reversed") {
    await prisma.transfer.updateMany({
      where: { stripeTransferId: transfer.id },
      data: { status: transfer.amount_reversed >= transfer.amount ? "REVERSED" : "PARTIALLY_REVERSED", reversedCents: transfer.amount_reversed },
    });
  }
}

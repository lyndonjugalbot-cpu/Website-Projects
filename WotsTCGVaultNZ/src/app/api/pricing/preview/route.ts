import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateFeeBreakdown } from "@/lib/money";
import { getPaymentSettings } from "@/lib/platform-settings";

/**
 * Public, read-only fee-breakdown preview shown to the buyer before they
 * click "Buy Now" — uses the exact same calculateFeeBreakdown() the real
 * checkout route uses, so what's previewed always matches what's charged.
 * No Stripe objects are created here.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  const shippingOptionId = searchParams.get("shippingOptionId");
  const quantity = Number(searchParams.get("quantity") ?? "1");

  if (!listingId || !shippingOptionId || !Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Missing or invalid parameters." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { shippingOptions: true },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const shippingOption = listing.shippingOptions.find((o) => o.id === shippingOptionId);
  if (!shippingOption) return NextResponse.json({ error: "Invalid shipping option." }, { status: 400 });

  const settings = await getPaymentSettings();
  const breakdown = calculateFeeBreakdown({
    subtotalCents: listing.priceCents * quantity,
    shippingCents: shippingOption.priceCents,
    platformCommissionBps: settings.platformCommissionBps,
    platformFixedFeeCents: settings.platformFixedFeeCents,
    buyerPaysFees: settings.buyerPaysFees,
    buyerFeeBps: settings.buyerFeeBps,
    reserveBps: settings.reserveBps,
  });

  return NextResponse.json({
    subtotalCents: breakdown.subtotalCents,
    shippingCents: breakdown.shippingCents,
    buyerFeeCents: breakdown.buyerFeeCents,
    totalCents: breakdown.totalCents,
  });
}

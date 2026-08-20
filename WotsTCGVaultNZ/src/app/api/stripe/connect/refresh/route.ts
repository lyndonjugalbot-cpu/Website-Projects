import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";

/**
 * Generates a fresh onboarding AccountLink for a seller whose previous
 * link expired (Stripe AccountLinks are single-use and short-lived) —
 * this is what STRIPE_CONNECT_REFRESH_URL should point the browser back
 * into calling. Requires a connected account to already exist; if a
 * seller lands here without ever starting onboarding, send them through
 * /api/stripe/connect/onboard instead.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Payouts are not configured yet." }, { status: 503 });
  }

  const payoutAccount = await prisma.sellerPayoutAccount.findUnique({ where: { userId: session.user.id } });
  if (!payoutAccount?.stripeConnectAccountId) {
    return NextResponse.json({ error: "No payout account found. Start onboarding first." }, { status: 404 });
  }

  const stripe = getStripe();
  const accountLink = await stripe.accountLinks.create({
    account: payoutAccount.stripeConnectAccountId,
    refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL!,
    return_url: process.env.STRIPE_CONNECT_RETURN_URL!,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}

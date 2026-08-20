import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { sellerEligibility } from "@/lib/rbac";

/**
 * Creates (if needed) a Stripe Connect EXPRESS account for the current
 * seller and returns a fresh onboarding AccountLink. Express is used
 * rather than Standard/Custom because it gives Stripe-hosted KYC/banking
 * collection with the least platform liability — appropriate for a
 * marketplace of individual sellers rather than large merchants.
 *
 * payoutsEnabled stays false until Stripe reports it via `account.updated`
 * (see lib/connect-account.ts) — this route never flips it on itself.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Payouts are not configured yet. Add STRIPE_SECRET_KEY to enable seller payouts." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const eligibility = sellerEligibility(user);
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: "Complete email, Facebook and ID verification before connecting payouts.", eligibility },
      { status: 403 }
    );
  }

  const stripe = getStripe();
  let payoutAccount = await prisma.sellerPayoutAccount.findUnique({ where: { userId: user.id } });

  if (!payoutAccount?.stripeConnectAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "NZ",
      email: user.email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      business_type: "individual",
      metadata: { userId: user.id },
    });
    payoutAccount = await prisma.sellerPayoutAccount.upsert({
      where: { userId: user.id },
      update: { stripeConnectAccountId: account.id, status: "ONBOARDING_INCOMPLETE" },
      create: { userId: user.id, stripeConnectAccountId: account.id, status: "ONBOARDING_INCOMPLETE" },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: payoutAccount.stripeConnectAccountId!,
    refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL!,
    return_url: process.env.STRIPE_CONNECT_RETURN_URL!,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}

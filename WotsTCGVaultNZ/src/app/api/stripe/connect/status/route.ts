import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { syncPayoutAccountFromStripe } from "@/lib/connect-account";

/**
 * Returns the seller's payout-account status. Pass ?refresh=1 to force a
 * live re-fetch from Stripe first (used right after the buyer returns
 * from onboarding — the account.updated webhook is usually near-instant
 * but not guaranteed to have landed yet when the browser redirects back).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payoutAccount = await prisma.sellerPayoutAccount.findUnique({ where: { userId: session.user.id } });
  if (!payoutAccount) {
    return NextResponse.json({
      status: "NOT_STARTED",
      chargesEnabled: false,
      payoutsEnabled: false,
      requirementsCurrentlyDue: [],
      requirementsPastDue: [],
    });
  }

  const shouldRefresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (shouldRefresh && stripeConfigured() && payoutAccount.stripeConnectAccountId) {
    const account = await getStripe().accounts.retrieve(payoutAccount.stripeConnectAccountId);
    await syncPayoutAccountFromStripe(account);
  }

  const fresh = await prisma.sellerPayoutAccount.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(fresh);
}

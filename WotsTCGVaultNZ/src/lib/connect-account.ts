import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { PAYOUT_ACCOUNT_STATUS_LABELS } from "@/lib/constants";
import type { PayoutAccountStatus } from "@prisma/client";

/**
 * Maps Stripe's own Connect Express account fields onto the simple status
 * enum sellers/admins actually read. Stripe doesn't expose a single
 * "status" field — this derivation follows Stripe's documented guidance
 * for interpreting `requirements` + `charges_enabled` + `payouts_enabled`.
 */
export function deriveAccountStatus(account: Stripe.Account): {
  status: PayoutAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
} {
  const req = account.requirements;
  const currentlyDue = req?.currently_due ?? [];
  const pastDue = req?.past_due ?? [];
  const disabledReason = req?.disabled_reason ?? null;

  let status: PayoutAccountStatus;
  if (!account.details_submitted) {
    status = "NOT_STARTED";
  } else if (disabledReason && disabledReason.startsWith("rejected")) {
    status = "DISABLED";
  } else if (disabledReason || pastDue.length > 0) {
    status = "RESTRICTED";
  } else if (!account.charges_enabled || !account.payouts_enabled) {
    // Details submitted but Stripe is still verifying, or there's more
    // (non-blocking) info needed before payouts turn on.
    status = currentlyDue.length > 0 ? "ONBOARDING_INCOMPLETE" : "VERIFICATION_PENDING";
  } else {
    status = "ENABLED";
  }

  return {
    status,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    currentlyDue,
    pastDue,
    disabledReason,
  };
}

/** Persists the latest Stripe account state and notifies the seller on meaningful transitions. */
export async function syncPayoutAccountFromStripe(account: Stripe.Account) {
  const existing = await prisma.sellerPayoutAccount.findUnique({ where: { stripeConnectAccountId: account.id } });
  if (!existing) return;

  const derived = deriveAccountStatus(account);
  const previousStatus = existing.status;

  await prisma.sellerPayoutAccount.update({
    where: { userId: existing.userId },
    data: {
      status: derived.status,
      chargesEnabled: derived.chargesEnabled,
      payoutsEnabled: derived.payoutsEnabled,
      detailsSubmitted: derived.detailsSubmitted,
      requirementsCurrentlyDue: derived.currentlyDue,
      requirementsPastDue: derived.pastDue,
      disabledReason: derived.disabledReason,
    },
  });

  if (previousStatus !== derived.status) {
    const seller = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (seller && (derived.status === "ENABLED" || derived.status === "RESTRICTED" || derived.status === "DISABLED")) {
      const messages: Record<string, string> = {
        ENABLED: "Your seller payout account is fully verified. You're now eligible to receive payouts.",
        RESTRICTED: "Stripe needs more information from you before payouts can continue. Please check your seller dashboard.",
        DISABLED: "Your seller payout account has been disabled by Stripe. Contact support for details.",
      };
      await notifyUser({
        userId: seller.id,
        type: "STRIPE_ACCOUNT",
        title: `Payout account ${PAYOUT_ACCOUNT_STATUS_LABELS[derived.status].toLowerCase()}`,
        body: messages[derived.status] ?? "Your payout account status has changed.",
        link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/seller`,
        email: { to: seller.email, name: seller.fullName },
      });
    }
  }
}

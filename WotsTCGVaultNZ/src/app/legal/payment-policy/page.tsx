import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Payment Policy" };

export default function PaymentPolicyPage() {
  return (
    <LegalLayout title="Payment Policy" updated="20 August 2026">
      <div className="rounded-md border border-gold/20 bg-gold/5 p-4 text-sm">
        Payments are processed by Stripe. {SITE_NAME} operates a platform-managed payment and
        payout process. Seller payout eligibility generally occurs after confirmed delivery and
        the applicable buyer inspection period, provided that no dispute, refund, fraud review,
        chargeback, or account restriction is active. Payout timing is subject to Stripe processing
        times, seller verification, banking schedules, reserves, and applicable laws.
      </div>

      <h2>How payment works</h2>
      <p>
        When you buy an item, your payment is processed by Stripe and settles on the marketplace&apos;s
        own Stripe account. We do not receive or store your card number, CVV, or full bank account
        details — Stripe handles that directly.
      </p>

      <h2>What &quot;platform-managed payment&quot; means</h2>
      <p>
        We use the term <em>platform-managed payment</em> rather than &quot;escrow&quot; because
        {` ${SITE_NAME}`} is not a licensed escrow provider or financial institution. Funds from
        your payment are processed by Stripe under Stripe&apos;s own marketplace terms. The seller&apos;s
        share is only transferred to them by us once the conditions in our Fees &amp; Payout Policy
        are met — this is an internal payout-timing decision we control via Stripe Connect, not a
        regulated custody arrangement.
      </p>

      <h2>Marketplace payment methods</h2>
      <p>Card payments are accepted via Stripe Checkout. Additional payment methods may be added over time.</p>

      <h2>Buyer-paid fees</h2>
      <p>
        Any payment processing surcharge charged to buyers (if enabled) is shown in full at
        checkout before you pay — see the price breakdown on the checkout page.
      </p>

      <h2>Security</h2>
      <p>
        All payment pages are served over HTTPS. Card data is entered directly into Stripe&apos;s
        hosted checkout, never into our own servers.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

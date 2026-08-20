import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = { title: "Fees & Payout Policy" };

export default function FeesAndPayoutsPage() {
  return (
    <LegalLayout title="Fees & Payout Policy" updated="20 August 2026">
      <h2>What sellers are charged</h2>
      <ul>
        <li>A platform commission, calculated as a percentage of the item&apos;s sale price (shown in your seller dashboard and on each listing&apos;s payout breakdown).</li>
        <li>A fixed per-order platform fee, if configured.</li>
        <li>A rolling reserve withheld from each payout, released back over time, to cover potential refunds or chargebacks.</li>
      </ul>
      <p>Current rates are configurable and always shown to you before you complete a sale.</p>

      <h2>When sellers get paid</h2>
      <p>Delayed seller payout — a seller becomes eligible for payout once ALL of the following are true:</p>
      <ul>
        <li>Payment has been confirmed by Stripe.</li>
        <li>The item has been marked shipped with tracking information (where required).</li>
        <li>Delivery has been confirmed (by tracking, buyer confirmation, or admin review).</li>
        <li>The buyer protection period has elapsed with no dispute opened.</li>
        <li>The seller&apos;s Stripe Connect account is verified and eligible to receive payouts.</li>
        <li>No refund, fraud review, or chargeback is in progress on the order.</li>
      </ul>
      <p>
        Once eligible, payouts are typically released within 24–48 hours, subject to Stripe
        processing times, seller account verification, banking schedules, reserves, weekends, and
        public holidays. Some payouts may require manual admin approval (for example, unusually
        large amounts) before release.
      </p>

      <h2>Payout account requirements</h2>
      <p>
        Sellers must complete Stripe Connect onboarding, including identity verification required
        by Stripe, before they are eligible to receive any payout. See your seller dashboard for
        your current onboarding status.
      </p>

      <h2>Refunds after payout</h2>
      <p>
        If a refund is approved after a payout has already been released, we will attempt to
        recover the seller&apos;s share by reversing the relevant transfer on their connected
        account. If that is not possible (for example, insufficient balance), the matter is
        referred to manual admin review and the seller may be asked to repay the amount by other
        means.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

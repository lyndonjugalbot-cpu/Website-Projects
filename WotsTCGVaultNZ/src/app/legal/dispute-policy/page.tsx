import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = { title: "Dispute Policy" };

export default function DisputePolicyPage() {
  return (
    <LegalLayout title="Dispute Policy" updated="20 August 2026">
      <h2>Opening a dispute</h2>
      <p>
        A buyer may open a dispute during the buyer protection period from their order page,
        selecting a reason (not as described, suspected counterfeit, damaged, missing/incorrect
        item, not received, or other) and providing details and, where relevant, photo evidence.
      </p>

      <h2>What happens next</h2>
      <ol>
        <li>The seller&apos;s payout for that order is placed on hold immediately.</li>
        <li>The seller is notified and asked to respond within 3 days, with their own evidence if relevant.</li>
        <li>Our team reviews all evidence from both parties.</li>
        <li>We issue a resolution: in the buyer&apos;s favour (full or partial refund), in the seller&apos;s favour (payout proceeds), or closed with no action.</li>
      </ol>

      <h2>Stripe chargebacks</h2>
      <p>
        If a buyer disputes a charge directly with their bank (a chargeback) rather than through
        our in-app process, Stripe notifies us and the same payout hold applies automatically
        while the chargeback is contested. Chargeback outcomes are ultimately decided by the
        card network and Stripe, not by {`Wots TCG Vault NZ`}.
      </p>

      <h2>Evidence</h2>
      <p>
        Keep proof of shipment, condition photos taken before shipping, and any relevant
        correspondence — this significantly improves the speed and accuracy of dispute review for
        both buyers and sellers.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

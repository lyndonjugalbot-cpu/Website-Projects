import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = { title: "Buyer Protection Policy" };

export default function BuyerProtectionPage() {
  return (
    <LegalLayout title="Buyer Protection Policy" updated="20 August 2026">
      <h2>The buyer protection period</h2>
      <p>
        After an order is marked delivered, you get a buyer protection (inspection) period —
        48 hours by default, shown on your order — to check the item and raise any issue before
        the seller becomes eligible for payout.
      </p>

      <h2>During the inspection period you can</h2>
      <ul>
        <li>Confirm the item is as described and acceptable.</li>
        <li>Report that the item is not as described.</li>
        <li>Report suspected counterfeit goods.</li>
        <li>Report damage.</li>
        <li>Report missing or incorrect items.</li>
        <li>Request a full or partial refund, with supporting evidence.</li>
      </ul>
      <p>
        If no dispute is opened before the inspection period ends, the order is treated as
        accepted and the seller becomes eligible for payout.
      </p>

      <h2>What isn&apos;t covered</h2>
      <ul>
        <li>Buyer&apos;s remorse after the inspection period has ended.</li>
        <li>Damage caused after delivery.</li>
        <li>Items correctly described but not to the buyer&apos;s subjective taste.</li>
      </ul>

      <h2>Authenticity</h2>
      <p>
        {`Wots TCG Vault NZ`} does not independently authenticate items unless graded by an
        official third-party grading company. See our Authenticity Policy.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

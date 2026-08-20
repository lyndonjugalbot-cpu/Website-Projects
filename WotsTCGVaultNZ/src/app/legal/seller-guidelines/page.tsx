import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = { title: "Seller Guidelines" };

export default function SellerGuidelinesPage() {
  return (
    <LegalLayout title="Seller Guidelines" updated="19 August 2026">
      <h2>Before you sell</h2>
      <p>
        You&apos;ll need a verified email address, a connected Facebook account, an approved
        government ID verification, and to accept these Seller Guidelines. See your dashboard for
        the step-by-step checklist.
      </p>

      <h2>Listing quality</h2>
      <ul>
        <li>Use clear, well-lit, in-focus photos — front and back at minimum, plus sides for graded slabs.</li>
        <li>Honestly disclose all condition defects: whitening, scratches, dents, creases, print lines, edge wear, bends, water damage.</li>
        <li>Write accurate titles including set name and card number where applicable.</li>
        <li>Price fairly and update your listing promptly if it sells elsewhere.</li>
      </ul>

      <h2>Fulfilling orders</h2>
      <ul>
        <li>Ship within 2 business days of payment confirmation unless your listing states otherwise.</li>
        <li>Always use tracked shipping and upload the tracking number promptly.</li>
        <li>Package cards securely — a top loader plus rigid mailer for raw cards, and adequate padding for slabs.</li>
      </ul>

      <h2>Communication</h2>
      <p>
        Respond to buyer messages promptly and professionally. Never ask buyers to pay outside the
        Platform — this violates our Terms and voids seller protection for that order.
      </p>

      <h2>Payouts</h2>
      <p>
        Payouts are released after the buyer confirms delivery, or automatically after the
        confirmation window closes. A small rolling reserve may be withheld to cover potential
        refunds or disputes. See the Payment & Payout section of your seller dashboard for details.
      </p>
    </LegalLayout>
  );
}

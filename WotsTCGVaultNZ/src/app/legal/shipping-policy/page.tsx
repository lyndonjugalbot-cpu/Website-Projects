import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = { title: "Shipping Policy" };

export default function ShippingPolicyPage() {
  return (
    <LegalLayout title="Shipping Policy" updated="20 August 2026">
      <h2>Seller responsibilities</h2>
      <ul>
        <li>Ship within the timeframe stated on the listing (default: 2 business days after payment).</li>
        <li>Use tracked shipping and select the carrier used.</li>
        <li>Upload the tracking number promptly — the buyer is notified automatically.</li>
        <li>Package items securely, appropriate to their value and fragility.</li>
      </ul>

      <h2>Local pickup</h2>
      <p>
        Where a listing offers local pickup, arrangements are coordinated directly between buyer
        and seller via in-app messaging.
      </p>

      <h2>Delivery confirmation</h2>
      <p>
        Delivery can be confirmed by carrier tracking, by the buyer marking the item received, or
        by admin review. Confirmed delivery starts the buyer protection period — see our Buyer
        Protection Policy.
      </p>

      <h2>Lost or delayed shipments</h2>
      <p>
        If tracking shows no movement or delivery confirmation for an extended period, the order
        is flagged for admin review rather than automatically completed — see our Fees &amp;
        Payout Policy for how this affects payout timing.
      </p>

      <h2>Shipping insurance</h2>
      <p>
        Some shipping options include carrier insurance, shown at checkout. Sellers are encouraged
        to insure higher-value items.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

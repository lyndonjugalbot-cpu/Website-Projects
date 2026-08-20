import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" updated="19 August 2026">
      <h2>Buyer protection</h2>
      <p>
        If an item doesn&apos;t arrive, arrives significantly not as described, or arrives damaged
        in transit, you may open a dispute from your buyer dashboard within 14 days of the
        estimated delivery date.
      </p>

      <h2>Order cancellations</h2>
      <ul>
        <li>Orders can be cancelled by the buyer before the seller marks the item as shipped.</li>
        <li>Once shipped, cancellation is not available — use the dispute process if there is a problem.</li>
        <li>Sellers may cancel an order only in exceptional circumstances (e.g. item damaged before shipping), subject to review.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        Approved refunds are issued to the original payment method via our payment provider.
        Refunds may be full or partial depending on the outcome of a dispute review. Processing
        typically takes 5–10 business days depending on your bank.
      </p>

      <h2>Chargebacks</h2>
      <p>
        Please contact us before initiating a chargeback with your bank — most issues can be
        resolved faster through our dispute process. Chargebacks may result in account review.
      </p>

      <h2>Seller protection</h2>
      <p>
        Sellers who ship on time with tracking and accurately describe their items are protected
        against unfounded claims. Our team reviews evidence from both parties before making a
        refund decision.
      </p>

      <p className="text-xs text-muted-2 pt-4 border-t border-white/10">
        <strong>Placeholder notice:</strong> refund timeframes and consumer rights obligations
        under the Consumer Guarantees Act 1993 and Fair Trading Act 1986 should be reviewed by a
        qualified NZ lawyer before launch.
      </p>
    </LegalLayout>
  );
}

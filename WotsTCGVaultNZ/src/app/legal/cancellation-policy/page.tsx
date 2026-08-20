import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { LegalDraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = { title: "Cancellation Policy" };

export default function CancellationPolicyPage() {
  return (
    <LegalLayout title="Cancellation Policy" updated="20 August 2026">
      <h2>Before shipment</h2>
      <p>
        A buyer may request cancellation any time before the seller marks the order shipped. We
        may approve a full refund if the seller has not shipped, the order is not in dispute, the
        payment is refundable, and no fraud or abuse indicators exist.
      </p>

      <h2>After shipment</h2>
      <p>
        Cancellation is generally not available once an order has shipped. If there is a problem
        with the item you receive, open a dispute during the buyer protection period instead — see
        our Buyer Protection Policy.
      </p>

      <h2>Seller-initiated cancellation</h2>
      <p>
        Sellers may only cancel an order in exceptional circumstances (for example, the item was
        damaged or lost before shipping), and such cancellations are subject to admin review.
      </p>

      <LegalDraftNotice />
    </LegalLayout>
  );
}

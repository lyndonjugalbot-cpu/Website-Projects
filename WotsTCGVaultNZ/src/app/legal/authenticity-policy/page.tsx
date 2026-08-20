import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Authenticity Policy" };

export default function AuthenticityPolicyPage() {
  return (
    <LegalLayout title="Authenticity Policy" updated="19 August 2026">
      <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-warning text-sm">
        {SITE_NAME} does not independently authenticate items listed for sale unless that item has
        gone through an official third-party grading or authentication service (e.g. PSA, BGS, CGC,
        ACE). Buyers should carefully review listing photos and seller history before purchasing.
      </div>

      <h2>Seller declarations</h2>
      <p>
        Every listing requires the seller to declare that the item is authentic and accurately
        described. False declarations are a serious violation of our Terms and may result in
        account suspension, listing removal, and reporting to relevant authorities where
        appropriate.
      </p>

      <h2>Graded items</h2>
      <p>
        For graded slabs, sellers must provide the grading company, grade, and (if available)
        certification number, along with clear photos of the slab. We recommend buyers
        independently verify certification numbers via the grading company&apos;s public lookup
        tool before purchase.
      </p>

      <h2>Raw / ungraded cards</h2>
      <p>
        For raw cards, authenticity relies on seller disclosure and listing photos. If you receive
        an item you believe is counterfeit, open a dispute immediately and do not use or damage the
        item, as this may affect the outcome of your claim.
      </p>

      <h2>Reporting suspected counterfeits</h2>
      <p>
        Use the &ldquo;Report listing&rdquo; button, selecting &ldquo;Suspected counterfeit
        item&rdquo;. Provide as much detail as possible — our trust & safety team investigates all
        counterfeit reports.
      </p>
    </LegalLayout>
  );
}

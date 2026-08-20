import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = { title: "Prohibited Items Policy" };

export default function ProhibitedItemsPage() {
  return (
    <LegalLayout title="Prohibited Items Policy" updated="19 August 2026">
      <p>The following items may not be listed for sale on the Platform:</p>
      <ul>
        <li>Known counterfeit, proxy, or reproduction cards not clearly and prominently labelled as such.</li>
        <li>Items obtained through theft or fraud.</li>
        <li>Altered or doctored cards (trimmed, re-coloured, sanded) not disclosed as altered.</li>
        <li>Grading company slabs with tampered or forged labels/certification numbers.</li>
        <li>Items unrelated to trading card games and collectibles.</li>
        <li>Weapons, illegal substances, or any other item unrelated to the marketplace&apos;s purpose.</li>
        <li>Digital-only items, codes, or unofficial promotional material misrepresented as physical product.</li>
      </ul>
      <h2>Reporting</h2>
      <p>
        If you believe a listing violates this policy, use the &ldquo;Report listing&rdquo; button
        on the listing page. Our moderation team reviews all reports.
      </p>
      <h2>Consequences</h2>
      <p>
        Listings that violate this policy will be removed. Repeated or serious violations
        (particularly counterfeit sales) may result in account suspension or a permanent ban.
      </p>
    </LegalLayout>
  );
}

import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function CommunityGuidelinesPage() {
  return (
    <LegalLayout title="Community Guidelines" updated="19 August 2026">
      <p>
        Wots TCG Vault NZ is built on trust between collectors. These guidelines apply to every
        interaction on the Platform — listings, messages, reviews, and profiles.
      </p>

      <h2>Be respectful</h2>
      <p>
        Treat other members the way you&apos;d want to be treated. Harassment, hate speech,
        threats, or discriminatory language will result in immediate account review.
      </p>

      <h2>Be honest</h2>
      <p>
        Accurately represent your items, your identity, and your intentions. Misrepresentation
        erodes trust for the whole community.
      </p>

      <h2>Keep it on-platform</h2>
      <p>
        Payments and order communication should stay within {`Wots TCG Vault NZ`} so both parties
        remain protected. Sharing payment details to bypass checkout is against our rules and may
        be reported.
      </p>

      <h2>Leave fair reviews</h2>
      <p>
        Reviews should reflect your genuine experience. Review manipulation (fake reviews, review
        swapping, retaliatory reviews) is not permitted and may be removed.
      </p>

      <h2>Report, don&apos;t retaliate</h2>
      <p>
        If something feels wrong — a listing, a message, a user — report it. Our trust & safety
        team reviews every report and can take action you can&apos;t take yourself.
      </p>
    </LegalLayout>
  );
}

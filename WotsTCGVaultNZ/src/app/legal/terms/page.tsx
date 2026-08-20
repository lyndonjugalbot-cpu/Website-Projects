import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalLayout title="Marketplace Terms & Conditions" updated="19 August 2026">
      <p>
        These Terms & Conditions govern your use of {SITE_NAME} (&ldquo;the Platform&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or using the Platform you agree to be bound by
        these Terms.
      </p>

      <h2>1. What we are</h2>
      <p>
        {SITE_NAME} is an online marketplace that connects buyers and sellers of Pokémon and
        trading card game items in New Zealand. We are not a party to the contract of sale between
        buyer and seller — that contract is between the buyer and the seller directly. We provide
        the platform, payment facilitation, and dispute-resolution support.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be 18 years or older, or have the consent of a parent/guardian, to buy or sell on
        the Platform. Sellers must complete email verification, Facebook connection, and government
        ID verification before listing any item for sale.
      </p>

      <h2>3. Listings</h2>
      <ul>
        <li>All listings must accurately describe the item, including condition and any defects.</li>
        <li>Sellers must declare authenticity and disclose known damage or defects honestly.</li>
        <li>Listings are reviewed before going live and may be rejected or removed at our discretion.</li>
        <li>Prohibited items (see our Prohibited Items Policy) may not be listed.</li>
      </ul>

      <h2>4. Payments</h2>
      <p>
        Payments are processed by Stripe. {SITE_NAME} operates a platform-managed payment and
        payout process: Stripe processes the buyer&apos;s payment, and the seller payout release
        generally occurs after confirmed delivery and the applicable buyer protection period,
        provided no dispute, refund, fraud review, chargeback, or account restriction is active.
        Payout timing is subject to Stripe processing times, seller verification, banking
        schedules, reserves, and applicable law. See our Fees and Payout Policy for details.
      </p>

      <h2>5. Fees</h2>
      <p>
        We charge sellers a platform commission on completed sales, disclosed at checkout and in
        the seller dashboard. Payment processing fees charged by our payment provider are separate
        and also disclosed prior to sale.
      </p>

      <h2>6. Prohibited conduct</h2>
      <ul>
        <li>Circumventing the Platform&apos;s payment system to avoid fees.</li>
        <li>Listing counterfeit, stolen, or misrepresented items.</li>
        <li>Harassment, fraud, or abusive behaviour toward other users.</li>
        <li>Creating duplicate accounts to evade a suspension or ban.</li>
      </ul>

      <h2>7. Suspension & termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms, applicable law, or pose a
        risk to the Platform or its users, with or without notice depending on severity.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        The Platform is provided &ldquo;as is&rdquo;. To the maximum extent permitted by New
        Zealand law, {SITE_NAME} is not liable for indirect or consequential losses arising from
        use of the Platform, transactions between users, or third-party services we integrate with.
      </p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of New Zealand.</p>

      <p className="text-xs text-muted-2 pt-4 border-t border-white/10">
        <strong>Placeholder notice:</strong> this document is a starting template only. Obtain
        review from a qualified New Zealand lawyer before relying on it in production, particularly
        regarding Consumer Guarantees Act 1993, Fair Trading Act 1986, and Financial Markets
        Conduct Act obligations relevant to marketplace payment facilitation.
      </p>
    </LegalLayout>
  );
}

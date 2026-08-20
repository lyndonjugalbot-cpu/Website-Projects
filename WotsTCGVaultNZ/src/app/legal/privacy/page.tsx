import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="19 August 2026">
      <p>
        This Privacy Policy explains how {SITE_NAME} collects, uses, stores, and protects personal
        information, in line with the New Zealand Privacy Act 2020 and its Information Privacy
        Principles (IPPs).
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>Account details: full name, username, email, password (hashed), location.</li>
        <li>Facebook profile information, if you connect your Facebook account.</li>
        <li>Government-issued ID documents, submitted for seller verification only.</li>
        <li>Listing, order, payment, and messaging data generated through your use of the Platform.</li>
        <li>Technical data: IP address, device/browser information, for security and fraud prevention.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To operate the marketplace: listings, orders, payments, messaging, reviews.</li>
        <li>To verify seller identity and reduce fraud.</li>
        <li>To communicate with you about your account, orders, and policy updates.</li>
        <li>To comply with legal, tax, and regulatory obligations.</li>
      </ul>

      <h2>3. Identity documents</h2>
      <p>
        Government ID documents are uploaded directly to encrypted, access-restricted storage.
        Access is limited to trained verification reviewers and is logged. Documents are retained
        only as long as necessary for verification and compliance purposes, after which they are
        scheduled for deletion.
      </p>

      <h2>4. Facebook data</h2>
      <p>
        Connecting Facebook links your account for login and verification purposes. We do not
        publish your Facebook profile link publicly unless you explicitly opt in via your account
        settings. We do not access or store private Facebook data beyond your public profile
        identifier and (if provided) email and profile photo.
      </p>

      <h2>5. Sharing information</h2>
      <p>
        We share information with service providers strictly as needed to operate the Platform:
        our payment processor (Stripe), object storage provider, and email provider. We do not sell
        personal information to third parties.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Under the Privacy Act 2020 you may request access to, or correction of, your personal
        information. Contact privacy@wotstcgvault.co.nz to make a request.
      </p>

      <h2>7. Data retention & deletion</h2>
      <p>
        We retain account and transaction data for as long as your account is active and as
        required for tax/legal record-keeping thereafter. Identity documents follow a shorter,
        dedicated retention schedule described above.
      </p>

      <p className="text-xs text-muted-2 pt-4 border-t border-white/10">
        <strong>Placeholder notice:</strong> this document is a starting template only. Obtain
        review from a qualified New Zealand privacy/data-protection lawyer before launch, including
        confirmation of retention periods, cross-border data transfer disclosures (if using
        overseas cloud providers), and AML/CFT identity-verification obligations if applicable.
      </p>
    </LegalLayout>
  );
}

# Legal & Compliance Considerations

**This document is not legal advice.** It is a checklist of areas a qualified New Zealand lawyer
should review before this platform accepts real sellers, buyers, or payments.

## Privacy Act 2020 (NZ)

- The platform collects government ID documents for seller verification. Confirm the collection,
  storage, retention, and disposal approach in `docs/SECURITY.md` and the `IdentityVerification`
  model satisfies IPPs 1, 5, 6, 9, and 11.
- `IdentityVerification.purgeAfter` is set on submission (90 days from creation in the current
  implementation) but **no scheduled job actually deletes the underlying S3 objects or DB rows
  yet** — this needs to be built (a cron/queue job reading rows where `purgeAfter < now()` and
  `purgedAt IS NULL`) before launch.
- Confirm whether any of your infrastructure providers store data outside New Zealand, and whether
  that triggers additional disclosure obligations under IPP 12.

## Financial Markets Conduct Act / payments regulation

- The platform uses the terms *platform-managed payment*, *delayed seller payout*, *buyer
  protection period*, and *seller payout release* throughout — never "escrow" — because funds are
  processed by Stripe under Stripe's own marketplace terms, and the payout-timing decision is an
  internal Stripe Connect Transfer scheduling choice we control, not a regulated custody
  arrangement. See `docs/PAYMENTS.md` §1 for the full architecture and the canonical policy
  sentence used in `/legal/payment-policy`. Confirm this framing is still accurate for your
  specific Stripe Connect account type and country before launch.
- Confirm whether facilitating marketplace payments at this platform's scale requires registration
  as a financial service provider under the Financial Service Providers (Registration and
  Dispute Resolution) Act 2008.

## AML/CFT Act 2009

- Identity verification here is a KYC-style flow, not a formal AML/CFT programme. If transaction
  volumes or values grow, get advice on whether AML/CFT obligations apply to the platform
  operator.

## Consumer Guarantees Act 1993 / Fair Trading Act 1986

- The platform is a marketplace facilitator, not the seller of record — the legal relationship for
  each sale is between buyer and seller. Confirm the Terms & Conditions correctly disclose this
  and don't inadvertently create supplier obligations for the platform itself.
- Review the authenticity/condition disclosure language (see `legal/authenticity-policy`) against
  Fair Trading Act misleading-conduct provisions.

## Facebook Platform Terms

- The Facebook integration only stores the connected user's Facebook user ID and profile URL, and
  only displays it publicly with explicit, separately-tracked consent
  (`FacebookConnection.publicConsent`). Review this against Meta's current Platform Terms and data
  use policy before launch, as these terms change periodically.

## Items still requiring a decision before launch

- [ ] Final platform commission rate and whether it needs to be GST-inclusive/exclusive language.
- [ ] Dispute/refund SLA commitments made in the Refund Policy.
- [ ] Whether age verification beyond self-declaration (18+) is required.
- [ ] Data breach notification procedure (Privacy Act 2020 requires notifiable privacy breaches be
      reported to the Privacy Commissioner and affected individuals).

# Security Checklist

## Implemented in this codebase

- **Authentication**: NextAuth (JWT sessions), bcrypt password hashing (cost 12), Credentials +
  Facebook OAuth providers. Session tokens are httpOnly cookies managed by NextAuth.
- **Server-side authorization**: every mutation re-checks the session server-side (never trusts
  client state). Role/capability checks centralized in `lib/rbac.ts` (`can()`, `isStaff()`,
  `isAdmin()`) and `lib/require-staff.ts` for admin routes.
- **Input validation**: every API route validates its body/query with Zod schemas
  (`lib/validations/*.ts`) before touching the database.
- **Rate limiting**: in-memory sliding-window limiter (`lib/rate-limit.ts`) on register, login
  attempts (via NextAuth), forgot-password, listing creation, messaging, reporting, uploads.
  **Production note**: swap for `@upstash/ratelimit` (Redis) once deployed across multiple
  instances — an in-memory limiter does not share state across servers/regions.
- **File upload validation**: content-type allowlist (JPEG/PNG/WEBP) and size cap (8MB) enforced
  server-side before issuing a presigned upload URL (`lib/storage.ts`).
- **Webhook signature verification**: `/api/webhooks/stripe` verifies `stripe-signature` against
  `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent` — payloads that fail verification
  are rejected with 400 before any database write.
- **Least-privilege document access**: identity documents are stored in a separate, non-public S3
  bucket (`S3_BUCKET_IDENTITY`). Reads only happen via short-lived (120s) signed URLs generated
  for staff with the `verification.viewDocuments` capability, and every view is written to
  `AuditLog`.
- **Audit logging**: `lib/audit.ts` records actor, action, target, and metadata for every
  moderation/admin action (bans, listing approval/removal, verification decisions, dispute
  resolution, settings changes, Stripe webhook events).
- **Route protection**: `src/middleware.ts` gates `/dashboard`, `/sell`, `/messages`, `/admin`,
  `/account` behind an authenticated session, and additionally restricts `/admin/*` to staff
  roles. Suspended/banned users are redirected out on their next token refresh.
- **SQL injection**: not applicable — all queries go through Prisma's parameterized query builder;
  no raw SQL string interpolation is used anywhere in the codebase.
- **XSS**: React escapes all interpolated content by default. The only `dangerouslySetInnerHTML`
  usage is the static JSON-LD `<script>` on the listing page, which serializes server-derived,
  already-validated data via `JSON.stringify` — not user-supplied HTML.
- **CSRF**: NextAuth's credential/OAuth flows include built-in CSRF token protection for the auth
  endpoints. All other mutating API routes require a valid session cookie (`SameSite=Lax` by
  default via NextAuth), which is the standard Next.js App Router CSRF posture for same-site
  fetch-based mutations.
- **No card data touches our servers**: Stripe Checkout/Elements handle card entry; we only ever
  store Stripe IDs (`PaymentIntent`, `Charge`, Connect account IDs).
- **Secure cookies**: NextAuth sets `secure`, `httpOnly` cookies automatically in production
  (`NEXTAUTH_URL` must be `https://` for this to activate).

## Payment-specific security (see docs/PAYMENTS.md for full architecture)

- **Price tampering**: `/api/checkout` never accepts a price from the client — every cent is
  re-derived server-side from the `Listing` row and admin-configured fee settings
  (`lib/money.ts` `calculateFeeBreakdown`, called with DB-sourced values only).
- **Duplicate checkout / double-purchase protection**: listing inventory is reserved atomically
  via a guarded raw SQL `UPDATE ... WHERE quantity - reservedQuantity >= $qty` (`lib/reservations.ts`)
  before any Stripe object is created, so two concurrent buyers can never both check out the last
  unit of a one-of-one item — see the concurrency test in `tests/integration/reservations.test.ts`.
- **Webhook idempotency**: `WebhookEvent.id` is the Stripe event id itself (natural-key unique
  constraint), so a duplicate delivery — which Stripe explicitly documents can happen — is rejected
  by the database before any business logic runs (`lib/webhook-events.ts`).
- **Idempotency keys on all Stripe-mutating calls**: Checkout Session creation, Transfers, and
  Refunds all pass a deterministic or randomly-generated idempotency key, preventing a network
  retry from creating a duplicate charge, transfer, or refund.
- **Unauthorized payout release**: manual payout release (`/api/admin/payouts/[id]/release`)
  requires the `payout.release` capability, which only `SUPER_ADMIN` holds — no other staff role,
  including `SUPPORT`, can trigger it. Refund approval requires `refund.approve` (`SUPPORT` or
  `SUPER_ADMIN`).
- **Dispute payout holds are enforced at the data layer**: opening a dispute (buyer-filed or a
  Stripe chargeback webhook) immediately flips every related `Payout` row to `ON_HOLD`
  (`lib/payouts.ts` `holdPayoutsForOrder`), and the release sweep re-checks for an active dispute
  immediately before every transfer attempt as a second guard against a race between dispute
  creation and a concurrent release sweep.
- **Refund-after-payout recovery never silently no-ops**: if a Transfer reversal fails (e.g.
  insufficient connected-account balance), the order is routed to `ADMIN_REVIEW` with a note and
  admins are notified — the refund is not marked processed as if the seller's share was
  successfully recovered.

## Required before production launch

- [ ] Move rate limiting to Redis (Upstash) for multi-instance correctness.
- [ ] Add a Web Application Firewall / bot-protection layer (e.g. Vercel Firewall, Cloudflare) in
      front of `/api/auth/register`, `/api/checkout`, and messaging endpoints.
- [ ] Add CAPTCHA (hCaptcha/Turnstile) to registration and reporting to deter spam/bulk-account
      creation.
- [ ] Implement real TOTP-based 2FA (schema fields `twoFactorEnabled`/`twoFactorSecret` already
      exist; the settings UI currently shows this as a disabled placeholder).
- [ ] Add duplicate-account detection heuristics (device fingerprint, IP velocity) — schema has
      `AuditLog.ipAddress` captured but no automated flagging yet.
- [ ] Configure automatic identity-document deletion job reading `IdentityVerification.purgeAfter`
      (field exists; the actual scheduled purge job is not implemented — see docs/LEGAL.md).
- [ ] Penetration test the Stripe Connect payout flow and dispute/refund admin actions
      specifically, since they move real money.
- [ ] Consider enabling Stripe Radar rules appropriate to a collectibles marketplace (elevated
      fraud risk category) before accepting live payments.

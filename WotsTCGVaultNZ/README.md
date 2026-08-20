# Wots TCG Vault NZ

A premium, black-and-gold marketplace for buying and selling Pokémon cards, trading cards, sealed
product, and graded slabs across New Zealand.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** + **React 18**
- **Tailwind CSS v4** (CSS-first theme in `src/app/globals.css`) + custom shadcn/ui-style
  component primitives (`src/components/ui/*`) built on Radix UI
- **PostgreSQL** + **Prisma ORM** (`prisma/schema.prisma`)
- **NextAuth v4** — Credentials (email/password) + Facebook OAuth, JWT sessions
- **Stripe Connect** (Express accounts) for marketplace payments and payouts
- **S3-compatible object storage** (AWS S3 / Cloudflare R2 / Supabase Storage) via presigned
  uploads, for listing photos and (separately, privately) ID documents
- **Resend** for transactional email
- **Framer Motion** for animation, **sonner** for toasts, **react-hook-form + Zod** for forms

This combination was chosen over alternatives (e.g. a Node/Express API + separate SPA, or a
BaaS like Firebase) because a marketplace this data-relational (orders, payments, payouts,
disputes, audit trails) benefits enormously from Prisma's typed relational schema and
transactions, and Next.js App Router lets server components query the database directly for
public pages (fast, SEO-friendly) while API routes handle every stateful mutation with one
consistent auth/validation pattern.

## Project structure

```
prisma/
  schema.prisma        # full data model (see below)
  seed.ts               # demo users, listings, a collection
src/
  app/                  # routes (pages + API routes), see full list in docs/API_ROUTES.md
    admin/               # staff-only dashboard (layout gates by role)
    dashboard/{seller,buyer}/
    listing/[slug]/  marketplace/  profile/[username]/  sell/new/  messages/
    legal/*              # Terms, Privacy, Refund, Prohibited Items, Authenticity, Guidelines
    api/                 # route handlers — see docs/API_ROUTES.md
  components/
    ui/                  # button, card, input, dialog, select, tabs, etc.
    layout/ home/ marketplace/ listing/ forms/ dashboard/ admin/ messages/ shared/ legal/
  lib/                  # prisma client, auth config, rbac, stripe, storage, email, validations
  types/                # shared TS types (listing card shape, NextAuth session augmentation)
  middleware.ts         # route protection (auth + admin role gate)
docs/
  API_ROUTES.md  SECURITY.md  DEPLOYMENT.md  TESTING.md  LEGAL.md
```

## Database schema

Full schema lives in `prisma/schema.prisma`. Entity groups:

- **Auth**: `User`, `Account`, `Session`, `VerificationToken`, `Permission`/`RolePermission`
- **Identity**: `FacebookConnection` (consent-gated public profile link), `IdentityVerification`
  (encrypted-storage-key references, reviewer notes, retention `purgeAfter`)
- **Catalog**: `Listing`, `ListingImage`, `ShippingOption` + enums for category/condition/grading
  company/language
- **Collections**: `Collection`, `CollectionItem` (public/private showcase items)
- **Commerce**: `Order`, `OrderItem`, `Payment`, `SellerPayoutAccount`, `Payout`, `Transfer`,
  `Refund`, `Dispute`, `DisputeEvidence`, `ShippingRecord`, `Review`
- **Payment infrastructure**: `ListingReservation` (checkout inventory locking),
  `WebhookEvent` (Stripe webhook idempotency)
- **Social/Trust**: `Favorite`, `FavoriteSeller`, `Conversation`, `Message`, `UserBlock`,
  `Notification`, `Report`
- **Platform**: `AuditLog`, `PlatformSetting`

Every user-facing table has `createdAt`/`updatedAt`; listings and users additionally support soft
deletion (`deletedAt`). All money fields are integer NZD cents to avoid floating-point error.

## Authentication architecture

NextAuth v4 with the Prisma adapter, JWT session strategy. Two providers:

1. **Credentials** — email + bcrypt-hashed password, with account-status checks (banned/suspended
   users are rejected at `authorize()`).
2. **Facebook OAuth** — used both for "Log in with Facebook" and "Connect Facebook" from account
   settings (`allowDangerousEmailAccountLinking: true` links it to an existing account sharing the
   same Meta-verified email). A custom `profile()` callback supplies placeholder
   `username`/`fullName` values for a brand-new Facebook-first signup, since our schema requires
   those fields; such users are expected to complete their profile (real username, NZ location,
   terms acceptance) from the dashboard on first visit — see "Known limitations" below.

Session role/status is refreshed from the database on every token refresh so a ban or role change
takes effect without requiring re-login. Route protection is enforced in `src/middleware.ts` (not
just hidden UI) and re-checked again inside every API route via `getServerSession`.

## Roles & permissions

`Role` enum: `BUYER`, `SELLER`, `MODERATOR`, `VERIFICATION_REVIEWER`, `SUPPORT`, `SUPER_ADMIN`.
Capability checks are centralized in `src/lib/rbac.ts` (`can(role, capability)`) so authorization
logic lives in one auditable place rather than scattered `role === "X"` checks. See
`docs/SECURITY.md` for the full authorization model.

## Payment & payout architecture

Full write-up in **[`docs/PAYMENTS.md`](docs/PAYMENTS.md)** — architecture decision, complete
state machines, local Stripe CLI testing, production checklist, and security notes. Summary:

Buyer pays via **Stripe Checkout**, charged to the **platform's own Stripe account** (a plain
charge — no `transfer_data`, unlike a destination charge) → listing is atomically reserved during
checkout (`lib/reservations.ts`, race-safe for one-of-one items) → seller ships + uploads tracking
→ delivery is confirmed (tracking, buyer, or admin) → a buyer protection / inspection period
starts (`lib/payouts.ts`, default 48h, admin-configurable) → if no dispute is opened before it
elapses, the order becomes payout-eligible → a scheduled job (`/api/cron/release-payouts`) creates
a Stripe **Transfer** moving the seller's net proceeds — minus platform commission and a rolling
reserve — to their Connect Express account. Every state transition is driven by signature-verified,
idempotent Stripe webhooks (`src/app/api/webhooks/stripe/route.ts`) — **the client-side checkout
redirect is never trusted to mark an order paid.**

The platform is described throughout as a *platform-managed payment and payout process*, never as
regulated escrow — see `docs/PAYMENTS.md` §1 and `docs/LEGAL.md`.

## Shipping architecture

Sellers define one or more `ShippingOption`s per listing (name, price, optional insurance flag) at
listing-creation time, plus an optional local-pickup toggle. At checkout, Stripe collects the
buyer's NZ shipping address directly (`shipping_address_collection`); the webhook writes that
address onto the `Order`. Sellers upload carrier + tracking number from their dashboard, which
flips the order to `SHIPPED`, notifies the buyer by email, and is displayed in both dashboards.

## Email notification plan

Every notification writes an in-app `Notification` row *and* sends an email in one call via
`src/lib/notify.ts` (`notifyUser` / `notifyAdmins`), which wraps `src/lib/email.ts` (Resend, with a
console-log dev fallback when `RESEND_API_KEY` is unset):

| Trigger | Recipient |
|---|---|
| Registration | Email verification link (buyer/seller) |
| Forgot password | Password reset link |
| Payment successful / order created | Buyer |
| Seller needs to ship | Seller |
| Tracking uploaded / order shipped | Buyer |
| Payment failed | Buyer |
| Delivery confirmed / inspection period started | Seller |
| Payout eligible / released / failed | Seller / admins (failures) |
| Refund issued (full or partial) | Buyer and seller |
| Dispute opened / seller response required | Seller and admins |
| Dispute resolved | Buyer and seller |
| Stripe chargeback opened / won / lost | Seller and admins |
| Order needs delivery review (stale shipment) | Admins |
| Stripe payout account status change (enabled/restricted/disabled) | Seller |
| Verification decision | Approved/rejected/resubmission notice to seller |

**Not yet wired** (documented as a follow-up, not implemented): new-message email digests, weekly
seller earnings summary.

## Known limitations / next steps

Built honestly rather than over-claimed — these are the gaps a team would pick up next:

- **No cart**: this marketplace follows the eBay/Trade Me pattern of unique, mostly-single-quantity
  items, so "Buy Now" checks out one listing directly rather than building a multi-item cart.
- **Connected-account `payout.*` events aren't consumed**: Stripe's own Connect-balance-to-bank
  payout schedule is separate from the platform-to-seller `Transfer` this app tracks — see
  `docs/PAYMENTS.md` §1 "Known Stripe limitations".
- **Image compression/watermarking**: the upload pipeline validates type/size but does not
  transform images server-side (recommend Cloudinary/Imgix transformation or a Sharp-based
  pipeline as a follow-up).
- **Identity document auto-deletion**: `IdentityVerification.purgeAfter` is set on submission but
  no scheduled job actually purges expired documents yet — see `docs/LEGAL.md`.
- **2FA**: schema + settings UI placeholder exist; real TOTP enrolment is not implemented.
- **Real-time messaging**: the inbox polls on navigation, not via websockets/Pusher.
- **Rate limiting is in-memory**: fine for a single instance, needs Redis for multi-instance prod.

## Features that require external services to function

| Feature | Service | Behavior without it |
|---|---|---|
| Payments, payouts, Connect onboarding | Stripe | Checkout returns a clear 503 |
| Facebook login/connect | Meta for Developers app | Facebook button hidden from login page |
| Listing photo / ID document uploads | S3-compatible storage | Upload returns a clear 503 |
| Transactional email | Resend | Emails are console-logged instead of sent |
| Production database | Managed Postgres | App won't boot without `DATABASE_URL` |

See `.env.example` for every variable, and `docs/DEPLOYMENT.md` for how to provision each service.

## Getting started

```bash
cp .env.example .env   # fill in DATABASE_URL at minimum
npm install
npx prisma migrate dev
npm run db:seed         # optional demo data — prints demo logins to the console
npm run dev
```

## Further reading

- [`docs/PAYMENTS.md`](docs/PAYMENTS.md) — Stripe Connect architecture, state machines, local
  testing, deployment checklist, security notes
- [`docs/API_ROUTES.md`](docs/API_ROUTES.md) — full route reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — security checklist (implemented vs. required pre-launch)
- [`docs/TESTING.md`](docs/TESTING.md) — testing strategy
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deployment instructions
- [`docs/LEGAL.md`](docs/LEGAL.md) — legal & compliance considerations (**not legal advice**)

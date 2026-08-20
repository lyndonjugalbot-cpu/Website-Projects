# API Route Reference

All routes live under `src/app/api/**/route.ts` (Next.js Route Handlers). Unless noted,
responses are JSON and errors return `{ error: string | ZodFlattenedError }`.

## Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handler (credentials + Facebook) |
| POST | `/api/auth/register` | — | Create account, sends verification email |
| POST | `/api/auth/verify-email` | — | Consume email verification token |
| POST | `/api/auth/forgot-password` | — | Request password reset email |
| POST | `/api/auth/reset-password` | — | Consume reset token, set new password |

## Listings
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/listings` | — | Search/filter/sort/paginate active listings |
| POST | `/api/listings` | Seller-eligible | Create a listing (status → PENDING_REVIEW) |
| GET | `/api/listings/mine` | User | All of the caller's own listings, any status |
| PATCH | `/api/listings/[id]` | Owner or staff | Pause/resume/mark sold/price (owner); approve/reject (staff) |
| DELETE | `/api/listings/[id]` | Owner or staff | Soft-delete a listing |

## Favorites & Follows
| Method | Route | Auth | Description |
|---|---|---|---|
| GET/POST/DELETE | `/api/favorites` | User | Saved listings |
| GET/POST/DELETE | `/api/favorite-sellers` | User | Followed sellers |

## Messaging
| Method | Route | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/messages` | User | List conversations / start a new one |
| GET/POST | `/api/messages/[conversationId]` | Participant | Read thread / send reply |

## Orders, Checkout & Payments

See `docs/PAYMENTS.md` for the full state machine and architecture. Checkout charges the
**platform's own Stripe account** (separate-charges-and-transfers model, not a destination
charge) — the seller's share only moves via a Transfer once payout eligibility is met.

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/checkout` | User | Validates listing/price/stock server-side, atomically reserves inventory, creates Order (PENDING_PAYMENT) + Stripe Checkout Session |
| GET | `/api/pricing/preview` | — | Read-only fee breakdown preview (same math as checkout, no Stripe objects created) |
| GET | `/api/orders?as=buyer\|seller` | User | List the caller's orders (runs the cheap DB-only sweeps inline) |
| POST | `/api/orders/[id]/tracking` | Seller (item owner) | Attach carrier + tracking number, order → SHIPPED |
| POST | `/api/orders/[id]/confirm` | Buyer | Confirm delivery → starts the buyer protection / inspection period (does NOT release payout immediately) |
| POST | `/api/webhooks/stripe` | Stripe signature | Idempotent source of truth for payment/dispute/transfer state — see full event list in `docs/PAYMENTS.md` |
| POST | `/api/stripe/connect/onboard` | Seller-eligible | Creates a Connect Express account if needed + fresh onboarding AccountLink |
| POST | `/api/stripe/connect/refresh` | Seller | Fresh AccountLink for a seller whose previous link expired |
| GET | `/api/stripe/connect/status` | Seller | Current payout-account status; `?refresh=1` force-syncs from Stripe first |
| GET | `/api/payouts` | Seller | Own payout history + Connect account status |
| POST | `/api/cron/release-payouts` | `CRON_SECRET` bearer/query token | Scheduled: sweeps inspection periods, flags stale deliveries, releases eligible payouts via Stripe Transfer |
| POST | `/api/cron/cleanup-reservations` | `CRON_SECRET` bearer/query token | Scheduled: releases expired listing reservations |

## Disputes
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/disputes` | Buyer | Open a dispute on an order (places the seller's payout on hold) |
| POST | `/api/disputes/[id]/evidence` | Buyer or seller on the dispute | Attach a supporting evidence URL |
| POST | `/api/disputes/[id]/respond` | Seller | Submit a response within the review window |

## Reviews, Reports & Verification
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/reviews` | Buyer | Review a completed order |
| POST | `/api/reports` | User | Report a listing or user |
| GET/POST | `/api/verification` | User | View / submit ID verification |
| POST | `/api/upload/listing-image` | User | Presigned S3 PUT URL for a listing photo |
| POST | `/api/upload/identity-document` | User | Presigned S3 PUT URL for an ID document (private bucket) |

## Collections
| Method | Route | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/collections` | User | List/create collections |
| POST | `/api/collections/[id]/items` | Owner | Add a showcase item |

## Account
| Method | Route | Auth | Description |
|---|---|---|---|
| GET/PATCH | `/api/account` | User | Read/update own profile |
| POST | `/api/account/facebook-consent` | User | Toggle public Facebook link visibility |

## Admin (all require staff role + capability, see `lib/rbac.ts`)
| Method | Route | Capability | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | staff | Overview analytics |
| GET | `/api/admin/verifications` | `verification.review` | Verification queue |
| GET/PATCH | `/api/admin/verifications/[id]` | `verification.viewDocuments` / `verification.review` | View documents (signed URLs) / decide |
| GET | `/api/admin/listings` | staff | Listings by status |
| GET/PATCH | `/api/admin/users`, `/api/admin/users/[id]` | staff / `users.ban` | User management, ban, role change (role change requires SUPER_ADMIN) |
| GET | `/api/admin/orders` | staff | All orders |
| GET | `/api/admin/transactions/[orderId]` | staff | Complete transaction view: order, buyer/seller, every Stripe object, refunds, dispute, payouts, audit trail |
| GET/PATCH | `/api/admin/reports`, `/api/admin/reports/[id]` | `report.review` | Trust & safety queue |
| GET/PATCH | `/api/admin/disputes`, `/api/admin/disputes/[id]` | `dispute.manage` | Dispute resolution (refund goes through `lib/refunds.ts`, safely reversing a Transfer if already paid out) |
| POST | `/api/admin/refunds` | `refund.approve` | Full/partial/shipping-only refund, always staff-initiated |
| GET | `/api/admin/payouts` | staff | Payouts by status |
| POST | `/api/admin/payouts/[id]/release` | `payout.release` (SUPER_ADMIN only) | Manual payout release, bypassing the auto-payout amount cap |
| GET/PATCH | `/api/admin/settings` | staff / `settings.manage` | Platform payment settings (commission, reserve, inspection period, auto-payout cap, etc.) |
| GET | `/api/admin/audit-logs` | staff | Audit trail |

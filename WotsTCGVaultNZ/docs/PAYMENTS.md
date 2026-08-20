# Marketplace Payments — Architecture & Operations

This document covers the Stripe Connect payment system: architecture, the full state
machine, local testing, deployment, and security/compliance notes. It assumes you've
read the top-level README for general project setup.

## 1. Architecture decision: separate charges and transfers

**We do not use destination charges.** A destination charge
(`payment_intent_data.transfer_data.destination` set at charge time) moves the seller's
share to their Connect balance *immediately* on payment success — there is no way to
delay it. Since this marketplace needs seller payout to wait for delivery confirmation
and a buyer protection period, we use Stripe's other documented pattern instead:

1. The buyer's Checkout Session charges the **platform's own Stripe account** — no
   `transfer_data` at all (`src/app/api/checkout/route.ts`).
2. The charge settles into the platform's Stripe balance.
3. Once every payout-eligibility condition is met (`src/lib/payouts.ts`), our backend
   calls `stripe.transfers.create()` to move the seller's net proceeds — subtotal +
   shipping, minus platform commission and a rolling reserve — into their **Connect
   Express** account.
4. From there, Stripe pays the seller out to their bank on Stripe's own schedule for
   that account (daily/weekly, configured on the connected account) — this last leg is
   not something the platform controls per-order.

### Why Express accounts

Express gives Stripe-hosted KYC/identity/banking collection (via Account Links →
`type: "account_onboarding"`), which minimizes the platform's own compliance surface
compared to Custom accounts, while still allowing the separate-charges-and-transfers
model above. Standard accounts were not used because they let the seller manage their
own Stripe Dashboard, which doesn't fit a marketplace of casual individual sellers.

### Known Stripe limitations this creates

- **Platform balance must be sufficient to fund transfers.** New Stripe platforms are
  sometimes on a slightly delayed settlement schedule for card payments during initial
  risk review. If a transfer is attempted before the underlying charge has settled, it
  can fail with `insufficient_funds` — `lib/payouts.ts` catches this per-payout (marks
  it `FAILED` with the Stripe error message, notifies admins) rather than crashing the
  whole release sweep.
- **We don't currently listen to the connected account's own `payout.*` events.**
  Stripe's `Payout` object (Connect balance → seller's bank) is a *separate* concept
  from the `Transfer` object (platform balance → Connect balance) that this codebase
  tracks. Receiving `payout.created/paid/failed` webhooks for *connected accounts*
  requires either Connect-level webhook event listening (enabled per endpoint in the
  Stripe Dashboard) or a `Stripe-Account`-scoped webhook — neither is configured by
  default. The webhook handler still has cases for these event types (for forward
  compatibility / audit logging) but nothing in our state machine depends on them.
- **Refunding after a payout requires a transfer reversal**, which itself requires the
  connected account to still hold sufficient balance. `lib/refunds.ts` attempts
  `stripe.transfers.createReversal()` first; if that fails, the order is routed to
  `ADMIN_REVIEW` with a note, rather than silently proceeding as if money moved that
  didn't. See "Refunds after payout" below.
- **Stripe Checkout Session `expires_at` has a 30-minute minimum.** The listing
  reservation TTL is clamped to match — see `reserveListing()` in `lib/reservations.ts`.

### Terminology

Per product requirement, the system never describes itself as regulated escrow.
Approved terms used throughout the UI and policy pages: *platform-managed payment*,
*marketplace payment*, *delayed seller payout*, *buyer protection period*, *seller
payout release*. The canonical policy sentence (used verbatim in
`/legal/payment-policy` and `/legal/fees-and-payouts`):

> Payments are processed by Stripe. Wots TCG Vault NZ operates a platform-managed
> payment and payout process. Seller payout eligibility generally occurs after
> confirmed delivery and the applicable buyer inspection period, provided that no
> dispute, refund, fraud review, chargeback, or account restriction is active. Payout
> timing is subject to Stripe processing times, seller verification, banking
> schedules, reserves, and applicable laws.

## 2. Order / payment / payout state machines

Defined in `prisma/schema.prisma` (`OrderStatus`, `PaymentStatus`, `PayoutStatus`,
`DisputeStatus`) and labeled for display in `src/lib/constants.ts`.

```
Order:   PENDING_PAYMENT → PAYMENT_PROCESSING → PAID → AWAITING_SHIPMENT → SHIPPED
         → IN_TRANSIT → DELIVERED → INSPECTION_PERIOD → PAYOUT_ELIGIBLE
         → PAYOUT_PENDING → COMPLETED
         (side branches: CANCELLED, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED,
          DISPUTED, DELIVERY_FAILED, ADMIN_REVIEW)

Payment: CREATED → REQUIRES_ACTION|SUCCEEDED → (REFUNDED|PARTIALLY_REFUNDED|
         DISPUTED|CHARGEBACK) ; or FAILED / CANCELLED

Payout:  NOT_ELIGIBLE → ELIGIBLE → PENDING → PAID (or FAILED, or ON_HOLD, or REVERSED)
```

State transitions are driven exclusively by:

- **Webhooks** (`src/app/api/webhooks/stripe/route.ts`) for payment-related
  transitions — never by the client-side checkout redirect.
- **`lib/payouts.ts`** for delivery/inspection/payout transitions.
- **`lib/refunds.ts`** / **`lib/disputes.ts`** for refund/dispute transitions.

No route ever writes an order/payment/payout status directly outside these modules —
this keeps the state machine's invariants (e.g. "a payout can't be released while a
dispute is open") enforceable in one place.

## 3. Scheduled jobs

Two categories, split because one calls Stripe (has latency/cost) and one doesn't:

| Job | Endpoint | What it does | Suggested frequency |
|---|---|---|---|
| Reservation cleanup | `POST /api/cron/cleanup-reservations` | Releases expired listing reservations | Every 1–2 min |
| Payout release | `POST /api/cron/release-payouts` | Sweeps inspection periods → eligible, flags stale deliveries, releases eligible payouts via Stripe Transfer | Every 5–15 min |

Both require `Authorization: Bearer $CRON_SECRET` (or `?secret=$CRON_SECRET`).
The cheap, DB-only sweeps (`sweepExpiredReservations`, `sweepInspectionPeriods`,
`sweepStaleDeliveries`) also run inline whenever `/api/orders` is loaded, matching this
codebase's existing "lazy sweep" pattern — but `releaseEligiblePayouts` (which calls
Stripe) is **only** ever run by the dedicated cron endpoint, so listing your orders
never has unpredictable Stripe-API latency.

**Vercel Cron** (`vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/cleanup-reservations", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/release-payouts", "schedule": "*/10 * * * *" }
  ]
}
```
Vercel Cron calls your endpoint with `Authorization: Bearer $CRON_SECRET` automatically
when `CRON_SECRET` is set as an environment variable — no extra config needed. On any
other host, point a generic scheduler (cron, GitHub Actions schedule, etc.) at these
URLs with the header set manually.

## 4. Local testing with the Stripe CLI

```bash
# 1. Install the CLI: https://stripe.com/docs/stripe-cli
brew install stripe/stripe-cli/stripe
stripe login

# 2. Forward webhooks to your local dev server and copy the printed
#    whsec_... into STRIPE_WEBHOOK_SECRET in .env
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 3. In a second terminal, trigger events directly:
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed
stripe trigger charge.dispute.created
stripe trigger charge.refunded

# 4. For a real end-to-end run: set STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY to your
#    Stripe test-mode keys, complete Connect onboarding for a test seller
#    (use Stripe's test onboarding data — e.g. test SSN 000-00-0000 for US test
#    accounts; NZ test accounts use Stripe's documented test values), then buy
#    the listing with test card 4242 4242 4242 4242, any future expiry, any CVC.
```

### Testing delayed payouts without waiting

Use Stripe's [test clocks](https://stripe.com/docs/billing/testing/test-clocks) to
advance time on a test-mode Customer, or simply lower
`inspectionPeriodHours`/`reservationTtlMinutes` in **Admin → Settings** to a small
value (e.g. `reservationTtlMinutes: 30` is the Stripe-enforced floor;
`inspectionPeriodHours: 1`) while testing, then call
`POST /api/cron/release-payouts` manually to trigger the sweep immediately rather than
waiting for a scheduled run.

### Manually exercising each flow

```bash
# Reservation cleanup
curl -X POST http://localhost:3000/api/cron/cleanup-reservations \
  -H "Authorization: Bearer $CRON_SECRET"

# Inspection-period sweep + payout release
curl -X POST http://localhost:3000/api/cron/release-payouts \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 5. Production deployment checklist

- [ ] Stripe account activated for live payments; Connect enabled (Settings → Connect).
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` set to **live** keys (not `sk_test_...`).
- [ ] Live-mode webhook endpoint registered at `https://yourdomain/api/webhooks/stripe`
      subscribed to: `checkout.session.completed`, `checkout.session.expired`,
      `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `payment_intent.canceled`, `charge.refunded`, `charge.dispute.created`,
      `charge.dispute.updated`, `charge.dispute.closed`, `account.updated`,
      `transfer.created`, `transfer.reversed`. Copy the live signing secret into
      `STRIPE_WEBHOOK_SECRET`.
- [ ] `CRON_SECRET` set to a strong random value; cron scheduler configured and its
      first few runs verified in logs.
- [ ] `STRIPE_CONNECT_REFRESH_URL` / `STRIPE_CONNECT_RETURN_URL` point at the
      production domain.
- [ ] Admin payment settings (`/admin/settings`) reviewed for production values —
      commission rate, reserve, inspection period, auto-payout cap.
- [ ] Confirm `autoPayoutEnabled` and `maxAutoPayoutCents` reflect the risk tolerance
      you actually want — everything above the cap requires a human click in
      `/admin/payouts`.
- [ ] Run a real end-to-end order in Stripe **test mode against the production
      deployment** before flipping to live keys (test mode and live mode use
      different key pairs but the same code path).
- [ ] Verify test-mode indicator: `stripeConfigured()` / whether `STRIPE_SECRET_KEY`
      starts with `sk_live_` vs `sk_test_` should be visually obvious to admins — add
      a banner if this isn't already easy to tell apart in your deployment.
- [ ] Confirm the platform's own Stripe account has bank details added so it can
      itself receive settled charge funds before relying on transfers succeeding.
- [ ] Read `docs/LEGAL.md` and get NZ legal sign-off before accepting real payments.

## 6. Security & compliance warnings

- **This is not regulated escrow**, and the product must never be marketed as such —
  see the terminology section above. If transaction volume grows significantly, get
  advice on whether Financial Service Providers Act registration becomes relevant.
- **Refunds and manual payout release are staff-only**, gated by RBAC capabilities
  (`refund.approve`, `payout.release` — the latter restricted to `SUPER_ADMIN` only,
  since it's the single highest-blast-radius action in the admin panel).
- **Never trust client-supplied prices.** `/api/checkout` re-derives every cent
  server-side from the `Listing` row and admin fee settings; the request body
  cannot include a price at all (see `lib/validations/order.ts` `checkoutSchema`).
- **Webhook signature verification is mandatory and unconditional** — a request
  without a valid `stripe-signature` never reaches any handler.
- **No card data, CVV, or full bank account numbers are ever stored** — Stripe
  Checkout collects payment details directly; we only ever persist Stripe object IDs.
- **Identity documents are stored in a separate, non-public bucket** with signed,
  short-lived read URLs generated only for verification-reviewer staff — see
  `docs/SECURITY.md`.

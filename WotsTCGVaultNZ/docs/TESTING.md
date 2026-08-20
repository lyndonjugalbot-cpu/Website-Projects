# Testing Strategy

## 1. Type & lint gate (wired, runs in `next build`)

```bash
npx tsc --noEmit   # strict type checking, run in CI
npx eslint .        # next lint's flat-config successor
```

`next build` runs both as part of the production build — CI should run `npm run build` on every
PR at minimum.

## 2. Automated tests (implemented — Vitest)

```bash
npm test              # everything
npm run test:unit      # pure functions, no DB
npm run test:integration  # real Postgres — uses DATABASE_URL, same DB as `npm run dev`
```

`tests/integration/*` run against the actual local Postgres container (not a mock) and clean up
every row they create in `afterAll`, so they're safe to run against a database that also has
seeded demo data. What's covered today:

| File | Covers |
|---|---|
| `tests/unit/money.test.ts` | Integer-cents fee math: commission/shipping/buyer-fee/reserve calculation, refund proration, rounding never producing a non-integer or negative seller net |
| `tests/unit/rbac.test.ts` | Capability matrix per role (including that only `SUPER_ADMIN` can release a payout), `sellerEligibility()` gate logic |
| `tests/integration/reservations.test.ts` | Reserve → release cycle; **the concurrent-buyer race for the last unit of a one-of-one listing** (`Promise.allSettled`, asserts exactly one succeeds); consume → quantity decrement → `SOLD`; expired-reservation sweep |
| `tests/integration/webhook-events.test.ts` | Webhook idempotency: first delivery claims the event, a duplicate delivery of the same Stripe event id is rejected before any handler logic runs |
| `tests/integration/payout-eligibility.test.ts` | Inspection period starts on delivery confirmation; sweep does NOT promote before the window elapses; sweep DOES promote once elapsed with no dispute; dispute hold blocks release |

This directly exercises several of the specific scenarios called out in the spec: duplicate
purchase prevention, expired reservation cleanup, webhook duplicate delivery, automatic payout
eligibility, and payout hold due to dispute.

### Not yet automated (documented, not implemented — needs live Stripe test mode)

These require either a real Stripe test-mode account or non-trivial mocking of the Stripe SDK,
which wasn't in scope for this pass:

- Full checkout → `checkout.session.completed` webhook → order PAID end-to-end (can be exercised
  manually via the Stripe CLI — see `docs/PAYMENTS.md` §4).
- Expired Checkout Session → `checkout.session.expired` → reservation released.
- Chargeback (`charge.dispute.created/closed`) → payout hold → resolution.
- Refund after payout → transfer reversal (success and insufficient-balance failure paths).
- Failed payout / reversed transfer webhook handling.
- Seller onboarding incomplete/disabled blocking checkout (`payoutsEnabled: false`).

Recommended approach for these: `stripe trigger <event>` via the Stripe CLI against a running dev
server with `stripe listen` forwarding to `/api/webhooks/stripe`, asserting on the resulting DB
state — see `docs/PAYMENTS.md` for the exact commands. Stripe's
[test clocks](https://stripe.com/docs/billing/testing/test-clocks) are useful for exercising
time-based transitions (inspection period elapsing) without changing `inspectionPeriodHours`.

## 3. End-to-end tests (recommended: Playwright, not yet added)

Cover the golden paths a human would actually click through:

- Browse marketplace → filter by category/price/condition → open a listing → (logged out) redirect
  to login on "Buy Now".
- Full seller onboarding checklist → create listing → appears in admin pending queue.
- Buyer/seller messaging thread round-trip.
- Buyer opens a dispute from an order → seller sees "Respond" prompt → admin resolves with a
  partial refund → both parties notified.
- Mobile filter drawer open/close, grid/list toggle.
- `prefers-reduced-motion` respected (assert no `transform` transition applied — see
  `globals.css`'s reduced-motion media query).

## 4. Manual QA checklist before each release

- [ ] Lighthouse pass on `/`, `/marketplace`, `/listing/[slug]` (performance + accessibility).
- [ ] Keyboard-only pass: can you complete registration and checkout without a mouse?
- [ ] Screen reader spot-check on the create-listing form (labels, error announcements).
- [ ] Verify Stripe test-mode checkout end-to-end with a test card (`docs/PAYMENTS.md` §4).
- [ ] Verify email templates render correctly in Gmail/Outlook (Resend's preview tool).
- [ ] Manually run `/api/cron/release-payouts` and `/api/cron/cleanup-reservations` and inspect
      the JSON response before relying on the scheduler.

# ShopEasePH — Sample Ecommerce Store

A sample ecommerce storefront: product catalog, cart, checkout, and PayMongo
(GCash / Maya / card) sandbox payments — built with Next.js 14 (App Router),
TypeScript, Tailwind CSS, and Prisma + SQLite.

This is a **demo/sample project**. Read "Before going live" at the bottom
before using any of this with real customers or real money.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma 7 + SQLite (via a driver adapter — see note below), easy to swap for Postgres
- PayMongo Payment Intent + Payment Method API, with a built-in mock fallback
- Deployable to Vercel

## Getting started

### 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via the `postinstall` script).

### 2. Set up environment variables

```bash
cp .env.example .env
```

The defaults work out of the box for local development — SQLite needs no
setup, and if you leave the PayMongo keys blank the app automatically uses a
**mock payment flow** (see below). Open `.env.example` for a description of
every variable.

### 3. Set up the database

```bash
npm run db:migrate   # creates prisma/dev.db and applies the schema
npm run db:seed      # adds 10 sample products
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other useful scripts

```bash
npm run db:studio    # Prisma Studio, a GUI for browsing/editing the database
npm run build         # production build
npm run lint          # ESLint
```

## Project structure

```
app/                     Routes (App Router)
  products/               Catalog listing + product detail
  cart/                   Cart page
  checkout/                Checkout form → payment → return/success/failed
  admin/orders/            Admin order list (see security note below)
  api/
    orders/                 Create/read orders
    payments/                Create/attach PayMongo payment intents, mock confirm
    webhooks/paymongo/       Real PayMongo webhook receiver
components/               Reusable UI (ProductCard, CartItemRow, etc.)
lib/                      Data access (Prisma), cart context, PayMongo client, money formatting
prisma/                   schema.prisma, migrations, seed script
```

## How the cart works

The cart is **not** Redux — it's a small React Context (`lib/cart-context.tsx`)
backed by `localStorage`, so it survives page reloads without needing a
backend session. The header's cart icon and the cart page both read from this
context.

## How checkout & payments work

1. **Checkout page** (`/checkout`) collects name, email, phone, and delivery
   address, and shows an order summary. Submitting creates an `Order` row
   (status `PENDING`) with a server-side re-priced, stock-checked snapshot of
   the cart — the server never trusts client-supplied prices.
2. **Payment page** (`/checkout/[orderId]/pay`) lets the customer choose
   GCash, Maya, or Card. Submitting calls `/api/payments/create-intent`,
   which creates a PayMongo Payment Intent, creates a Payment Method, and
   attaches it — or runs the mock equivalent if no API keys are configured.
3. For GCash/Maya (and 3D-Secure card payments), PayMongo returns a redirect
   URL the customer must authorize on. In **mock mode**, the customer is
   instead sent to `/checkout/[orderId]/mock-gateway`, a fake "approve /
   decline" screen standing in for that hosted page.
4. **Order status is only ever changed by server code that trusts PayMongo**
   (or, in mock mode, the mock-confirm endpoint) — never by the client
   directly. The real webhook (`/api/webhooks/paymongo`) is the source of
   truth in production; `/checkout/[orderId]/return` also polls
   `GET /api/orders/[id]`, which proactively re-checks the Payment Intent
   status with PayMongo as a fallback in case the webhook hasn't arrived yet
   (useful for local dev, where PayMongo can't reach `localhost`).
5. **Success/failed pages** (`/checkout/success`, `/checkout/failed`) show
   the outcome; the failed page links back to the payment page to retry with
   the same order.
6. Product **stock is decremented only once an order is marked `PAID`**
   (`lib/orders.ts` → `markOrderPaid`), inside a transaction, and only once
   (safe to call again for the same order — webhook retries, etc.).

## Testing payments

### Mock mode (default, no PayMongo account needed)

Leave `PAYMONGO_SECRET_KEY` / `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` blank in
`.env`. Add something to your cart, check out, pick any payment method, and
you'll land on a simulated gateway screen with "Simulate successful payment"
/ "Simulate declined payment" buttons.

### Real PayMongo sandbox

1. Create a free account at [paymongo.com](https://www.paymongo.com/) (no
   business verification needed for test mode).
2. In the [Dashboard](https://dashboard.paymongo.com/), make sure the
   **Test mode** toggle (top-left) is on.
3. Go to **Developers → API Keys** and copy the **Secret key** and
   **Public key** (both start with `sk_test_` / `pk_test_`).
4. Put them in `.env`:
   ```
   PAYMONGO_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY="pk_test_..."
   ```
5. Restart the dev server. The payment page will now hit PayMongo's real
   sandbox API. Use PayMongo's [test card numbers](https://developers.paymongo.com/docs/testing)
   (e.g. `4343 4343 4343 4345`, any future expiry, any CVC) — GCash and Maya
   in test mode show a simulated authorization page hosted by PayMongo
   itself.
6. To receive real webhook events locally, PayMongo needs a public URL to
   call. Use a tunnel (e.g. `ngrok http 3000`) and register
   `https://<your-tunnel>/api/webhooks/paymongo` under **Developers →
   Webhooks**, subscribed to at least `payment.paid` and `payment.failed`.
   Copy the webhook's signing secret into `PAYMONGO_WEBHOOK_SECRET`.

   Without this, payments still work end-to-end thanks to the fallback poll
   described above — but the webhook path itself only gets exercised once
   you've wired up a real endpoint.

## Before going live

This project is a demo. At minimum, before using it with real customers or
real money:

- **Use real (live) PayMongo API keys**, not sandbox ones, and store them as
  proper deployment secrets (e.g. Vercel Environment Variables) — never
  commit `.env`.
- **Verify the webhook signature scheme against PayMongo's current docs.**
  `lib/paymongo.ts` → `verifyWebhookSignature` implements a best-effort,
  defensive version of PayMongo's `Paymongo-Signature` header check because a
  fully worked example wasn't available while writing this. Confirm the
  exact algorithm against
  [PayMongo's webhook docs](https://docs.paymongo.com/docs/developer-tools-webhooks-key-concepts)
  and simplify/correct the function before depending on it.
- **Add authentication to `/admin/orders`.** It currently has none — anyone
  with the URL can see every customer's name, email, phone, address, and
  order history. Put it behind real auth (NextAuth, Clerk, a middleware
  password gate, etc.) before deploying anywhere reachable by the public.
- **Switch from SQLite to a production database** (Postgres is the easiest
  swap). SQLite is a single local file, which doesn't work well with
  serverless/multi-instance hosting like Vercel (no shared, persistent
  filesystem across invocations). To switch:
  1. Change `provider = "sqlite"` to `provider = "postgresql"` in
     `prisma/schema.prisma`.
  2. Point `DATABASE_URL` at your Postgres instance.
  3. Swap the driver adapter in `lib/prisma.ts` and `prisma.config.ts` from
     `@prisma/adapter-better-sqlite3` to `@prisma/adapter-pg` (`npm install
     @prisma/adapter-pg pg`), and update the adapter construction accordingly.
  4. Re-run `npx prisma migrate dev`.
- **Add proper error monitoring/logging** (e.g. Sentry) — the current code
  only `console.error`s.
- **Add rate limiting** to the order/payment API routes to prevent abuse.
- **Add a real order-confirmation email** — none is sent in this demo.

## Notes on the tech choices

- **Prisma 7** changed how the client is generated and connected: the
  connection string is no longer read from `schema.prisma` — instead the
  app constructs an explicit driver adapter at runtime
  (`@prisma/adapter-better-sqlite3` here). See `lib/prisma.ts`,
  `prisma.config.ts`, and `lib/db-url.ts` for details and why `lib/db-url.ts`
  exists (the Prisma CLI and the raw driver adapter resolve relative sqlite
  paths differently, so it's resolved to an absolute path once and reused).
- Product images are locally-generated SVG placeholders under
  `public/products/` (no external image host dependency) — swap them for
  real product photos any time.

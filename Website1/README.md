# Seoul Stop Kmart

A Korean grocery storefront for Cebu, Philippines — product catalog, cart,
checkout with Cebu delivery details, GCash/Maya/card payments via PayMongo
(sandbox by default), cash-on-delivery and bank-transfer options, and a
role-based admin dashboard for managing products, orders, and staff. Built
with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Prisma + SQLite.

Facebook: https://www.facebook.com/seoulstopkmart

This started from a generic ecommerce template and has been rebranded and
extended for this business. Read **"Before going live"** at the bottom
before using this with real customers or real money.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma 7 + SQLite (via a driver adapter — see note below), easy to swap for Postgres
- NextAuth (Credentials provider, JWT sessions) for admin authentication
- PayMongo Payment Intent + Payment Method API, with a built-in mock fallback, plus COD/bank transfer
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

The defaults work out of the box for local development. Open `.env.example`
for a description of every variable. Notably:

- Leave the PayMongo keys blank to use the built-in **mock payment flow**.
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` are required for admin login to work —
  a dev secret is pre-filled in `.env`; generate a fresh one for production
  with `openssl rand -base64 32`.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` control the one OWNER account
  created by the seed script — **change this password after your first
  login** (Staff accounts page is not yet self-service for password
  changes; update it via `/admin/staff` → edit, or Prisma Studio, until
  a "change my password" screen is added).

### 3. Set up the database

```bash
npm run db:migrate   # creates prisma/dev.db and applies the schema
npm run db:seed      # adds demo products + the initial OWNER admin account
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront, and
[http://localhost:3000/admin/login](http://localhost:3000/admin/login) for
the admin dashboard (sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
you set in `.env`).

### Other useful scripts

```bash
npm run db:studio    # Prisma Studio, a GUI for browsing/editing the database
npm run build         # production build
npm run lint          # ESLint
```

## Project structure

```
app/                     Routes (App Router)
  products/               Catalog listing (search/filter/sort) + product detail
  cart/                   Cart page
  checkout/                Checkout form → payment → return/success/failed/order-placed
  admin/                   Role-gated dashboard: orders, products, staff accounts
    login/                 Staff sign-in (public)
  api/
    orders/                 Create/read orders
    payments/                Create/attach PayMongo payment intents, mock confirm
    webhooks/paymongo/       Real PayMongo webhook receiver
    admin/                   Admin-only APIs (products, orders, users) — see below
    auth/[...nextauth]/      NextAuth handler
components/               Reusable UI (ProductCard, CartItemRow, etc.) + components/admin/
lib/                      Data access (Prisma), cart context, auth, PayMongo client, money formatting
prisma/                   schema.prisma, migrations, seed script
middleware.ts             Gatekeeper for every /admin page and /api/admin/* route
```

## Roles & admin access

Three roles, enforced **server-side** on every privileged API route (never
just hidden in the UI) via `lib/authz.ts` → `requireRole()`:

| Role    | Can do |
|---------|--------|
| Staff   | View and process orders (status, payment status for COD/bank transfer, internal notes) |
| Manager | Everything Staff can, plus manage products (add/edit/delete, images, pricing, stock, featured/best-seller flags) |
| Owner   | Everything Manager can, plus create/manage staff accounts and roles |

`middleware.ts` blocks every `/admin/**` page and `/api/admin/**` route for
unauthenticated requests; each route additionally checks the caller's role
before making changes.

## How the cart works

The cart is **not** Redux — it's a small React Context (`lib/cart-context.tsx`)
backed by `localStorage`, so it survives page reloads without needing a
backend session. The header's cart icon and the cart page both read from this
context.

## How checkout & payments work

1. **Checkout page** (`/checkout`) collects name, mobile number, email, and a
   full Cebu delivery address (house/street, barangay, city, province,
   postal code, delivery notes), plus an order summary. Submitting creates
   an `Order` row (fulfillment status `PENDING`, payment status `PENDING`)
   with a server-side re-priced, stock-checked snapshot of the cart — the
   server never trusts client-supplied prices or availability.
2. **Payment page** (`/checkout/[orderId]/pay`) lets the customer choose
   GCash, Maya, Card, Cash on Delivery, or Bank Transfer.
   - GCash/Maya/Card go through `/api/payments/create-intent`, which creates
     a PayMongo Payment Intent + Payment Method and attaches it — or runs
     the mock equivalent if no API keys are configured — then lands on
     `/checkout/[orderId]/return`, which polls until payment is confirmed.
   - Cash on Delivery / Bank Transfer never touch PayMongo. They go straight
     to `/checkout/[orderId]/order-placed`, which deliberately does **not**
     say "payment successful" — payment status stays `PENDING` until a
     staff member manually confirms funds were received in the admin
     dashboard (bank transfer) or the rider collects cash (COD).
3. **`orderStatus` (fulfillment) and `paymentStatus` are tracked as
   separate fields** on `Order` — an order can be `CONFIRMED`/`PREPARING`
   while payment is still `PENDING` (COD). Payment status for gateway
   methods (GCash/Maya/card) is only ever set by verified PayMongo events
   (webhook, or the return-page fallback poll) — staff cannot edit it for
   those orders; the admin order screen disables that dropdown and explains
   why.
4. Product **stock is decremented only once payment is marked PAID**
   (`lib/orders.ts` → `markOrderPaid`), inside a transaction, and only once
   (safe to call again — webhook retries, staff re-confirming, etc.).

## Product image storage

Admin-uploaded product images are optimized with `sharp` (resized, converted
to WebP) and saved to `public/uploads/products/` on the local filesystem —
no cloud storage bucket is configured. This works for local development and
single-instance hosting, but **will not persist across deploys/instances on
serverless platforms like Vercel** (same caveat as the SQLite note below).
Before deploying to serverless infrastructure, swap
`app/api/admin/products/upload-image/route.ts` for an upload to S3,
Cloudinary, or Vercel Blob, and update the returned `imageUrl` accordingly.

## Seed data

`prisma/seed.ts` creates a small set of **demo** Korean-grocery-style
products (generic descriptions, locally-generated placeholder images under
`public/products/`) so the storefront isn't empty on first run — this is
not real inventory. Add your actual catalog via `/admin/products` once
you're ready; delete or edit the demo products from the same screen.

## Branding

- Logo: `public/brand/logo.png` (trimmed/web-sized) and
  `public/brand/logo-original.png` (full-resolution source), derived from
  `public/Assets/SEOUL STOP KMART.png`. Favicon/app icons are in
  `public/brand/icon-*.png`.
- Brand colors (sampled from the logo) live in `tailwind.config.ts` under
  `theme.extend.colors.brand` (`brand-red`, `brand-red-dark`, `brand-gold`,
  `brand-gold-dark`, `brand-black`) and are used via Tailwind classes like
  `bg-brand-red`.
- Business facts referenced across the site (Facebook URL, contact email/
  phone, delivery area, business hours, bank transfer details) are centralized
  in `lib/store-config.ts` — update them there. `CONTACT_EMAIL`,
  `CONTACT_PHONE`, and the bank transfer account details are **placeholders**
  and should be replaced with real values before launch.

## Testing payments

### Mock mode (default, no PayMongo account needed)

Leave `PAYMONGO_SECRET_KEY` / `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` blank in
`.env`. Add something to your cart, check out, pick GCash/Maya/Card, and
you'll land on a simulated gateway screen with "Simulate successful payment"
/ "Simulate declined payment" buttons. COD and Bank Transfer skip the
gateway entirely (see above).

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
   sandbox API for GCash/Maya/Card. Use PayMongo's
   [test card numbers](https://developers.paymongo.com/docs/testing)
   (e.g. `4343 4343 4343 4345`, any future expiry, any CVC).
6. To receive real webhook events locally, PayMongo needs a public URL to
   call. Use a tunnel (e.g. `ngrok http 3000`) and register
   `https://<your-tunnel>/api/webhooks/paymongo` under **Developers →
   Webhooks**, subscribed to at least `payment.paid` and `payment.failed`.
   Copy the webhook's signing secret into `PAYMONGO_WEBHOOK_SECRET`.

   Without this, payments still work end-to-end thanks to the fallback poll
   described above — but the webhook path itself only gets exercised once
   you've wired up a real endpoint.

## Before going live

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
- **Generate a fresh `NEXTAUTH_SECRET`** for production (`openssl rand -base64 32`)
  and set `NEXTAUTH_URL` to your real domain. Change the seeded owner
  password immediately.
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
- **Move product image uploads to real cloud storage** (S3/Cloudinary/Vercel
  Blob) — see "Product image storage" above.
- **Replace the placeholder contact/bank-transfer details** in
  `lib/store-config.ts` with real ones.
- **Add proper error monitoring/logging** (e.g. Sentry) — the current code
  only `console.error`s.
- **Add rate limiting** to the order/payment/auth API routes to prevent abuse.
- **Add a real order-confirmation email** — none is sent currently.
- **Consider upgrading Next.js** off 14.2.35 — `npm audit` currently flags
  several high-severity advisories fixed in later major versions; staying on
  14 was a deliberate choice to avoid a breaking framework upgrade alongside
  this rebrand, but it should be revisited before a public launch.

## Notes on the tech choices

- **Prisma 7** changed how the client is generated and connected: the
  connection string is no longer read from `schema.prisma` — instead the
  app constructs an explicit driver adapter at runtime
  (`@prisma/adapter-better-sqlite3` here). See `lib/prisma.ts`,
  `prisma.config.ts`, and `lib/db-url.ts` for details and why `lib/db-url.ts`
  exists (the Prisma CLI and the raw driver adapter resolve relative sqlite
  paths differently, so it's resolved to an absolute path once and reused).
- **NextAuth v4** (not v5/Auth.js) was chosen for compatibility with Next.js
  14's App Router without extra beta dependencies. Sessions are JWT-based —
  no `Session`/`Account` database tables needed, just the `User` model.

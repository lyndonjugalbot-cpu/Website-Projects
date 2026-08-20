# Deployment Guide

## Recommended target: Vercel + managed Postgres

1. **Database**: provision a Postgres instance (Neon, Supabase, or Vercel Postgres all work well
   with Prisma). Copy the connection string into `DATABASE_URL`.
2. **Object storage**: create two S3-compatible buckets (AWS S3 or Cloudflare R2):
   - `wots-tcg-vault-listing-images` — public read, used for listing photos.
   - `wots-tcg-vault-identity-documents` — **private**, no public read policy. Only the app's
     service credentials should be able to read/write it.
3. **Stripe**: see `docs/PAYMENTS.md` §5 for the full payments-specific checklist (webhook event
   list, Connect setup, live-vs-test-mode verification). In short: create a Stripe account, enable
   Connect (Express accounts), add `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`, register the
   webhook endpoint and copy `STRIPE_WEBHOOK_SECRET`.
4. **Facebook Login**: create a Meta for Developers app, add the Facebook Login product, set the
   OAuth redirect URI to `https://yourdomain/api/auth/callback/facebook`, and copy the App
   ID/Secret into `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`.
5. **Email**: create a Resend account, verify your sending domain, set `RESEND_API_KEY` and
   `EMAIL_FROM`.
6. **Scheduled jobs**: set `CRON_SECRET` to a strong random value. On Vercel, `vercel.json` in the
   repo root already declares the two payment cron jobs — Vercel calls them automatically with the
   right bearer token once `CRON_SECRET` is set as an env var. On any other host, point a
   scheduler at `POST /api/cron/release-payouts` and `POST /api/cron/cleanup-reservations` — see
   `docs/PAYMENTS.md` §3.
7. **Environment variables**: copy `.env.example` to your hosting provider's environment variable
   settings — see that file for the full list.

## Build & release steps

```bash
npm install
npx prisma migrate deploy   # applies committed migrations to the target database
npm run build
npm start                   # or let Vercel run this for you
```

Run `npx prisma db seed` (or `npm run db:seed`) once against a fresh environment only if you want
demo data — do **not** run it against a production database with real users.

## Post-deploy checklist

- [ ] Confirm the Stripe webhook is receiving events (Stripe dashboard → Webhooks → recent
      deliveries).
- [ ] Confirm the cron jobs are firing (check `/api/cron/release-payouts` logs/response after its
      first scheduled run, or trigger it manually with the `CRON_SECRET`).
- [ ] Manually walk through: register → verify email → connect Facebook → submit ID → (admin)
      approve → create listing → (admin) approve listing → buy as a second account → ship with
      tracking → confirm delivery → wait for (or manually trigger) the inspection-period sweep →
      payout appears in `/admin/payouts`.
- [ ] Promote your own account to `SUPER_ADMIN` directly in the database (there is intentionally
      no self-service "become admin" flow):
      ```sql
      UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
      ```
- [ ] Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to the real production domain (not localhost).
- [ ] Point DNS, then re-verify the Stripe Connect `refresh_url`/`return_url` and Facebook OAuth
      redirect URI match the production domain exactly.
- [ ] Review docs/SECURITY.md's "required before production launch" list.
- [ ] Get legal sign-off per docs/LEGAL.md before accepting real sellers/payments.

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL — a local docker postgres works:
docker run -d --name wots-postgres -e POSTGRES_USER=wots -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=wots_tcg_vault -p 5432:5432 postgres:16-alpine

npm install
npx prisma migrate dev
npm run db:seed        # optional demo data — see console output for demo logins
npm run dev
```

Stripe, Facebook, S3, and Resend all have graceful "not configured" fallbacks in development
(clear 503 errors / console-logged emails) so you can develop the rest of the app without live
credentials for those services — see the "External services" section of the README.

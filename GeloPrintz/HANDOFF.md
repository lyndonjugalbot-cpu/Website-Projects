# Handing the AV Toys site to someone else

The site is static files on **Vercel**, with a **Supabase** project behind the
customer reviews and a **Resend** account for review-notification emails.
Transferring ownership means moving those accounts. None of it holds much data,
so this is an afternoon, not a migration project.

## What exists

| Piece | What it holds | Where |
|---|---|---|
| GitHub repo | all the site code | currently in the `Website-Projects` monorepo, `GeloPrintz/` folder |
| Vercel project `gelo-printz` | hosting + the `/api/notify` function + its env vars | your Vercel account |
| Supabase project | reviews database + `review-photos` storage bucket + the admin login user | your Supabase account |
| Resend account | sends the "new review" emails | your Resend account |
| Domain | currently just `gelo-printz.vercel.app` | n/a |

## Recommended order

1. **Split the site into its own repo.** Copy `GeloPrintz/` into a fresh repo
   (e.g. `avtoys-site`) so the new owner isn't inheriting unrelated projects,
   then **GitHub → Settings → Transfer ownership** to them.
2. **New owner creates a Vercel account**, imports that repo → new project
   (framework preset: **Other**, root directory: the repo root).
3. **Transfer the Supabase project.** Supabase dashboard → **Project Settings →
   General → Transfer project** → into the new owner's Supabase organisation
   (their org needs a paid plan to receive it). The project URL and API keys
   **do not change**, so nothing in the code needs editing for this step.
   *Alternative if you don't want to transfer:* the new owner makes their own
   Supabase project, runs `supabase/schema.sql` in it, and you move the data:
   - `pg_dump` your DB → they `pg_restore` into theirs
   - copy the files in the `review-photos` bucket to theirs (Storage UI, or the
     `list` + `download` + `upload` API)
   - they update `assets/js/config.js` with their URL + publishable key
4. **New owner sets the Vercel env vars** (`RESEND_API_KEY`, `WEBHOOK_SECRET`,
   `SUPABASE_URL`, `NOTIFY_TO`) with their own values — see
   `supabase/README.md`. They make their own **Resend** account + API key.
5. **Re-point the Supabase webhook** (Database → Webhooks) at the new Vercel
   URL, with the new `WEBHOOK_SECRET` value in the `x-webhook-secret` header.
6. **Admin login:** either transfer moves the existing auth user with it (project
   transfer does), or the new owner adds their own user (Authentication → Users).
7. **Domain:** if still on `*.vercel.app`, the URL changes — update the
   Instagram bio and any links/QR codes. If you register a real domain
   (`avtoys.com`), put it in an account the business owns and just move DNS.
8. **You** delete the old Vercel project and, if you didn't transfer it, the old
   Supabase project — once the new setup is confirmed working.

## Design choices that keep this easy

- `assets/js/config.js` is the **only** place the Supabase URL + key live.
- The database stores the photo **path**, not a full URL, so moving the storage
  bucket doesn't require rewriting rows.
- All secrets are Vercel env vars, never in the repo.
- `supabase/schema.sql` reproduces the whole database from scratch.

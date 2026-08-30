# AV Toys reviews — backend setup

The review system uses **Supabase** (database + photo storage) and one small
**Vercel function** for the "new review" email. One-time setup:

## 1. Database + storage  (Supabase dashboard)

1. Open the project → **SQL Editor** → **New query**.
2. Paste all of [`schema.sql`](./schema.sql) and click **Run**.
   This creates the `reviews` table, the Row Level Security policies, and the
   public `review-photos` storage bucket.

## 2. Admin login  (Supabase dashboard)

1. **Authentication → Users → Add user** → enter the email + password you want
   for moderating. Tick "Auto confirm user".
2. **Authentication → Providers → Email** → turn **"Allow new users to sign up"
   OFF** (so nobody else can create an account).
3. The moderation page is **`/admin`** on the site. Sign in there with that
   email + password. Approve / reject / delete reviews; approved ones show on
   the site right away.

## 3. Email on every new review  (Resend + Vercel + Supabase webhook)

**a. Resend** — make a free account at <https://resend.com> (sign up with
`avtoys26@gmail.com` so test sends reach you without verifying a domain).
Copy an **API key**.

**b. Vercel** — project → **Settings → Environment Variables**, add:

| Name             | Value                                             |
|------------------|---------------------------------------------------|
| `RESEND_API_KEY` | the Resend API key                                |
| `WEBHOOK_SECRET` | any long random string (make one up)              |
| `SUPABASE_URL`   | `https://ybidbolicepyatbtrozw.supabase.co`        |
| `NOTIFY_TO`      | `avtoys26@gmail.com` (optional, this is default)  |

Redeploy so the function picks them up.

**c. Supabase webhook** — dashboard → **Database → Webhooks → Enable webhooks**
→ **Create a new hook**:

- Table: `public.reviews`
- Events: **Insert**
- Type: **HTTP Request**, method **POST**
- URL: `https://gelo-printz.vercel.app/api/notify`
- HTTP Headers: add `x-webhook-secret` = the same value as `WEBHOOK_SECRET`

Submit a test review on `/review` — you should get an email, and the review
should appear in the **Pending** tab of `/admin`.

## Front-end config

`assets/js/config.js` holds the Supabase URL + publishable key (safe to be
public — RLS limits what it can do). Changing Supabase projects = change those
two values. See [`../HANDOFF.md`](../HANDOFF.md).

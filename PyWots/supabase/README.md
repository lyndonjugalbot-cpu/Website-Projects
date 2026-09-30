# Wiring PyWots to Supabase (accounts + paid access)

With no keys set, PyWots runs open and local-only (that's `npm run dev` out of
the box). Once the two `VITE_SUPABASE_*` variables are set, it becomes the paid
app: **sign in → redeem a 12-month code → play**. Codes come from Etsy orders
through the `/claim` page.

Setup is one pass through the steps below. Everything that needs a secret
happens in the Supabase dashboard or the Supabase CLI, never in the app.

---

## 1. Create the project and the database

1. New project at [supabase.com](https://supabase.com).
2. **Database → SQL Editor → New query**, paste `schema.sql`, **Run**.
   It's safe to re-run. It creates:
   - `profiles` (the save), with RLS, the signup trigger and `delete_user()`
   - the paid-access tables: `entitlements`, `access_codes`, `etsy_claims`,
     `rate_limits`, `etsy_auth`, `etsy_oauth_states`
   - `redeem_access_code()` (called by the app) and `issue_access_codes()`
     (called by the `claim` function, or by you from the SQL editor)

## 2. Auth settings

**Authentication → Providers**

| Provider | Setting |
|---|---|
| **Email** | ON. Leave **"Confirm email" OFF** until custom SMTP is set up (below). With it ON, the app asks the buyer to confirm, then sign in. |
| **Anonymous sign-ins** | **OFF.** PyWots is paid now; there are no guests. |
| **Google / Apple** | Optional. Set them up as below, then list them in `VITE_OAUTH_PROVIDERS` so the buttons appear. |

Google: create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(Web application) with the redirect URI `https://<PROJECT-REF>.supabase.co/auth/v1/callback`,
and paste the client ID and secret into Supabase.
Apple: needs an Apple Developer account (a Services ID + a Sign in with Apple key),
with the same return URL.

**Authentication → Emails → SMTP Settings (custom SMTP)**

Supabase's built-in email only sends to members of your Supabase organization,
and only 2 an hour. Buyers get **no** password-reset (or confirmation) emails
until you add your own SMTP. Resend works (it's already used for
WotsBudgetTracker): host `smtp.resend.com`, port `465`, username `resend`,
password = a Resend API key, sender = an address on a domain you've verified in
Resend. Then raise the email limit under **Authentication → Rate Limits** (it
starts at 30 an hour), and you can turn "Confirm email" on.

**Authentication → URL Configuration**

- **Site URL:** `https://pywots.vercel.app` (confirmation and password-reset
  emails link here).
- **Redirect URLs:** add all three:
  ```
  http://localhost:5173
  https://pywots.vercel.app
  pywots://auth-callback
  ```

## 3. App environment variables

Set these in **Vercel → `pywots` → Settings → Environment Variables** (Production,
Preview and Development) and in `PyWots/.env.local` for local dev:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<PROJECT-REF>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`), or the legacy anon key on older projects. It's meant to be public. |
| `VITE_ETSY_LISTING_URL` | the Etsy listing URL, once it's live. Shows "Get 12 months on Etsy" links. |
| `VITE_OAUTH_PROVIDERS` | optional: `google`, `apple` or `google,apple` |
| `VITE_SITE_URL` | optional, defaults to `https://pywots.vercel.app`. The native app links here for `/claim`. |

Never put a secret key (`sb_secret_…` / `service_role`) in the app.

Redeploy after setting them (`vercel --prod` from `PyWots/`). From that deploy
on, the site asks everyone to sign in.

## 4. Etsy: claim codes with an order number

The shop's existing Etsy app (`wotsdev-order-fulfilment`, the one
WotsBudgetTracker uses) works here too. PyWots keeps its own token copy in its
own database, so the two apps don't depend on each other.

**a. Register the callback URL.** In the Etsy developer portal (Your Apps → the
app → edit), add this callback URL alongside the WotsBudgetTracker one:

```
https://<PROJECT-REF>.supabase.co/functions/v1/etsy-oauth
```

**b. Set the function secrets** (Supabase CLI, from `PyWots/`):

```bash
supabase login
supabase secrets set --project-ref <PROJECT-REF> \
  ETSY_API_KEY=<app keystring> \
  ETSY_SHARED_SECRET=<app shared secret> \
  ETSY_SHOP_ID=68256965 \
  ETSY_LISTING_IDS=<PyWots listing id> \
  ETSY_OAUTH_SETUP_SECRET=<a long random string, 16+ characters>
```

`ETSY_LISTING_IDS` is the number in the listing URL
(`etsy.com/listing/<this>/…`). It takes a comma-separated list, so a relisted or
second PyWots listing can be added later. Items from other listings in the same
order (e.g. WotsBudgetTracker) are ignored.

**c. Deploy the two functions.** Both are public endpoints: `claim` is used
signed out, and Etsy calls `etsy-oauth` directly.

```bash
supabase functions deploy claim etsy-oauth --project-ref <PROJECT-REF> --no-verify-jwt --use-api
```

`--use-api` bundles on Supabase's side, so Docker isn't needed. The functions
read the project's secret key from `SUPABASE_SECRET_KEYS` (new projects) or
`SUPABASE_SERVICE_ROLE_KEY` (older ones); Supabase provides both automatically.

**d. Connect the shop (once).** Signed in to Etsy as the shop owner, open:

```
https://<PROJECT-REF>.supabase.co/functions/v1/etsy-oauth?secret=<ETSY_OAUTH_SETUP_SECRET>
```

Approve, and the page says "Etsy connected."

**e. Keep it connected.** Etsy refresh tokens expire after about 90 days
without use. Every claim refreshes them, but a daily job covers quiet spells.
Enable **pg_cron** and **pg_net** (Database → Extensions), then run in the SQL
editor:

```sql
select cron.schedule('etsy-token-refresh', '0 3 * * *', $$
  select net.http_get('https://<PROJECT-REF>.supabase.co/functions/v1/etsy-oauth?action=refresh&secret=<ETSY_OAUTH_SETUP_SECRET>');
$$);
```

If the connection ever lapses, claims fail with "We couldn't reach Etsy." Run
step d again to fix it.

## 5. Check it end to end

1. SQL editor: `select public.issue_access_codes(1);` gives you a test code.
2. Open the site, create an account, redeem the code. You're in, and
   Hunter → Account shows "Active until …".
3. `/claim` with a real PyWots order number and the buyer's email should show
   its code(s). A second claim of the same order says "already claimed".

## 6. Running it

```sql
-- codes for gifts, giveaways or support (each is 12 months, redeemable for a year)
select public.issue_access_codes(3);

-- what an order got, and whether it's been used
select code, redeemed_by, redeemed_at, revoked
from public.access_codes where etsy_receipt_id = '<order number>';

-- cancel a code (e.g. after a refund)
update public.access_codes set revoked = true where code = 'PY12-XXXX-XXXX';

-- give someone 12 months directly (stacks on any time they have left)
insert into public.entitlements (user_id, access_expires_at, plan)
select id, now() + interval '365 days', '12m' from auth.users where email = 'someone@example.com'
on conflict (user_id) do update
  set access_expires_at = greatest(now(), entitlements.access_expires_at) + interval '365 days';

-- who's active
select count(*) from public.entitlements where access_expires_at > now();
```

**People who played before the paywall** have progress on their own device
only. When they sign in, that progress moves into their new account, but they
still need a code. To look after them, send them codes from `issue_access_codes`.

## 7. How progress moves around

- The save lives on the device and syncs to `profiles.state` on a short
  debounce. An unsynced local copy always wins, so a device that was offline
  never loses work. Otherwise the newer `updated_at` wins.
- Signing in on another device or in the native app pulls the same save.
- Access is read from `entitlements` when the app opens and whenever it comes
  back to the foreground, and the last known value is cached. A paying user
  who opens PyWots offline isn't locked out; a first-ever open needs a connection.

## 8. What the server enforces, and what it doesn't

Enforced in Postgres (see `supabase/tests/access.test.mjs`):

- Codes are generated server-side from a secure RNG. Clients can't read,
  create or edit codes, claims, tokens or anyone's entitlement.
- A code works once, only for a signed-in (non-anonymous) account, within a
  year of being issued. Redeeming is limited to 10 attempts an hour per user.
- An Etsy order can be claimed once. The `claim` function also checks the
  order is paid and not refunded, and that the buyer email matches. Claims are
  limited to 5 per IP and 5 per order every 15 minutes.

Not enforced: the curriculum is in the app bundle, so the paywall is a lock on
the app, not on the content. Someone technical could get around it. Moving the
day content behind an access-checked API would close that gap.

## 9. Queries

```sql
-- active in the last 7 days
select count(*) from profiles where last_active_at > now() - interval '7 days';
-- how far people get
select day, count(*) from profiles group by day order by day;
-- rank distribution
select rank, count(*) from profiles group by rank;
```

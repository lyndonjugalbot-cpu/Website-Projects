# Wiring PyWots to Supabase

Accounts and cross-device sync are **optional**. With no keys set, PyWots runs
exactly as before — local-only, per-device. Add the two env vars and it becomes
local-first with a cloud backup that follows the user.

## 1. Create the project

New project at [supabase.com](https://supabase.com). Then **Database → SQL
Editor → New query**, paste `schema.sql`, Run. That creates `public.profiles`,
the RLS policies, the signup trigger, and `delete_user()`.

## 2. Auth providers

**Authentication → Providers**

| Provider | What to do |
|---|---|
| **Anonymous sign-ins** | Turn ON. This is what gives every first-time user a durable account with no signup form. |
| **Email** | ON (default). "Confirm email" optional — if ON, registering shows a "check your inbox" state. |
| **Google** | Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Web application). Authorized redirect URI: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`. Paste client ID + secret into Supabase. For the **iOS app** also create an **iOS** OAuth client and put its reversed client ID in the Capacitor Google plugin config. |
| **Apple** | Needs an Apple Developer account. Create a **Services ID** + **Sign in with Apple key**; configure them in Supabase. Add `https://<PROJECT-REF>.supabase.co/auth/v1/callback` as the return URL. Native iOS uses the app's own bundle ID (`app.pywots`) via the Apple Sign-In plugin — no Services ID needed for the native path, but you still enable the provider here. |

**Authentication → URL Configuration → Redirect URLs** — add all three:

```
http://localhost:5173
https://pywots.vercel.app
pywots://auth-callback
```

**Authentication → Settings** — enable **"Allow manual linking"** (lets an
anonymous user attach Google/Apple without losing progress).

## 3. Environment variables

`PyWots/.env.local` (git-ignored) for local dev:

```
VITE_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon / public key>
```

Same two in **Vercel → the `pywots` project → Settings → Environment Variables**,
for Production, Preview and Development. The anon key is meant to be public — RLS
is what protects the data. The `service_role` key must never be in client code.

## 4. How progress moves around

- **First launch:** anonymous session, a `profiles` row is created, progress
  syncs to it. Nothing asked of the user.
- **Register email** (from the Account panel, or the prompt after Day 3): the
  email is linked onto the *same* anonymous user — same id, same row, progress
  intact.
- **Sign in on another device / the iOS app:** same account → same row → same
  progress. The local copy always wins if it has unsynced changes (a device
  that was offline never loses work); otherwise the newer `updated_at` wins.
- **Known edge:** linking **Google/Apple** to an existing *anonymous* account
  works cleanly on web (`linkIdentity`). On native iOS the id-token flow can
  create a fresh user instead of linking; progress is carried by the
  "local-unsynced-wins" rule (the guest blob flows into the new empty row on
  first sign-in). Registering with **email** first always links in place.

## 5. Queries you can now run

```sql
-- active in the last 7 days
select count(*) from profiles where last_active_at > now() - interval '7 days';
-- how far people get
select day, count(*) from profiles group by day order by day;
-- rank distribution
select rank, count(*) from profiles group by rank;
```

## 6. Before charging money

Nothing is paywalled today. If that changes, entitlement must be decided
server-side (a `is_pro` column the client can't write, set by a Stripe webhook
on web and RevenueCat on iOS) — never trust client state for it.

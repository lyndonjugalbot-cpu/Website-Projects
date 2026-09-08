# Wiring SelfLeveling to Supabase

## 1. Create the project

New project at supabase.com, then open **Database → SQL Editor** and run
`schema.sql`. It creates the `profiles` table, row level security policies, and
a trigger that creates a profile row the moment a user signs up.

Then go to **Authentication → Providers** and turn on **Anonymous sign-ins**.

## 2. Install and configure

```bash
npm install @supabase/supabase-js
```

`.env.local` in the project root:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Add the same two variables in Vercel under **Settings → Environment Variables**,
for Production, Preview and Development. Vite only exposes variables prefixed
`VITE_`; on Next.js rename both to `NEXT_PUBLIC_` and swap `import.meta.env` for
`process.env` in `lib/supabase.js`.

The anon key is safe in client code. Row level security is what protects the
data. The `service_role` key never leaves a server.

## 3. The change to SelfLeveling.jsx

Delete the whole `/* ---- storage ---- */` block — the `mem` object and the
`store` constant, roughly lines 10–45 — and put this in its place:

```js
import { store } from "./lib/persistence";
```

Keep `const SAVE_KEY = "selfleveling:save";` where it is. Nothing else in the
component changes: `store.get` and `store.set` have the same signatures they
had before.

## 4. What you get

- **No signup wall.** Anonymous auth gives each user a real, durable account on
  first launch. Their progress is server-side from day one, before they've given
  you anything.
- **Cheap writes.** Ticking six quests is one database round trip, not six —
  writes are debounced 900ms and flushed when the tab is hidden.
- **Works offline.** No network, no keys, or a failed sign-in and the app runs
  local-only, then syncs when it next connects.
- **Queryable metrics.** `xp`, `level`, `streak`, `is_pro` and `last_active_at`
  are kept as real columns alongside the JSONB blob, so retention and conversion
  queries don't have to parse JSON.

## 5. When they want their account on a second device

Anonymous users can claim their account without losing anything — same user id,
same row:

```js
await supabase.auth.updateUser({ email, password });
```

Prompt for this after the first cleared week, not before. Someone who has just
finished day seven has a reason to protect their streak; someone on the welcome
screen doesn't.

## 6. Before you take money

The `pro` flag currently lives in client state, which means anyone can flip it
from the console. That's fine while nothing is charged. Once billing is real,
entitlement has to be decided server-side:

- **Web:** Stripe Checkout plus a webhook that writes `is_pro` from a Supabase
  Edge Function. Never let the client set that column — drop it from the update
  policy with a column grant.
- **iOS/Android via Capacitor:** RevenueCat is the shortest path. It handles
  receipt validation and gives you a webhook to the same Edge Function.

Both leave `is_pro` as the single source of truth the app reads.

## 7. Worth knowing

The whole save is one JSONB blob. That's the right call now — no migrations when
you add a field, and one round trip per write. It stops being the right call when
you want to ask questions across days ("which quest gets skipped most in week 3?").
At that point add a `day_log` table and dual-write to it; the blob stays as the
app's working copy.

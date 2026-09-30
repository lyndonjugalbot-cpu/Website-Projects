# PyWots

A 100-day, Solo-Leveling-style path from zero Python to shipping real software.
Every day is a Gate: guided micro-lessons to teach the concept, then a real
**Dungeon** — code you write and run in the browser, graded by hidden tests.
Clear the 11 boss Gates to raise your Hunter Rank (E → D → C → B → A → S → S+ →
SS → SS+ → SSS → National → Monarch), grow six stats, hold a streak, and dodge
the Penalty for missing a day.

Live: **https://pywots.vercel.app** · iOS: Capacitor wrap (see `CAPACITOR.md`).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run ios      # build + sync + open the iOS project in Xcode
```

## How it's built

| File | What it is |
|------|------------|
| `PyWots.jsx` | The whole app — one React component. Game loop, screens (Today / Tower / Hunter), XP/rank/streak/penalty logic, the Pyodide runner, radar chart, achievements, the account/auth UI. |
| `curriculum.js` | All content + game math. Days 1–10 fully authored (teaching cards + guided lessons + a graded Dungeon). Days 11–100 mapped to concrete topics in `TOPIC_MAP`, kept playable by `PRACTICE` — a bank of real graded problems per stat. |
| `src/lib/` | `supabase.js` (client), `persistence.js` (local-first store), `auth.js` (email / Google / Apple), `access.js` (paid access: read, redeem, claim), `native-bridge.js` (native-only), `platform.js`, `keys.js`. |
| `supabase/` | `schema.sql` (profiles + paid-access tables, RLS, functions), `functions/` (the `claim` and `etsy-oauth` edge functions), `tests/` (`npm test`), and `README.md` with the setup steps. |
| `capacitor.config.json`, `ios/` | The iOS shell. |
| `src/main.jsx`, `index.html`, `vite.config.js` | Vite scaffold. |

### Code execution

The Dungeon editor runs **real Python** via [Pyodide](https://pyodide.org)
(CPython compiled to WebAssembly), loaded from the jsDelivr CDN on first use
(~6 MB, cached afterward). Submissions are graded by executing the user's code
then a list of `assert` tests; the `STDOUT` variable holds anything the code
printed. A 4-second trace-based watchdog stops runaway loops.

Pin/bump the runtime with `PYODIDE_VERSION` in `PyWots.jsx`.

### Accounts & paid access

With **no** env vars the app runs open and local-only: per-device, offline,
`localStorage` (or `@capacitor/preferences` natively), key `pywots:save:v1`.
That's what `npm run dev` does out of the box.

Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and PyWots becomes the paid
app sold on Etsy (12 months per code):

- **Sign in first.** Email + password, plus Google / Apple if listed in
  `VITE_OAUTH_PROVIDERS`. No guest mode.
- **Redeem a code.** A signed-in user without active access gets the redeem
  screen. `redeem_access_code()` (in `schema.sql`) checks the code server-side and
  adds 365 days; time stacks when renewing early. When access runs out the app
  shows the renew screen, and progress stays on the account.
- **Claim a code.** `/claim` turns an Etsy order number into codes via the
  `claim` edge function, which checks the order with Etsy's API.
- The save syncs to Postgres on a debounce; **local unsynced changes win**, so an
  offline device never loses work, and progress from before sign-in carries into
  the account.
- Hunter → Account shows access status, takes another code, and has **Export
  data** and **Delete account** (App Store requirement).

The lock is client-side: the curriculum ships in the bundle. What the server
enforces is that codes are real, single-use and can't be minted or self-granted.

Tests: `npm test` runs the SQL in PGlite (codes, redeeming, RLS) and the claim
flow with Etsy faked out.

Full setup: **`supabase/README.md`**. Native specifics: **`CAPACITOR.md`**.

## Before shipping

- Author days 11–100 (guided lessons) into `curriculum.js` following the day
  shape documented at the top of that file. The topic map and objectives are
  already there.


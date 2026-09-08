# PyWots

A 60-day, Solo-Leveling-style path from zero Python to competent Python.
Every day is a Gate: guided micro-lessons to teach the concept, then a real
**Dungeon** — code you write and run in the browser, graded by hidden tests.
Clear Gates to raise your Hunter Rank (E → D → C → B → A → S → National →
Monarch), grow six stats, hold a streak, and dodge the Penalty for missing a day.

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
| `curriculum.js` | All content + game math. Days 1–10 fully authored (teaching cards + guided lessons + a graded Dungeon). Days 11–60 mapped to concrete topics in `TOPIC_MAP`, kept playable by `PRACTICE` — a bank of real graded problems per stat. |
| `src/lib/` | `supabase.js` (client + anon session), `persistence.js` (local-first store), `auth.js` (email / Google / Apple), `native-bridge.js` (iOS-only), `platform.js`, `keys.js`. |
| `supabase/` | `schema.sql` + `README.md` — the profiles table, RLS, triggers, `delete_user()`, and setup steps. |
| `capacitor.config.json`, `ios/` | The iOS shell. |
| `src/main.jsx`, `index.html`, `vite.config.js` | Vite scaffold. |

### Code execution

The Dungeon editor runs **real Python** via [Pyodide](https://pyodide.org)
(CPython compiled to WebAssembly), loaded from the jsDelivr CDN on first use
(~6 MB, cached afterward). Submissions are graded by executing the user's code
then a list of `assert` tests; the `STDOUT` variable holds anything the code
printed. A 4-second trace-based watchdog stops runaway loops.

Pin/bump the runtime with `PYODIDE_VERSION` in `PyWots.jsx`.

### Accounts & sync (optional)

Local-first. With **no** env vars the app runs exactly as before — per-device,
offline, `localStorage` (or `@capacitor/preferences` on iOS), key
`pywots:save:v1`. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and it
also:

- creates an **anonymous** account on first launch (no signup wall),
- syncs the save blob to Postgres on a debounce; **local unsynced changes always
  win**, so an offline device never loses work,
- lets the user **register** (email / Google / Apple) to carry that progress to
  other devices and the iOS app — email links onto the same anonymous user in
  place,
- exposes **Export data** and **Delete account** (App Store requirement) on the
  Hunter → Account panel.

Full setup: **`supabase/README.md`**. iOS specifics: **`CAPACITOR.md`**.

## Before shipping

- **Remove the "Testing controls"** block on the Hunter screen (unlock day,
  +200 XP, age progress, reset).
- Author days 11–60 (guided lessons) into `curriculum.js` following the day
  shape documented at the top of that file. The topic map and objectives are
  already there.
- Rank is client-state only. If anything is ever paywalled, gate it server-side
  (a column the client can't write, set by a Stripe / RevenueCat webhook).

# WOTS

A modern, responsive personal spending and budget tracker for New Zealand
users. Record daily purchases, browse up to three months of history, generate
weekly or monthly reports with charts, and track spending against a budget —
synced in real time across every device via a shared [Convex](https://convex.dev)
database, with no login required.

**Live app:** https://nz-finance-tracker.vercel.app

## Technology

React 19, TypeScript, Tailwind CSS v4, [Recharts](https://recharts.org) for
charts, [Lucide React](https://lucide.dev) for icons, [date-fns](https://date-fns.org)
(with the `en-NZ` locale) for date handling, and [Convex](https://convex.dev)
for the real-time database (queries, mutations, and a scheduled cleanup job).
[Capacitor](https://capacitorjs.com) wraps the same build as native iOS and
Android apps — see [iOS and Android apps](#ios-and-android-apps) below.

There is still no login/authentication — anyone with the app URL reads and
writes the same shared dataset, the same way a shared spreadsheet would.

## Getting started

```bash
npm install
npx convex dev     # first run: log in, links this folder to the Convex project,
                    # writes .env.local, and keeps functions synced while it runs
npm run dev         # in a second terminal: start the Vite dev server
npm run build        # type-check and produce a production build in dist/
npm run preview      # preview the production build locally
```

`npx convex dev` provisions the dev deployment and writes `.env.local` with
`VITE_CONVEX_URL` (read by `src/main.tsx` to connect). It needs to be running
(or at least to have run once) before `npm run dev` will have data to show.

## Deployment

The app is deployed on [Vercel](https://vercel.com) at the URL above, backed
by a Convex **production** deployment (separate from the dev one used by
`npx convex dev`). To ship a change:

```bash
npx convex deploy    # pushes convex/ functions to the production deployment
npx vercel --prod    # builds the frontend (reads VITE_CONVEX_URL from Vercel's
                      # project env vars) and deploys it
```

`VITE_CONVEX_URL` is set as a **Production** environment variable in the
Vercel project (`vercel env ls` to view, `vercel env add` to change it) —
pointing at the Convex production deployment's `.convex.cloud` URL, not the
dev one.

## iOS and Android apps

The `ios/` and `android/` folders are [Capacitor](https://capacitorjs.com)
native shells that wrap the built web app (`dist/`) in a native app. There's
no separate mobile codebase — the same React components, Convex data, and
business logic run on web and mobile, so a change to `src/` reaches all three
once you rebuild.

```bash
npm run ios       # build web app, sync into ios/, open Xcode
npm run android   # build web app, sync into android/, open Android Studio
npm run cap:sync  # just build + sync, without opening an IDE
```

From Xcode or Android Studio, use the Run button to build onto a simulator/
emulator or a connected device. First-time setup per platform:

- **iOS** — requires Xcode, with an iOS Simulator runtime installed (Xcode →
  Settings → Components) or a real device. To run on a physical iPhone or
  submit to the App Store you need an Apple Developer account, set up under
  the `App` target's *Signing & Capabilities* tab in Xcode.
- **Android** — requires [Android Studio](https://developer.android.com/studio),
  which installs the Android SDK via its setup wizard on first launch. To
  publish to the Play Store you need a Google Play Developer account.

`VITE_CONVEX_URL` is baked into the JS bundle at `npm run build` time (Vite
inlines it as a literal string — there's no runtime config). `.env.local`
points at the **dev** Convex deployment (`npx convex dev`'s), which is
separate from the **production** deployment the live web app at
nz-finance-tracker.vercel.app talks to. If the mobile apps are built with
just `.env.local` in place, they'll show a different, empty-looking dataset
instead of your real data.

To keep the mobile apps in sync with the live web app, `.env.production.local`
overrides `.env.local` with the production URL (Vite loads `.env.production.local`
before `.env.local` when building — see [Vite's env docs](https://vite.dev/guide/env-and-mode)).
It's gitignored, like `.env.local`, since it's just a local convenience — get
the value with:

```bash
npx vercel env pull --environment=production .env.production.local
```

(Vercel marks `VITE_CONVEX_URL` as a *Sensitive* env var, so `vercel env pull`
writes a `[SENSITIVE]` placeholder instead of the real value — pull it
manually from the Vercel dashboard, or from the deployed bundle itself:
`curl -s https://nz-finance-tracker.vercel.app/ | grep -oE '/assets/index-[^"]+\.js'`
to find the asset path, then grep that file for `.convex.cloud`.)

Without `.env.production.local`, `npm run ios` / `npm run android` /
`npm run cap:sync` silently fall back to the dev deployment from `.env.local`.

`capacitor.config.ts` sets the app ID (`com.nzfinancetracker.app`) and
display name — change the app ID there (and re-run `npx cap sync`) before
submitting to either store, since it can't be changed after a first release.

## Folder structure

```
convex/
  schema.ts                  Table definitions: expenses, budgets, meta
  expenses.ts                list/add/update/remove/importMany/clearAll/
                              seedSampleIfEmpty queries & mutations, retention cutoff
  budgets.ts                 get/set queries & mutations (single shared budgets doc)
  crons.ts                   Scheduled job: purges expenses past the retention window
  constants.ts                DATA_RETENTION_MONTHS, EXPENSE_CATEGORIES (server-side copy)
src/
  App.tsx                    Top-level layout, tabs, and modal wiring
  config.ts                  Retention period, categories, category colours (client-side)
  types.ts                   Shared TypeScript types
  context/
    FinanceContext.tsx       Wraps Convex useQuery/useMutation behind the same
                              addExpense/updateExpense/... API the components use
  hooks/
    useLocalStorage.ts       Generic localStorage-backed state (dark mode only)
    useReportRange.ts        Selected date range / weekly-monthly view state
    useDarkMode.ts           Dark mode toggle, persisted per-device
  utils/
    currency.ts              NZD formatting and amount parsing
    date.ts                  NZ date formatting, week/month range helpers (Monday-first weeks)
    expenses.ts              Filtering, sorting, totals, grouping by category/day/week
    csv.ts                   CSV/JSON export, JSON import client-side validation
    id.ts                    Unique ID generation (import placeholder ids only)
  components/
    Header.tsx, Dashboard.tsx, SummaryCards.tsx
    ExpenseForm.tsx, ExpenseList.tsx, ExpenseItem.tsx
    ReportControls.tsx, WeeklyReport.tsx, MonthlyReport.tsx, ReportPieces.tsx
    BudgetCard.tsx, BudgetSettings.tsx, DataManagement.tsx
    EmptyState.tsx, ConfirmationDialog.tsx, Modal.tsx
    charts/
      SpendingTrendChart.tsx, CategoryDonutChart.tsx
      CategoryBarChart.tsx, BudgetProgressChart.tsx
```

## Data model (Convex tables)

- **`expenses`** — one document per expense, indexed by `date`:

  ```json
  {
    "_id": "convex-generated-id",
    "description": "Weekly groceries",
    "amount": 125.5,
    "category": "Groceries",
    "date": "2026-08-19",
    "notes": "Bought at the supermarket",
    "createdAt": "2026-08-19T10:30:00.000Z",
    "isSample": false
  }
  ```

  `amount` is always a number. `date` is an ISO `yyyy-MM-dd` string; NZ
  display formatting (`dd/MM/yyyy`) happens client-side via `formatNZDate`.
  `isSample` is only `true` on the expenses seeded on first launch, and is
  cleared the moment an expense is edited.

- **`budgets`** — a single shared document: `{ weekly: number | null, monthly: number | null }`.

- **`meta`** — a single shared document: `{ sampleSeeded: boolean }`, so the
  sample data is only ever inserted once across all devices, not once per
  browser.

`src/context/FinanceContext.tsx` maps each Convex document's `_id` to an
`id` field so the rest of the app (built before Convex was added) didn't need
to change — every component still calls `addExpense` / `updateExpense` /
`deleteExpense` / `setBudgets` exactly as before, and gets live updates for
free because `useQuery` is a real-time subscription.

## Real-time sync

`convex/react`'s `useQuery(api.expenses.list)` and `useQuery(api.budgets.get)`
are WebSocket subscriptions: any mutation from *any* device — add, edit,
delete, budget change, import, clear-all — is pushed to every other open tab
within roughly a hundred milliseconds, with no polling and no manual refresh.
This was verified with two fully isolated (separate cookie/storage) browser
sessions hitting the same URL: an expense added on one appeared on the other
without a reload, and likewise for a budget change and a delete.

## Three-month cleanup logic

The retention window is defined by `DATA_RETENTION_MONTHS` in **both**
`src/config.ts` (client-side range clamping) and `convex/constants.ts`
(server-side query/cleanup) — currently `3` in each; keep them in sync if you
change it.

- **`expenses.list`** (the query every screen reads from) filters server-side
  to `date >= cutoff`, so expired expenses are invisible immediately
  regardless of whether they've been physically deleted yet.
- **A Convex cron job** (`convex/crons.ts`) runs `expenses.cleanupExpired`
  every 6 hours, permanently deleting documents past the cutoff so storage
  doesn't grow unbounded.
- **On import**, `expenses.importMany` re-validates every record server-side
  and silently skips anything outside `[cutoff, today]`.
- Current and future-dated expenses are never touched — the cutoff is a hard
  floor, not a ceiling.
- Client-side, `clampRangeToRetention` (`src/utils/date.ts`) ensures the
  report controls can never select a range that extends earlier than the
  retention cutoff.

A small notice near the top of the app explains that data syncs across
devices and is retained for a maximum of three months.

## Weekly and monthly report calculations

- **Weeks start on Monday** everywhere (`weekStartsOn: 1` passed to every
  date-fns week helper), and all calculations use the browser's local time.
- **Weekly report**: `groupSpendingByDay` buckets the selected week's
  expenses by ISO date across all seven days (Monday–Sunday), filling in
  $0/0-count for days with no purchases. From that, `getHighestSpendingDay`
  and `getLargestPurchase` derive the headline stats, and
  `groupSpendingByCategory` feeds the category donut chart.
- **Monthly report**: `groupSpendingByWeek` buckets expenses by the Monday
  that starts their week, across every week that overlaps the selected
  month (a month's first/last week can spill into adjacent months — those
  partial weeks are included in full). `getHighestSpendingWeek` picks the
  peak week.
- Switching between **Weekly** and **Monthly** view re-derives the date range
  around the currently selected anchor date (so picking "15 August" and
  toggling from weekly to monthly jumps to the week/month containing the
  15th), and the quick-select pill (This week / Last week / This month /
  Last month / Custom range) is re-inferred to match whenever possible.
- Every date range is clamped to `[retention cutoff, today]`, so a selected
  report period can never exceed the three months of available data.

## Sample data

On the very first load of a fresh database only, five sample expenses dated
within the last ten days are seeded server-side (Countdown weekly shop, bus
fare, cafe lunch, power bill, movie tickets) so the dashboard and charts
aren't empty. Each is flagged `isSample: true`, shown with a "Sample" badge
in the expense list, and can be edited or deleted like any other expense
(editing clears the sample flag). The `meta.sampleSeeded` flag prevents
re-seeding after everything is deleted.

## Testing the main user flows

The following flows have been verified end-to-end with a headless-browser
pass (including two fully independent browser sessions to simulate two
devices, and a console-error check) against both the local dev deployment
and the live production URL:

1. **Add a daily expense** — validation blocks empty descriptions, amounts ≤
   $0, and dates outside the 3-month window.
2. **Edit an expense** — pencil icon opens the same form pre-filled.
3. **Delete an expense** — trash icon opens a confirmation dialog first.
4. **Change the report date** — quick-select pills, Jump-to-date, and the
   From/To custom range inputs all update every summary card, list, and
   chart immediately.
5. **Generate a weekly report** and **6. a monthly report** — Report tab.
7. **View the spending graphs** — trend area chart, category donut, category
   bar chart, each with an accessible empty state when there's no data.
8. **Set weekly and monthly budgets** — progress bar colour and status
   message update live (green under 70%, orange 70–100%, red over 100%).
9. **Export CSV and JSON**, **10. import valid data**, **11. reject invalid
   imported data** — Data tab.
12. **Refresh the browser** — data persists (it's server-side now, not
    per-browser).
13. **Automatic 3-month cleanup** — enforced by the `expenses.list` query
    filter and the 6-hourly cron job.
14. **Two devices, real time** — an expense added, a budget changed, and an
    expense deleted on one browser session each appeared/disappeared on a
    second, fully independent session within seconds, with no reload.

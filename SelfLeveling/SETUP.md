# SelfLeveling — accounts, sync, and the iOS app

The app is **offline-first**. With no configuration it saves progress on the
device and every feature works. Add a Supabase project and it gains
**accounts + cross-device sync**. The **iOS app is the same web build** wrapped
by Capacitor, so it's always in sync with the web app — same code, same
Supabase project, same data.

---

## 1. Supabase (accounts + sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste [`schema.sql`](schema.sql) and run it.
   Creates the `profiles` table, row-level-security policies, and a trigger
   that makes a profile row the moment a user (including anonymous) signs up.
3. **Authentication → Providers → Anonymous sign-ins → enable.**
   This is what lets someone play immediately and get a real cloud slot with
   no signup form.
4. **Authentication → Providers → Email:** leave **"Confirm email" off** for
   now so linking an email to an anonymous account is instant. (Leave it on
   and it still works — the user just gets a confirmation link first, and the
   Account panel says so.)
5. **Project Settings → API →** copy the **Project URL** and the **anon /
   public key**. Both are safe in client code; RLS protects the data. Never
   ship the `service_role` key.

### Local dev

```bash
cp .env.example .env.local      # then paste your URL + anon key
npm install
npm run dev
```

### Web deploy (Vercel)

```bash
vercel env add VITE_SUPABASE_URL       # paste URL,  choose Production + Preview + Development
vercel env add VITE_SUPABASE_ANON_KEY  # paste anon key, same environments
vercel --prod
```

(or add the two vars in the Vercel dashboard → Settings → Environment Variables,
then redeploy).

Until the keys are set the Account panel shows "Cloud sync isn't configured"
and the app is local-only — nothing breaks.

---

## 2. iOS app (Capacitor)

The `ios/` Xcode project is committed. It loads the built web app from
`dist/` and talks to the same Supabase project, so it stays in lockstep with
the website.

### One-time

- macOS with **Xcode** installed.
- **CocoaPods**: `brew install cocoapods` (or `sudo gem install cocoapods`).
- An Apple ID for signing. Free tier runs on the simulator and your own
  device; the **Apple Developer Program ($99/yr)** is only needed to ship to
  TestFlight / the App Store.

### Build & run

```bash
npm install
npm run ios:sync     # vite build  ->  copy web into ios/  ->  pod install
npm run ios:open     # opens ios/App/App.xcworkspace in Xcode
```

In Xcode: select the **App** target → **Signing & Capabilities** → pick your
Team. Then Run (▶) on a simulator or a connected device.

Your `.env.local` keys are compiled into the JS during `vite build`, so
`ios:sync` picks them up with no extra step.

### App icon / splash

Drop a 1024×1024 PNG at `resources/icon.png` and a 2732×2732 at
`resources/splash.png`, then:

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --ios
```

### Ship it

Xcode → **Product → Archive → Distribute App** → App Store Connect /
TestFlight. Bundle id is **`app.wots.selfleveling`** (change it in
`capacitor.config.json` + Xcode if you want your own).

### After any web change

```bash
npm run ios:sync     # re-bundles the current web app into the iOS project
```

---

## 3. How sync works

- Every client — a web tab, the iOS app — signs into the **same Supabase
  project**. First launch = a silent anonymous account.
- The whole save is one JSON blob per user in `profiles.state`. A few columns
  (`xp`, `level`, `streak`, …) are mirrored alongside it for SQL queries.
- Writes are cached locally instantly and pushed on a ~1 s debounce;
  last-write-wins on the server. Offline edits queue and flush on reconnect,
  and on tab-hide.
- **Add email + password** in the Account panel and it *links* to the current
  anonymous account — same user id, same row — so nothing is lost. Signing in
  on a second device then pulls that same save.
- **Sign out** clears the local cache and starts a fresh anonymous slot, so a
  shared device never leaks one person's streak to the next.

---

## 4. Known follow-ups

- The onboarding **paywall** (`pro` flag) is still client-side only — there's
  no real billing. Entitlement has to move server-side before charging money
  (Stripe webhook → an Edge Function that writes `is_pro`; drop `is_pro` from
  the client update policy).
- The **You / Records** tab still has dev "Testing controls" (skip-day,
  reset) — remove or gate them before a public launch.
- iOS token refresh uses Supabase's default `autoRefreshToken`. For battery,
  add `@capacitor/app` `appStateChange` listeners that call
  `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`.

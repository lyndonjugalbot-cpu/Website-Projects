# PyWots iOS (Capacitor)

The iOS app is the **same web build** running in a native WKWebView shell, so
`https://pywots.vercel.app` and the App Store build share one codebase and one
Supabase backend — they can't drift. Fix a bug once, `cap sync`, ship.

## Prerequisites

- **Xcode** (has been built with Xcode 26). Open it once and accept the licence.
- **CocoaPods is NOT needed** — this project uses Swift Package Manager
  (`npx cap add ios --packagemanager SPM`). Xcode resolves the plugin packages.
- **Simulator:** works with nothing else.
- **Your own iPhone:** works with a **free** Apple ID (no $99 Developer Program).
  Xcode makes a "Personal Team" the first time you add the account. Caveat: the
  build **expires after 7 days** and must be re-run from Xcode; max 3 sideloaded
  apps at once; Sign in with Apple isn't available (Google + email still are).
- **TestFlight / App Store / native Sign in with Apple:** need the paid Apple
  Developer Program.

### Install on your own iPhone (free)

1. **Xcode ▸ Settings ▸ Accounts ▸ +** → add your Apple ID.
2. `npm run ios` (opens the project). Select the **App** target ▸
   **Signing & Capabilities** ▸ **Team** → your name (Personal Team). Leave
   "Automatically manage signing" ticked. If the bundle id `app.pywots` is
   rejected as taken, change it here to something unique like `app.pywots.<you>`.
3. On the iPhone: **Settings ▸ Privacy & Security ▸ Developer Mode ▸ On**
   (restart when asked). Plug it in, unlock it, tap **Trust**.
4. Pick the iPhone in Xcode's device menu (top bar) → press **▶**.
5. First launch fails with "Untrusted Developer" — on the phone:
   **Settings ▸ General ▸ VPN & Device Management** → tap your Apple ID → **Trust**.
   Re-launch the app.
6. In ~7 days it stops opening — just press **▶** in Xcode again to refresh it.

CLI equivalent once you know your team id (`xcrun devicectl list devices` for the
device id, Xcode ▸ Settings ▸ Accounts for the team):

```bash
npm run build && npx cap sync ios
cd ios/App
xcodebuild -scheme App -configuration Debug -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=XXXXXXXXXX \
  -destination 'id=<device-id>' -derivedDataPath /tmp/pw-dd build
xcrun devicectl device install app --device <device-id> \
  /tmp/pw-dd/Build/Products/Debug-iphoneos/App.app
```

### No-Xcode option: Add to Home Screen (PWA)

On the iPhone open **https://pywots.vercel.app** in Safari → Share →
**Add to Home Screen**. Full-screen, own icon (the emblem), works offline, no
expiry. It's the web app, not a store build, but it's the same code and the same
account — good enough for daily use and for handing to testers today.

## Everyday workflow

```bash
npm run ios        # build web -> cap sync -> open Xcode
# or, without opening Xcode:
npm run ios:sync   # build web -> cap sync
```

Then in Xcode: pick a simulator (or your device), press ▶.
Run headless from the CLI:

```bash
npm run build && npx cap sync ios
cd ios/App
xcodebuild -scheme App -sdk iphonesimulator -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/dd build
xcrun simctl boot "iPhone 16" ; xcrun simctl install booted /tmp/dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted app.pywots
```

**Always `cap sync` after changing web code** — it copies fresh `dist/` into
`ios/App/App/public` (git-ignored) and refreshes the plugin list.

## What's wired

| Piece | Where |
|---|---|
| Bundle id / app name | `capacitor.config.json` (`app.pywots` / "PyWots") |
| Deep-link scheme `pywots://` | `capacitor.config.json` + `ios/App/App/Info.plist` (`CFBundleURLTypes`) |
| Status bar styling + OAuth deep-link handler | `src/lib/native-bridge.js` (dynamically imported only on native) |
| Native persistence | `src/lib/persistence.js` uses `@capacitor/preferences` when native (WKWebView `localStorage` can be evicted) |
| Icon + splash | `assets/icon.png` / `assets/splash.png` → `npm run assets` regenerates the Xcode asset catalog |

## Sign-in on iOS

- **Email + password** works natively with no extra setup (it's just Supabase
  over HTTPS).
- **Google / Apple** open in an in-app Safari view; the `pywots://auth-callback`
  deep link returns to the app and `native-bridge.js` completes the session.
  Add `pywots://auth-callback` to **Supabase → Auth → URL Configuration →
  Redirect URLs** (also in `supabase/README.md`).
- **Optional upgrade for App Store polish:** a native "Sign in with Apple" sheet
  (Apple's HIG prefers it over a web view). Add
  `@capgo/capacitor-social-login` (or `@capacitor-community/apple-sign-in` once
  it supports Capacitor 8), get an `identityToken`, and call
  `supabase.auth.signInWithIdToken({ provider: 'apple', token })`. The seam is
  `signInWithProvider()` in `src/lib/auth.js` — swap the `isNative` branch.

## Release

1. In Xcode: **Signing & Capabilities** → select your team; bump
   `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`.
2. Add the **Sign in with Apple** capability if you enable native Apple login.
3. **Product → Archive** → **Distribute App** → App Store Connect → TestFlight.
4. App Review notes:
   - Account deletion is in-app: **Hunter → Account → Delete account**
     (calls the `delete_user()` SQL function). Required by guideline 5.1.1(v).
   - Offering Google login means **Sign in with Apple must also be offered**
     (guideline 4.8) — it is.
   - The Python runtime (Pyodide) is downloaded from a CDN on first use. It's
     WASM + data, not native executable code. If Review questions it, bundle
     Pyodide into the app: drop the release files in `public/pyodide/` and point
     `PYODIDE_BASE` in `PyWots.jsx` at `/pyodide/`.

## Daily Quest reminder

`@capacitor/local-notifications` schedules one repeating notification (default
09:00) — set in **Hunter → Daily Quest Reminder**. Tapping it (or its **Accept**
action) opens the app and shows the full-screen in-app **System summons**
(`<SystemSummons>`).

iOS **cannot** be made to take over the screen at a scheduled time — no app can.
The notification is a standard banner; the "override the phone" experience only
exists once the app is open. Permission is requested right after the Awakening
Test and again from the settings toggle. The schedule is re-applied on every
launch from the saved pref (`src/lib/native-bridge.js`), so it survives restarts
— but a free-signed build stops firing once the 7-day signature expires.

## Offline

The app is local-first: it runs fully offline (progress in Preferences) and
syncs when a connection returns. The only online-only piece is the **first**
Dungeon run, which fetches Pyodide; after that WKWebView caches it. Bundle
Pyodide (above) to make even that offline.

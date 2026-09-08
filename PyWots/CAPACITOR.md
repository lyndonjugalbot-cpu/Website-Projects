# PyWots iOS (Capacitor)

The iOS app is the **same web build** running in a native WKWebView shell, so
`https://pywots.vercel.app` and the App Store build share one codebase and one
Supabase backend — they can't drift. Fix a bug once, `cap sync`, ship.

## Prerequisites

- **Xcode** (has been built with Xcode 26). Open it once and accept the licence.
- **CocoaPods is NOT needed** — this project uses Swift Package Manager
  (`npx cap add ios --packagemanager SPM`). Xcode resolves the plugin packages.
- **Apple Developer Program** ($99/yr) for: running on a physical device, Sign
  in with Apple, TestFlight, and the App Store. The **simulator works without
  it** (minus Apple sign-in).

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

## Offline

The app is local-first: it runs fully offline (progress in Preferences) and
syncs when a connection returns. The only online-only piece is the **first**
Dungeon run, which fetches Pyodide; after that WKWebView caches it. Bundle
Pyodide (above) to make even that offline.

# PyWots native apps (Capacitor)

iOS and Android are the **same web build** running in a native WebView shell, so
`https://pywots.vercel.app` and both native apps share one codebase and one
Supabase backend — they can't drift. Fix a bug once, `cap sync`, ship.

---

# Android — the APK

Unlike iOS, Android lets you hand someone an installable file. `public/pywots.apk`
is a **debug-signed** build served from the site; the Hunter screen has a
**Download for Android** button pointing at `/pywots.apk`.

## Build / refresh the APK

```bash
npm run android:apk
```

That runs `vite build` → `cap sync android` → `gradlew assembleDebug`, then copies
the result to `public/pywots.apk`. Re-run it after any web change and redeploy so
the download stays current. (The script deletes the copied-in `pywots.apk` from
the Android assets before Gradle runs, so the APK doesn't nest a copy of itself.)

Toolchain used here: Homebrew `android-commandlinetools` at
`/opt/homebrew/share/android-commandlinetools`, `openjdk@21`, SDK platform
`android-35`. A fresh clone needs `android/local.properties` with
`sdk.dir=<path-to-sdk>` (or `ANDROID_HOME` set), plus `JAVA_HOME` pointing at a
JDK 17/21.

## Notes

- Debug signing = fine for sideloading, not for the Play Store. For Play, add a
  release keystore and `./gradlew bundleRelease` (`.aab`).
- Installing: the user opens the `.apk`, allows "install unknown apps" for their
  browser once, taps Install. Play Protect may show a "scan" prompt — normal for
  a sideloaded app.
- `minSdk 24` (Android 7.0+). Deep-link scheme `pywots://` and
  `POST_NOTIFICATIONS` are in `AndroidManifest.xml`.
- Not yet tested on a physical Android device — the APK builds, signs, and
  bundles the current web app; verify on hardware before wider distribution.

---

# iOS

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

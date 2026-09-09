# SelfLeveling

A 66-day training program framed as **"the System"** from *Solo Leveling*: it
issues a Daily Quest, you clear it for XP, level up, and climb E-Rank → S-Rank.
Miss a day and the next one opens with a **Penalty Quest**. React
([SelfLeveling.jsx](SelfLeveling.jsx)) + Vite. Live at
[selfleveling.vercel.app](https://selfleveling.vercel.app).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

Runs with zero config — progress saves to the device. Add a Supabase project
for **accounts + cross-device sync**; **iOS and Android apps** (Capacitor) wrap
this same build. All in **[SETUP.md](SETUP.md)**. The live site's
*Records → Get the app* has a **Download APK** button.

## The program

Six questions (push-up max, run distance, sleep, screen time, reading, follow-
through) set your starting **stats** — STR / AGI / VIT / PER / INT / GRIT — and
your starting difficulty. Targets ramp each week over the 66 days.

**Daily Quest** (7 fixed): push-ups (STR) · squats (VIT) · run/walk distance
(AGI) · sleep (VIT) · screen-time cap (PER) · reading or a skill (INT) ·
cold-shower finish (GRIT).

**The Gate** (rotating 8th quest — the day's boss): E-Rank Gate (burpees) ·
Stone Golem (wall sit) · Goblin Pack (stairs) · Beast Carry (loaded carry) ·
Shadow Spar (shadow boxing) · Hunter's Dash (sprints) · Iron Hang (dead hang).

Clear 5 of the day's quests to log it and keep the streak. Fall short and
tomorrow carries a **Penalty Quest** (20 burpees) on top.

Each cleared quest plays a short SVG animation of the movement and pushes its
stat up. Levels trigger a `⟪ Level Up ⟫` window; ranks and achievements track on
the **Records** tab.

## Accounts, sync & native apps

- **[persistence.js](persistence.js)** — offline-first `store`: local cache +
  debounced Supabase sync, last-write-wins, flushes on reconnect / tab-hide.
- **[auth.js](auth.js)** — anonymous-first email/password. `register()` *links*
  an email to the current anonymous account (same id, nothing lost); the
  Account panel lives on the **Records** tab.
- **[capacitor.config.json](capacitor.config.json)** + `ios/` + `android/` —
  the native apps wrap this same build. `npm run ios:sync` / `ios:open`,
  `npm run android:apk` (→ `public/selfleveling.apk`, served by the download
  button) / `android:open`.

Full setup (Supabase project, env vars, Xcode) in **[SETUP.md](SETUP.md)**.

## Before shipping

The **Records** tab still has dev testing controls (skip-day, reset), and the
`pro` paywall flag lives in client state — move entitlement server-side before
charging. See SETUP.md §4.

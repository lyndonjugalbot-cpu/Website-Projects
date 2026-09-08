# SelfLeveling

A 66-day training program framed as **"the System"** from *Solo Leveling*: it
issues a Daily Quest, you clear it for XP, level up, and climb E-Rank → S-Rank.
Miss a day and the next one opens with a **Penalty Quest**. Single-file React
component ([SelfLeveling.jsx](SelfLeveling.jsx)), no app-specific dependencies.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # -> dist/
npm run preview  # serve the production build
```

Progress is saved per device (artifact API → `localStorage` → in-memory), so it
runs with zero configuration.

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

## Cross-device progress (optional)

Wire up Supabase per [PERSISTENCE.md](PERSISTENCE.md): run [schema.sql](schema.sql),
`npm install @supabase/supabase-js`, set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`, then swap the inline `store` block in
[SelfLeveling.jsx](SelfLeveling.jsx) for `import { store } from "./persistence"`.

## Before shipping

The **You** tab has testing controls (skip-day, reset) to remove, and the `pro`
flag lives in client state — replace it with server-side entitlement before
taking money.

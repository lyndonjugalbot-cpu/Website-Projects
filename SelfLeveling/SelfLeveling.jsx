import React, { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  SelfLeveling — 66-day Solo-Leveling-style training program.        */
/*  "The System" issues a Daily Quest (training + a rotating Gate +    */
/*  the basics), you clear it for XP, level up, and rank E -> S. Miss  */
/*  a day and the next one opens with a Penalty Quest.                 */
/*  Single-file React app. No external deps.                           */
/* ------------------------------------------------------------------ */

/* ---------------------------- storage ----------------------------- */
/* Tries the artifact storage API, then localStorage, then memory.
   On Vercel you'll want to swap this for Supabase/Postgres so progress
   follows the account instead of the device. */
const mem = {};
const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
      }
    } catch (e) { /* key missing or API absent */ }
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { /* blocked */ }
    return mem[key] ?? null;
  },
  async set(key, value) {
    const s = JSON.stringify(value);
    mem[key] = value;
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(key, s);
        return;
      }
    } catch (e) { /* fall through */ }
    try { window.localStorage.setItem(key, s); } catch (e) { /* memory only */ }
  },
};
const SAVE_KEY = "selfleveling:save";

/* ---------------------------- domain ------------------------------ */

const TRACKS = [
  { id: "str",  label: "STR",  blurb: "Raw power. Push, pull, carry." },
  { id: "agi",  label: "AGI",  blurb: "Cover ground. Move fast when it counts." },
  { id: "vit",  label: "VIT",  blurb: "The engine — legs, core, and the sleep that repairs them." },
  { id: "per",  label: "PER",  blurb: "Attention is a stat. Stop leaking it." },
  { id: "int",  label: "INT",  blurb: "Feed your head something that isn't a feed." },
  { id: "grit", label: "GRIT", blurb: "Walk straight at the thing you'd rather avoid." },
];

const QUIZ = [
  { id: "str",  q: "Push-ups in one set — honest max?",
    options: ["Can't do one yet", "1 to 10", "10 to 25", "25 or more"] },
  { id: "agi",  q: "Longest you've run or jogged lately?",
    options: ["I don't run", "A few minutes", "1 to 3 km", "5 km or more"] },
  { id: "vit",  q: "How much sleep do you actually get?",
    options: ["Under 5 hours", "5 to 6 hours", "6 to 7 hours", "7 or more"] },
  { id: "per",  q: "Daily screen time, honestly.",
    options: ["Over 8 hours", "5 to 8 hours", "3 to 5 hours", "Under 3 hours"] },
  { id: "int",  q: "Time spent reading or learning off a feed?",
    options: ["Basically none", "Now and then", "Most weeks", "Every day"] },
  { id: "grit", q: "When you set yourself a goal, what usually happens?",
    options: ["I drop it same day", "I last a few days", "I last a couple of weeks", "I usually finish"] },
];

const PROGRAM_DAYS = 66;
const CLEAR_TARGET = 5; // quests to log a day and keep the next one Penalty-free

/* Quiz answer (0-3) becomes a starting stat and a starting difficulty. */
const baseFromAnswer = (a) => [18, 34, 50, 66][a];

/* Targets scale with the week. Week 1 is deliberately soft — the point of a
   66-day ramp is that you never get a day you can't start. */
function questsForDay(dayIndex, answers) {
  const week = Math.floor(dayIndex / 7); // 0..9
  const a = answers;

  const pushups   = [8, 12, 18, 25][a.str] + week * 4;
  const squats    = [12, 18, 25, 35][a.vit] + week * 5;
  const km        = Math.round(([0.6, 1, 1.6, 2.2][a.agi] + week * 0.35) * 10) / 10;
  const sleepH    = [6, 6.5, 7, 7][a.vit];
  const screenCap = Math.max(2, [7, 6, 5, 4][a.per] - Math.floor(week / 2));
  const readMin   = [10, 12, 15, 20][a.int] + week * 2;
  const cold      = Math.min(150, 15 + week * 14);

  const quests = [
    { id: "power", track: "str",  scene: "pushup", title: `Clear ${pushups} push-ups`,
      note: "Break it into sets. The last rep is allowed to be ugly.", xp: 22 },
    { id: "legs",  track: "vit",  scene: "squat",  title: `${squats} bodyweight squats`,
      note: "Chest up, all the way down.", xp: 20 },
    { id: "run",   track: "agi",  scene: "run",    title: `Cover ${km} km on foot`,
      note: "Run what you can, walk the rest. Moving is moving.", xp: 22 },
    { id: "rest",  track: "vit",  scene: "sleep",  title: `Sleep ${sleepH}+ hours`,
      note: "Training you don't recover from is just damage.", xp: 16 },
    { id: "watch", track: "per",  scene: "screen", title: `Screen time under ${screenCap}h`,
      note: "Check the number before bed.", xp: 15 },
    { id: "study", track: "int",  scene: "read",   title: `${readMin} min reading or a skill`,
      note: "No feed, no autoplay.", xp: 15 },
    { id: "cold",  track: "grit", scene: "cold",   title: `Cold-finish your shower — ${cold}s`,
      note: "The dread is the training.", xp: 20 },
  ];

  // The Gate: the day's boss. Rotates so the week never turns into muscle memory.
  const gates = [
    { title: "E-Rank Gate — 30 burpees", note: "Any pace. Don't stop moving.", track: "agi", scene: "burpee", xp: 22 },
    { title: "Stone Golem — 2 min wall sit", note: "Thighs flat. Break it into holds if you must.", track: "vit", scene: "wallsit", xp: 20 },
    { title: "Goblin Pack — 10 flights of stairs", note: "Or 100 step-ups on something solid.", track: "agi", scene: "stairs", xp: 22 },
    { title: "Beast Carry — 5 min loaded carry", note: "Groceries, a pack, a kid. Keep walking.", track: "str", scene: "carry", xp: 20 },
    { title: "Shadow Spar — 3 rounds shadow boxing", note: "2 minutes on, 1 off. Hands up.", track: "agi", scene: "spar", xp: 20 },
    { title: "Hunter's Dash — 6 sprints", note: "20 seconds hard, walk back, repeat.", track: "agi", scene: "sprint", xp: 24 },
    { title: "Iron Hang — 90s dead hang", note: "Off a bar or a ledge. Total time counts.", track: "str", scene: "hang", xp: 22 },
  ];
  quests.push({ id: "gate", ...gates[dayIndex % gates.length] });
  return quests;
}

/* Added on top of the day when yesterday went uncleared. Solo-Leveling rules:
   miss the Daily Quest and the System makes the next one cost more. */
const PENALTY_QUEST = {
  id: "penalty", track: "grit", scene: "burpee",
  title: "Penalty Quest — 20 burpees",
  note: "Yesterday went uncleared. Clear today to be rid of this.",
  xp: 8,
};

/* Level curve: fast early, slow later. */
function xpForLevel(n) {
  return Math.round(90 + 55 * Math.pow(n - 1, 1.28));
}
function levelFromXp(totalXp) {
  let level = 1, remaining = totalXp, need = xpForLevel(1);
  while (remaining >= need && level < 99) {
    remaining -= need;
    level += 1;
    need = xpForLevel(level);
  }
  return { level, into: remaining, need };
}

const RANKS = [
  { at: 1,  name: "E-Rank" },
  { at: 4,  name: "D-Rank" },
  { at: 8,  name: "C-Rank" },
  { at: 13, name: "B-Rank" },
  { at: 19, name: "A-Rank" },
  { at: 26, name: "S-Rank" },
  { at: 34, name: "National Level" },
];
const rankFor = (level) => [...RANKS].reverse().find((r) => level >= r.at).name;

const ACHIEVEMENTS = [
  { id: "first", name: "System activated", desc: "Clear your first quest.", test: (s) => s.totalQuests >= 1 },
  { id: "clear", name: "Daily Quest complete", desc: "Clear every quest in a day.", test: (s) => s.perfectDays >= 1 },
  { id: "s3", name: "Three-day chain", desc: "Hold a 3 day streak.", test: (s) => s.streak >= 3 },
  { id: "s7", name: "One week deep", desc: "Hold a 7 day streak.", test: (s) => s.streak >= 7 },
  { id: "s21", name: "Past the drop-off", desc: "Hold a 21 day streak.", test: (s) => s.streak >= 21 },
  { id: "s66", name: "Reawakening", desc: "Finish all 66 days.", test: (s) => s.streak >= 66 },
  { id: "l5", name: "D-Rank Hunter", desc: "Reach level 5.", test: (s) => s.level >= 5 },
  { id: "l10", name: "C-Rank Hunter", desc: "Reach level 10.", test: (s) => s.level >= 10 },
  { id: "q50", name: "Fifty cleared", desc: "Clear 50 quests.", test: (s) => s.totalQuests >= 50 },
  { id: "q200", name: "Two hundred cleared", desc: "Clear 200 quests.", test: (s) => s.totalQuests >= 200 },
  { id: "grit", name: "Cold-blooded", desc: "Cold-finish 14 showers.", test: (s) => s.byTrack.grit >= 14 },
  { id: "str", name: "Strength up", desc: "Clear the push-up quest 30 times.", test: (s) => s.byTrack.str >= 30 },
];

/* ------------------------------ dates ----------------------------- */
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) =>
  Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

/* ---------------------------- styles ------------------------------ */
const CSS = `
/* One typeface for the whole app. */
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');

.sl { --ink:#0A0C1C; --panel:#161A31; --panel2:#1F2444; --line:#2C3157;
      --gold:#E9C46A; --gold-deep:#B08A3C;
      --cyan:#8AD1F0; --cyan-bright:#9EE6FF; --violet:#A87BFF; --magenta:#E86BC6;
      --edge:rgba(138,209,240,.30); --edge-hot:rgba(232,107,198,.32);
      --text:#EDEAE2; --muted:#8E93B8;
      font-family:'Chakra Petch',system-ui,sans-serif; color:var(--text);
      background:var(--ink); min-height:100vh; -webkit-font-smoothing:antialiased; }
.sl *, .sl *::before, .sl *::after { box-sizing:border-box; }
.sl button { font:inherit; color:inherit; background:none; border:none; cursor:pointer; }
.sl button:focus-visible, .sl [tabindex]:focus-visible { outline:2px solid var(--cyan); outline-offset:3px; }

.sl-frame { max-width:430px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column;
            position:relative; overflow:hidden;
            background:
              radial-gradient(135% 46% at 50% 30%, rgba(120,140,255,.24), transparent 62%),
              radial-gradient(80% 30% at 8% 104%, rgba(168,123,255,.15), transparent 62%),
              radial-gradient(80% 30% at 92% 104%, rgba(232,107,198,.14), transparent 62%),
              linear-gradient(180deg,#0F1230 0%, #0A0C1C 56%, #05060E 100%); }
.sl-body { flex:1; padding:20px 18px 104px; position:relative; z-index:1; }

/* legacy class — kept so headings stay bold without touching every call site */
.serif { font-family:inherit; font-weight:700; letter-spacing:.005em; }
.h1 { font-size:34px; line-height:1.08; letter-spacing:-0.01em; margin:0 0 10px; }
.h2 { font-size:20px; font-weight:600; letter-spacing:-0.01em; margin:0 0 4px; }
.lede { color:var(--muted); font-size:15px; line-height:1.55; margin:0 0 24px; max-width:34ch; }
.muted { color:var(--muted); }

.panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; }

/* status header */
.status { display:flex; align-items:flex-end; gap:16px; margin-bottom:18px; }
.lvlnum { font-size:76px; line-height:0.8; color:var(--gold); }
.lvlmeta { padding-bottom:6px; }
.rank { font-size:13px; color:var(--muted); }
.dayline { font-size:15px; font-weight:600; }

.bar { height:7px; background:#232849; border-radius:99px; overflow:hidden; }
.bar > i { display:block; height:100%; background:linear-gradient(90deg,var(--gold-deep),var(--gold)); transition:width .5s ease; }
.barrow { display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin:8px 0 4px; }

.streak { display:flex; align-items:baseline; gap:7px; }
.streak b { font-size:22px; color:var(--gold); }

/* quests */
.quest { display:flex; gap:13px; align-items:flex-start; width:100%; text-align:left;
         padding:14px; border:1px solid var(--line); border-radius:12px; background:var(--panel);
         margin-bottom:9px; transition:border-color .18s, background .18s, opacity .18s; }
.quest:hover { border-color:#3A4070; }
.quest.done { opacity:.5; background:transparent; }
.quest.done .qtitle { text-decoration:line-through; text-decoration-color:var(--gold-deep); }
.tick { flex:none; width:22px; height:22px; margin-top:1px; border-radius:6px; border:1.5px solid #3F4576;
        display:grid; place-items:center; transition:.18s; }
.quest.done .tick { background:var(--gold); border-color:var(--gold); }
.tick svg { opacity:0; }
.quest.done .tick svg { opacity:1; }
.qtitle { font-size:15px; font-weight:600; line-height:1.35; }
.qnote { font-size:13px; color:var(--muted); margin-top:3px; line-height:1.4; }
.qxp { flex:none; font-size:12px; color:var(--gold-deep); font-weight:600; margin-top:2px; }

/* nav */
.nav { position:fixed; bottom:0; left:0; right:0; max-width:430px; margin:0 auto;
       display:grid; grid-template-columns:repeat(4,1fr); background:rgba(15,18,38,.94);
       backdrop-filter:blur(12px); border-top:1px solid var(--line); }
.nav button { padding:12px 0 18px; font-size:12px; font-weight:600; color:var(--muted); }
.nav button[data-on="true"] { color:var(--gold); }
.nav i { display:block; width:16px; height:2px; margin:0 auto 7px; background:transparent; border-radius:2px; }
.nav button[data-on="true"] i { background:var(--gold); }

/* buttons */
.cta { display:block; width:100%; padding:15px; border-radius:12px; background:var(--gold); color:#161020;
       font-weight:700; font-size:16px; transition:transform .12s; }
.cta:active { transform:scale(.985); }
.cta.ghost { background:transparent; color:var(--muted); font-weight:500; font-size:14px; padding:12px; }
.opt { display:block; width:100%; text-align:left; padding:15px 16px; border-radius:12px;
       border:1px solid var(--line); background:var(--panel); margin-bottom:9px; font-size:15px; transition:.15s; }
.opt:hover { border-color:#454C86; }
.opt[data-sel="true"] { border-color:var(--gold); background:#221F30; }

/* path grid */
.grid66 { display:grid; grid-template-columns:repeat(11,1fr); gap:6px; }
.cell { aspect-ratio:1; border-radius:4px; background:#20254A; }
.cell[data-s="full"] { background:var(--gold); }
.cell[data-s="part"] { background:var(--gold-deep); }
.cell[data-s="miss"] { background:#2A2036; }
.cell[data-s="today"] { box-shadow:0 0 0 2px var(--cyan); }

/* stats */
.statrow { display:flex; align-items:center; gap:10px; margin-bottom:11px; font-size:14px; }
.statrow span:first-child { width:52px; color:var(--muted); }
.statrow b { width:28px; text-align:right; font-weight:600; }

/* modal */
/* quest-cleared flourish */
.qcele { position:fixed; inset:0; display:grid; place-items:center; z-index:45; pointer-events:none; }
.qcele-card { background:rgba(23,27,51,.92); border:1px solid var(--line); border-radius:20px;
              padding:20px 24px 16px; text-align:center; backdrop-filter:blur(8px);
              animation:qcelePop 1.5s ease both; }
.qcele-xp { margin-top:4px; font-weight:700; font-size:18px; color:var(--gold); font-variant-numeric:tabular-nums; }
@keyframes qcelePop {
  0%   { opacity:0; transform:scale(.82); }
  12%  { opacity:1; transform:scale(1.04); }
  22%,80% { opacity:1; transform:scale(1); }
  100% { opacity:0; transform:scale(.96); }
}
.qs { display:block; overflow:visible; }
.qs g, .qs line, .qs path, .qs circle, .qs text, .qs rect { transform-box:view-box; }

/* run / sprint — legs and arms swing */
.qs-run-bob  { transform-origin:60px 60px; animation:qsBob .32s ease-in-out infinite alternate; }
@keyframes qsBob { from{ transform:translateY(1px); } to{ transform:translateY(-4px); } }
.qs-run-legA { transform-origin:56px 67px; animation:qsSwingBack .32s ease-in-out infinite alternate; }
.qs-run-legB { transform-origin:56px 67px; animation:qsSwingFwd  .32s ease-in-out infinite alternate; }
.qs-run-armA { transform-origin:58px 48px; animation:qsSwingFwd  .32s ease-in-out infinite alternate; }
.qs-run-armB { transform-origin:58px 48px; animation:qsSwingBack .32s ease-in-out infinite alternate; }
@keyframes qsSwingBack { from{ transform:rotate(26deg); } to{ transform:rotate(-26deg); } }
@keyframes qsSwingFwd  { from{ transform:rotate(-26deg); } to{ transform:rotate(26deg); } }
.qs-run-lines { animation:qsRunLines .45s linear infinite; }
@keyframes qsRunLines { 0%{ opacity:0; transform:translateX(8px); } 50%{ opacity:1; } 100%{ opacity:0; transform:translateX(-10px); } }

/* rest — sleeping */
.qs-sleep-body { transform-origin:66px 80px; animation:qsBreathe 2.2s ease-in-out infinite; }
@keyframes qsBreathe { 0%,100%{ transform:scaleY(1); } 50%{ transform:scaleY(1.05); } }
.qs-z   { opacity:0; }
.qs-z-a { animation:qsFloat 1.8s ease-out infinite; }
.qs-z-b { animation:qsFloat 1.8s ease-out .5s infinite; }
.qs-z-c { animation:qsFloat 1.8s ease-out 1s infinite; }
@keyframes qsFloat { 0%{ opacity:0; transform:translateY(6px); } 30%{ opacity:1; } 100%{ opacity:0; transform:translateY(-12px); } }

/* screen — phone goes face-down for the night */
.qs-phone { transform-origin:60px 60px; animation:qsFlip 1.4s ease-in-out both; }
@keyframes qsFlip { 0%{ transform:rotate(0); } 45%{ transform:rotate(-10deg); } 100%{ transform:rotate(180deg); } }
.qs-phone-screen { animation:qsDim 1.4s ease-in both; }
@keyframes qsDim { 0%{ opacity:.9; } 60%{ opacity:.14; } 100%{ opacity:.05; } }
.qs-phone-moon { opacity:0; transform-origin:80px 32px; animation:qsMoon 1.4s ease-out both; }
@keyframes qsMoon { 0%,45%{ opacity:0; transform:scale(.4); } 78%{ opacity:1; transform:scale(1.12); } 100%{ opacity:1; transform:scale(1); } }

/* will — cold shower */
.qs-water line { animation:qsRain .6s linear infinite; }
.qs-water line:nth-child(2) { animation-delay:.2s; }
.qs-water line:nth-child(3) { animation-delay:.4s; }
@keyframes qsRain { 0%{ opacity:0; transform:translateY(-8px); } 40%{ opacity:1; } 100%{ opacity:0; transform:translateY(16px); } }
.qs-shiver { transform-origin:60px 80px; animation:qsShiver .11s linear infinite alternate; }
@keyframes qsShiver { from{ transform:translateX(-1.6px); } to{ transform:translateX(1.6px); } }
.qs-flake { transform-origin:96px 68px; animation:qsSpin 3.2s linear infinite; opacity:.8; }
@keyframes qsSpin { to{ transform:rotate(360deg); } }

/* push-ups — rigid body tips down at the toes */
.qs-pushup { transform-origin:96px 92px; animation:qsPush 1s ease-in-out infinite; }
@keyframes qsPush { 0%,100%{ transform:rotate(0); } 50%{ transform:rotate(-7deg); } }

/* squats — drop and drive; feet hidden behind the ground mask */
.qs-squat { transform-origin:60px 104px; animation:qsSquat 1.1s ease-in-out infinite; }
@keyframes qsSquat { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(12px); } }

/* reading — the top page turns on the spine */
.qs-read-page { transform-origin:60px 64px; animation:qsPage 2.2s ease-in-out infinite; }
@keyframes qsPage { 0%,14%{ transform:scaleX(1); } 52%,100%{ transform:scaleX(-1); } }

/* burpee — compress to the floor, then spring */
.qs-burpee { transform-origin:60px 104px; animation:qsBurpee 1.1s cubic-bezier(.5,0,.5,1) infinite; }
@keyframes qsBurpee {
  0%{ transform:translateY(0) scaleY(1); }
  30%{ transform:translateY(18px) scaleY(.66); }
  55%{ transform:translateY(14px) scaleY(.8); }
  76%{ transform:translateY(-14px) scaleY(1.08); }
  100%{ transform:translateY(0) scaleY(1); }
}
.qs-burpee-arms { transform-origin:60px 56px; animation:qsBurpeeArms 1.1s cubic-bezier(.5,0,.5,1) infinite; }
@keyframes qsBurpeeArms { 0%,100%{ transform:rotate(0); } 30%{ transform:rotate(118deg); } 76%{ transform:rotate(-8deg); } }

/* wall sit — hold position and tremble */
.qs-wallsit { transform-origin:40px 75px; animation:qsTremor .09s linear infinite alternate; }
@keyframes qsTremor { from{ transform:translateY(-0.7px); } to{ transform:translateY(1px); } }

/* stairs — figure steps while the flight scrolls past */
.qs-stairs-bg { animation:qsStairsScroll 1.15s linear infinite; }
@keyframes qsStairsScroll { 0%{ transform:translate(0,0); } 100%{ transform:translate(-24px,16px); } }
.qs-stairs-legA, .qs-stairs-armB { transform-origin:54px 67px; animation:qsStepA .58s ease-in-out infinite alternate; }
.qs-stairs-legB, .qs-stairs-armA { transform-origin:54px 55px; animation:qsStepB .58s ease-in-out infinite alternate; }
@keyframes qsStepA { from{ transform:rotate(20deg); } to{ transform:rotate(-16deg); } }
@keyframes qsStepB { from{ transform:rotate(-16deg); } to{ transform:rotate(20deg); } }

/* loaded carry — short heavy strides */
.qs-carry { transform-origin:60px 96px; animation:qsCarryBob .5s ease-in-out infinite alternate; }
@keyframes qsCarryBob { from{ transform:translateY(0); } to{ transform:translateY(-2px); } }
.qs-carry-legA { transform-origin:60px 70px; animation:qsCarryA .5s ease-in-out infinite alternate; }
.qs-carry-legB { transform-origin:60px 70px; animation:qsCarryB .5s ease-in-out infinite alternate; }
@keyframes qsCarryA { from{ transform:rotate(10deg); } to{ transform:rotate(-10deg); } }
@keyframes qsCarryB { from{ transform:rotate(-10deg); } to{ transform:rotate(10deg); } }

/* shadow boxing — jab and hook alternate */
.qs-spar-bob { transform-origin:52px 96px; animation:qsSparBob .34s ease-in-out infinite alternate; }
@keyframes qsSparBob { from{ transform:translateY(0); } to{ transform:translateY(-3px); } }
.qs-spar-jab { transform-origin:52px 55px; animation:qsJab .5s ease-in-out infinite; }
@keyframes qsJab { 0%,100%{ transform:scaleX(1) rotate(0); } 50%{ transform:scaleX(1.9) rotate(-4deg); } }
.qs-spar-hook { transform-origin:52px 55px; animation:qsHook .5s ease-in-out -0.25s infinite; }
@keyframes qsHook { 0%,100%{ transform:scaleX(1); } 50%{ transform:scaleX(1.7) rotate(6deg); } }

/* dead hang — pendulum from the bar */
.qs-hang { transform-origin:60px 24px; animation:qsSway 2.4s ease-in-out infinite; }
@keyframes qsSway { 0%,100%{ transform:rotate(-3deg); } 50%{ transform:rotate(3deg); } }

/* ---- System windows ---- */
.syswin { position:relative; background:rgba(18,26,52,.66);
          border:1px solid rgba(123,208,224,.38); border-radius:4px; padding:16px;
          box-shadow:inset 0 0 22px rgba(123,208,224,.07); }
.syswin::before, .syswin::after { content:""; position:absolute; width:9px; height:9px; border:2px solid var(--cyan); }
.syswin::before { top:-1px; left:-1px; border-right:0; border-bottom:0; }
.syswin::after  { bottom:-1px; right:-1px; border-left:0; border-top:0; }
.syslabel { font-size:11px; font-weight:700; letter-spacing:.22em; text-transform:uppercase;
            color:var(--cyan); margin:0 0 10px; }
.sysbanner { border:1px solid rgba(226,128,128,.5); background:rgba(58,26,30,.55); color:#F0A9A9;
             border-radius:4px; padding:10px 12px; font-size:12px; font-weight:600;
             letter-spacing:.03em; line-height:1.45; margin-bottom:16px; }
.sysmodal { position:relative; background:rgba(18,26,52,.96); border:1px solid rgba(123,208,224,.55);
            border-radius:4px; padding:26px; max-width:320px; text-align:center;
            box-shadow:0 0 46px rgba(123,208,224,.16); }
.sysmodal::before, .sysmodal::after { content:""; position:absolute; width:12px; height:12px; border:2px solid var(--cyan); }
.sysmodal::before { top:-1px; left:-1px; border-right:0; border-bottom:0; }
.sysmodal::after  { bottom:-1px; right:-1px; border-left:0; border-top:0; }
.scrim { position:fixed; inset:0; background:rgba(8,10,22,.8); display:grid; place-items:center; padding:24px; z-index:50; }
.badge { width:64px; height:64px; border-radius:50%; border:2px solid var(--gold);
         display:grid; place-items:center; margin:0 auto 14px; color:var(--gold); }

.plan { border:1px solid var(--line); border-radius:12px; padding:15px; margin-bottom:10px; background:var(--panel);
        display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left; }
.plan[data-sel="true"] { border-color:var(--gold); background:#221F30; }
.tagline { font-size:11px; color:#161020; background:var(--gold); padding:2px 7px; border-radius:99px; font-weight:700; }
.strike { text-decoration:line-through; color:var(--muted); }

/* countdown */
.timer { display:flex; align-items:center; justify-content:center; gap:9px;
         background:#2A1F30; border:1px solid #4C3557; color:#F0C674;
         border-radius:10px; padding:11px 14px; margin-bottom:18px; font-size:13px; font-weight:600; }
.timer b { font-size:16px; font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.timer[data-dead="true"] { background:#241F2E; border-color:#3A3448; color:var(--muted); }

/* ============================================================= */
/*  DUNGEON THEME — painted key art background + HUD chrome        */
/* ============================================================= */

.dbg { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }

/* the real key art, viewport-locked like a wallpaper, dimmed through the
   middle band (baked into bg.webp) so content stays readable */
.dbg-bg { position:fixed; top:0; bottom:0; left:50%; width:100%; max-width:430px;
  transform:translateX(-50%); z-index:0;
  background:#05060E url(/bg.webp) top center / cover no-repeat; }
.dbg-bg::after { content:""; position:absolute; inset:0;
  box-shadow:inset 0 0 120px 44px rgba(4,6,15,.72);
  background:radial-gradient(120% 46% at 50% 8%, rgba(120,150,255,.12), transparent 60%);
  animation:gatePulse 7s ease-in-out infinite; }
@keyframes gatePulse { 0%,100%{ opacity:.7; } 50%{ opacity:1; } }

.dbg-mote { position:fixed; bottom:-12px; left:calc(var(--i) * 6.2% + 4%); width:3px; height:3px;
  border-radius:50%; background:rgba(196,178,255,.85); filter:blur(.5px); opacity:0;
  animation:mote linear infinite; animation-duration:calc(9s + var(--i) * 0.7s); animation-delay:calc(var(--i) * -1.3s); }
@keyframes mote { 0%{ transform:translateY(0) scale(.5); opacity:0; } 12%{ opacity:.9; } 88%{ opacity:.45; } 100%{ transform:translateY(-760px) scale(1); opacity:0; } }

/* --- angular HUD panels (upgrades every .panel / .syswin at once) --- */
.panel, .syswin {
  position:relative; border-radius:0;
  background:linear-gradient(180deg, rgba(19,24,49,.94), rgba(11,14,31,.96));
  border:1px solid var(--edge);
  clip-path:polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
  box-shadow:inset 0 0 26px rgba(77,160,255,.09);
}
.panel::before, .syswin::before { content:""; position:absolute; top:5px; left:5px; width:13px; height:13px;
  border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); opacity:.85; }
.panel::after, .syswin::after { content:""; position:absolute; bottom:5px; right:5px; width:13px; height:13px;
  border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); opacity:.85; }
.sysbanner { position:relative; border-radius:0;
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); }

.syslabel { font-family:inherit; }

/* --- brand lockup --- */
.brand-img { display:block; width:min(300px,80%); height:auto; margin:0 auto;
  filter:drop-shadow(0 6px 16px rgba(0,0,0,.55)) drop-shadow(0 0 30px rgba(168,123,255,.4)); }
.brand-img--mini { width:auto; height:34px; margin:0;
  filter:drop-shadow(0 0 10px rgba(168,123,255,.65)); }
.brand { text-align:center; line-height:.82; }
.brand b { display:block; font-family:inherit; font-weight:700; text-transform:uppercase;
  transform:skewX(-5deg);
  background:linear-gradient(180deg,#EAF6FF 0%, #8FD4FF 26%, #A87BFF 58%, #E86BC6 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 2px 0 #05060E) drop-shadow(0 0 24px rgba(168,123,255,.55)); }
.brand .b1 { font-size:clamp(15px,4.6vw,20px); letter-spacing:.44em; margin-bottom:.12em; }
.brand .b2 { font-size:clamp(34px,12.5vw,52px); letter-spacing:.05em; }
.brand .byline { font-family:'Chakra Petch',sans-serif; font-weight:600; letter-spacing:.38em;
  font-size:10px; color:var(--magenta); margin-top:12px; text-transform:uppercase; }
.brand--mini b { font-size:13px; letter-spacing:.16em; transform:skewX(-4deg);
  filter:drop-shadow(0 1px 0 #05060E) drop-shadow(0 0 8px rgba(168,123,255,.5)); }

/* --- top HUD bar --- */
.topbar { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:16px; }
.rankchip { display:flex; align-items:center; gap:6px; flex:none; }
.rankchip span { width:28px; height:32px; display:grid; place-items:center; font-family:inherit;
  font-weight:700; font-size:13px; color:#EDF8FF;
  background:linear-gradient(180deg,#1e2a58,#0d1330);
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);
  box-shadow:0 0 12px rgba(77,160,255,.4), inset 0 0 8px rgba(123,208,224,.28); }
.rankchip i { font-family:'Chakra Petch',sans-serif; font-style:normal; font-size:10px;
  letter-spacing:.14em; color:var(--cyan); }
.hudpills { display:flex; gap:5px; flex:none; }
.hudpill { display:flex; align-items:center; gap:4px; padding:4px 7px;
  font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; color:#EDF8FF;
  background:linear-gradient(180deg, rgba(30,38,74,.85), rgba(15,19,40,.9));
  border:1px solid var(--edge);
  clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
  box-shadow:inset 0 0 10px rgba(77,160,255,.12); }
.hudpill em { font-style:normal; font-size:9px; letter-spacing:.1em; color:var(--cyan); }
.hudpill--gold { border-color:rgba(233,196,106,.42); color:var(--gold); }
.hudpill--gold em { color:var(--gold-deep); }

/* --- battle-UI bottom nav --- */
.nav { background:linear-gradient(180deg, rgba(12,16,34,.55), rgba(8,11,24,.97));
       border-top:1px solid rgba(123,208,224,.22); backdrop-filter:blur(12px);
       padding:6px 8px calc(12px + env(safe-area-inset-bottom)); gap:6px; z-index:6; }
.nav button { display:flex; flex-direction:column; align-items:center; gap:5px; padding:9px 0 8px;
  border:1px solid transparent; color:var(--muted);
  font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:600; letter-spacing:.12em;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px); }
.nav button[data-on="true"] { color:#F1ECFF; border-color:rgba(168,123,255,.5);
  background:linear-gradient(180deg, rgba(168,123,255,.2), rgba(168,123,255,.03));
  box-shadow:0 0 16px rgba(168,123,255,.3), inset 0 0 14px rgba(168,123,255,.12); }
.navglyph { width:22px; height:22px; display:block; fill:none; stroke:currentColor;
  stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.nav button[data-on="true"] .navglyph { filter:drop-shadow(0 0 6px rgba(180,140,255,.8)); }

/* --- quest rows as energy nodes (.sl prefix outranks the button reset) --- */
.sl button.quest { border-radius:0; border:1px solid rgba(123,208,224,.16); border-left:3px solid var(--cyan);
  background:linear-gradient(180deg, rgba(22,28,54,.78), rgba(13,17,36,.86));
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); }
.sl button.quest:hover { border-color:rgba(123,208,224,.4); }
.sl button.quest.done { opacity:.5; border-left-color:var(--gold-deep); }
.sl button.quest--gate { border-left-color:var(--violet); }
.sl button.quest--pen  { border-left-color:#E27B7B; }
.sl .tick { border:0; width:24px; height:26px; background:rgba(123,208,224,.55); position:relative;
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.sl .tick::before { content:""; position:absolute; inset:1.7px; background:#0A1024;
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.sl .tick svg { position:relative; z-index:1; }
.sl .quest.done .tick { background:var(--cyan); filter:drop-shadow(0 0 6px rgba(124,224,255,.7)); }
.sl .quest.done .tick::before { background:var(--cyan); }
.qxp { font-family:'Chakra Petch',sans-serif; color:var(--cyan); }
.quest--gate .qxp { color:var(--violet); }

/* --- CTAs + option chips (.sl prefix outranks the button reset) --- */
.sl button.cta { border-radius:0; font-family:'Chakra Petch',sans-serif; letter-spacing:.07em;
  background:linear-gradient(155deg,#9CDCFF 0%, #8C7BFF 50%, #D25CDE 100%); color:#0B0716;
  clip-path:polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px);
  box-shadow:0 0 22px rgba(168,123,255,.42), inset 0 1px 0 rgba(255,255,255,.45); }
.sl button.cta.ghost { background:transparent; box-shadow:none; color:var(--muted); clip-path:none; }
.sl button.opt { border-radius:0; border:1px solid var(--edge); background:linear-gradient(180deg, rgba(23,29,58,.7), rgba(13,17,36,.8));
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); }
.sl button.opt[data-sel="true"] { border-color:var(--cyan); background:rgba(77,160,255,.12); }
.sl button.plan { border-radius:0; background:linear-gradient(180deg, rgba(23,29,58,.7), rgba(13,17,36,.8));
  border:1px solid var(--edge);
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); }
.sl button.plan[data-sel="true"] { border-color:var(--cyan); background:rgba(77,160,255,.12); }

.bar { background:#141a34; }
.bar > i { box-shadow:0 0 10px rgba(233,196,106,.5); }
.lvlnum { font-family:inherit; font-weight:700; color:var(--gold);
  filter:drop-shadow(0 0 18px rgba(233,196,106,.35)); }
.brand--mini .b1 { font-size:13px; letter-spacing:.14em; white-space:nowrap;
  filter:drop-shadow(0 1px 0 #070C24) drop-shadow(0 0 8px rgba(95,175,255,.45)); }
.brand--mini { min-width:0; overflow:hidden; }
.rank { font-family:'Chakra Petch',sans-serif; letter-spacing:.14em; color:var(--cyan); }
.grid66 .cell { border-radius:0; }
.cell[data-s="today"] { box-shadow:0 0 0 2px var(--cyan-bright), 0 0 10px rgba(124,224,255,.6); }

@media (prefers-reduced-motion: reduce) {
  .sl *, .sl *::before { animation:none !important; transition:none !important; }
}
`;

/* --------------------------- components --------------------------- */

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6.5L4.5 9L10 3" stroke="#161020" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* Counts down to a deadline stored on the save, so it survives a reload
   instead of resetting every launch. A timer that restarts on relaunch is
   the version that gets apps pulled. */
function Countdown({ until, label, expiredLabel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, (until ?? 0) - now);
  const dead = left <= 0;
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return (
    <div className="timer" data-dead={dead} role="timer" aria-live="off">
      {dead ? <span>{expiredLabel}</span> : (<><span>{label}</span><b>{mm}:{ss}</b></>)}
    </div>
  );
}

function Radar({ stats, size = 250 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const pt = (i, frac) => {
    const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [cx + Math.cos(ang) * r * frac, cy + Math.sin(ang) * r * frac];
  };
  const ring = (frac) => TRACKS.map((_, i) => pt(i, frac).join(",")).join(" ");
  const shape = TRACKS.map((t, i) => pt(i, Math.max(0.06, stats[t.id] / 100)).join(",")).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Your six stats">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#2C3157" strokeWidth="1" />
      ))}
      {TRACKS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2C3157" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="rgba(233,196,106,.22)" stroke="#E9C46A" strokeWidth="2" strokeLinejoin="round" />
      {TRACKS.map((t, i) => {
        const [x, y] = pt(i, 1.28);
        return (
          <text key={t.id} x={x} y={y} fill="#8E93B8" fontSize="12" fontWeight="600"
                textAnchor="middle" dominantBaseline="middle">{t.label}</text>
        );
      })}
    </svg>
  );
}

/* ---------------------- quest completion art --------------------- */
/* A short scene plays when a quest is cleared — one per movement, built
   from SVG + CSS so there's nothing to ship. The global
   prefers-reduced-motion rule freezes them to a still frame. */

const SceneRun = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="18" y1="106" x2="102" y2="106" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-run-bob" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="60" cy="30" r="11" strokeWidth="3.5" />
      <path d="M61 41 l-5 26" />
      <path className="qs-run-legA" d="M56 67 l-13 19" />
      <path className="qs-run-legB" d="M56 67 l15 17" />
      <path className="qs-run-armA" d="M58 48 l17 7" />
      <path className="qs-run-armB" d="M58 48 l-16 6" />
    </g>
    <g className="qs-run-lines" stroke="var(--cyan)" strokeWidth="3" strokeLinecap="round">
      <line x1="16" y1="52" x2="34" y2="52" />
      <line x1="12" y1="70" x2="30" y2="70" />
    </g>
  </svg>
);

const SceneSleep = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <path d="M18 86 h80 M22 86 v-12 a6 6 0 0 1 6 -6 h16" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-sleep-body">
      <circle cx="40" cy="72" r="9" fill="none" stroke="var(--gold)" strokeWidth="3.5" />
      <path d="M49 84 q22 -15 42 0 z" fill="rgba(233,196,106,.16)" stroke="var(--gold)" strokeWidth="3.5" strokeLinejoin="round" />
    </g>
    <text className="qs-z qs-z-a" x="62" y="54" fill="var(--cyan)" fontSize="15" fontWeight="700">z</text>
    <text className="qs-z qs-z-b" x="73" y="42" fill="var(--cyan)" fontSize="19" fontWeight="700">z</text>
    <text className="qs-z qs-z-c" x="86" y="29" fill="var(--cyan)" fontSize="23" fontWeight="700">z</text>
  </svg>
);

const SceneScreen = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <path className="qs-phone-moon" d="M82 22 a11 11 0 1 0 9 18 a9 9 0 0 1 -9 -18 z" fill="var(--gold)" />
    <g className="qs-phone">
      <rect x="42" y="28" width="36" height="62" rx="8" fill="#1F2444" stroke="var(--gold)" strokeWidth="3.5" />
      <rect className="qs-phone-screen" x="47" y="36" width="26" height="42" rx="3" fill="var(--cyan)" />
      <circle cx="60" cy="84" r="2.4" fill="var(--gold)" />
    </g>
  </svg>
);

const SceneCold = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <path d="M38 18 h44 M60 18 v6" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <path d="M47 24 h26 l-4 7 h-18 z" fill="#1F2444" stroke="var(--gold)" strokeWidth="3" strokeLinejoin="round" />
    <g className="qs-water" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round">
      <line x1="50" y1="34" x2="50" y2="46" />
      <line x1="60" y1="34" x2="60" y2="46" />
      <line x1="70" y1="34" x2="70" y2="46" />
    </g>
    <g className="qs-shiver" fill="none" stroke="var(--gold)" strokeWidth="3.5" strokeLinecap="round">
      <circle cx="60" cy="60" r="10" />
      <path d="M60 70 v20" />
      <path d="M60 76 l-13 8 M60 76 l13 8" />
      <path d="M60 90 l-9 15 M60 90 l9 15" />
    </g>
    <path className="qs-flake" d="M96 60 v16 M88 64 l16 8 M104 64 l-16 8" fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const ScenePushup = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="12" y1="98" x2="108" y2="98" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-pushup" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="30" cy="58" r="9" strokeWidth="3.5" />
      <path d="M38 62 L96 92" />
      <path d="M96 92 l6 4" />
      <path d="M44 66 L42 92" strokeWidth="3.5" />
    </g>
  </svg>
);

const SceneSquat = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <g className="qs-squat" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="60" cy="34" r="10" strokeWidth="3.5" />
      <path d="M60 44 v20" />
      <path d="M60 64 l-15 20 l-1 20" />
      <path d="M60 64 l15 20 l1 20" />
      <path d="M60 50 l-17 5 M60 50 l17 5" />
    </g>
    <line x1="16" y1="104" x2="104" y2="104" stroke="var(--ink)" strokeWidth="9" />
    <line x1="16" y1="104" x2="104" y2="104" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SceneRead = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <path d="M60 40 C 44 32, 26 34, 20 40 V 88 C 26 82, 44 80, 60 88 Z" fill="#1F2444" stroke="var(--gold)" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M60 40 C 76 32, 94 34, 100 40 V 88 C 94 82, 76 80, 60 88 Z" fill="#1F2444" stroke="var(--gold)" strokeWidth="3.5" strokeLinejoin="round" />
    <path className="qs-read-page" d="M60 40 C 76 32, 94 34, 100 40 V 88 C 94 82, 76 80, 60 88 Z" fill="#232849" stroke="var(--cyan)" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M60 38 v52" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SceneBurpee = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="16" y1="104" x2="104" y2="104" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-burpee" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="60" cy="40" r="10" strokeWidth="3.5" />
      <path d="M60 50 v26" />
      <path d="M60 76 l-12 24 M60 76 l12 24" />
      <path className="qs-burpee-arms" d="M60 56 l-16 -8 M60 56 l16 -8" />
    </g>
  </svg>
);

const SceneWallsit = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="34" y1="14" x2="34" y2="104" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
    <line x1="34" y1="104" x2="100" y2="104" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-wallsit" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="43" cy="44" r="9" strokeWidth="3.5" />
      <path d="M40 53 v22" />
      <path d="M40 75 h26" />
      <path d="M66 75 v27" />
      <path d="M46 60 h20" />
    </g>
  </svg>
);

const SceneStairs = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <g className="qs-stairs-bg">
      <path d="M-8 116 h24 v-16 h24 v-16 h24 v-16 h24 v-16 h24 v-16 h24"
            fill="none" stroke="var(--line)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </g>
    <g className="qs-stairs" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="54" cy="38" r="9" strokeWidth="3.5" />
      <path d="M54 47 v20" />
      <path className="qs-stairs-legA" d="M54 67 l-11 16" />
      <path className="qs-stairs-legB" d="M54 67 l13 12" />
      <path className="qs-stairs-armA" d="M54 53 l11 8" />
      <path className="qs-stairs-armB" d="M54 53 l-11 6" />
    </g>
  </svg>
);

const SceneCarry = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="16" y1="106" x2="104" y2="106" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-carry" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="60" cy="30" r="10" strokeWidth="3.5" />
      <path d="M60 40 v30" />
      <path className="qs-carry-legA" d="M60 70 l-9 24" />
      <path className="qs-carry-legB" d="M60 70 l10 24" />
      <path d="M48 46 v16 M72 46 v16" />
      <rect x="40" y="60" width="16" height="12" rx="2" fill="var(--cyan)" stroke="none" />
      <rect x="64" y="60" width="16" height="12" rx="2" fill="var(--cyan)" stroke="none" />
    </g>
  </svg>
);

const SceneSpar = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="16" y1="106" x2="104" y2="106" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
    <g className="qs-spar-bob" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <circle cx="52" cy="40" r="10" strokeWidth="3.5" />
      <path d="M52 50 v22" />
      <path d="M52 72 l-9 22 M52 72 l9 22" />
      <path className="qs-spar-jab" d="M52 55 l15 -2" />
      <path className="qs-spar-hook" d="M52 55 l-11 6" />
    </g>
  </svg>
);

const SceneHang = () => (
  <svg viewBox="0 0 120 120" width="94" height="94" className="qs" aria-hidden="true">
    <line x1="18" y1="24" x2="102" y2="24" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
    <g className="qs-hang" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round">
      <path d="M48 24 l3 14 M72 24 l-3 14" />
      <circle cx="60" cy="48" r="10" strokeWidth="3.5" />
      <path d="M60 58 v28" />
      <path d="M60 86 l-8 18 M60 86 l8 18" />
    </g>
  </svg>
);

function QuestScene({ scene }) {
  switch (scene) {
    case "pushup":  return <ScenePushup />;
    case "squat":   return <SceneSquat />;
    case "run":
    case "sprint":  return <SceneRun />;
    case "sleep":   return <SceneSleep />;
    case "screen":  return <SceneScreen />;
    case "read":    return <SceneRead />;
    case "cold":    return <SceneCold />;
    case "burpee":  return <SceneBurpee />;
    case "wallsit": return <SceneWallsit />;
    case "stairs":  return <SceneStairs />;
    case "carry":   return <SceneCarry />;
    case "spar":    return <SceneSpar />;
    case "hang":    return <SceneHang />;
    default:        return <SceneRun />;
  }
}

/* ------------------------------ app ------------------------------- */

const blankSave = () => ({
  v: 2,
  onboarded: false,
  pro: false,
  startDate: iso(new Date()),
  answers: null,
  xp: 0,
  lvlSeen: 1,
  log: {},
  achievements: [],
  offerEnds: null,     // intro discount deadline
  lastChanceEnds: null, // exit-intent offer deadline
  sawLastChance: false,
  offset: 0, // dev: skip days
});

const OFFER_MINUTES = 10;
const LAST_CHANCE_MINUTES = 5;

/* --------------------------- theme art --------------------------- */
/* Backdrop is the painted key art itself (public/bg.webp — the full scene
   with a dimmed middle band baked in for legibility), viewport-locked
   like a wallpaper, with drifting embers on top. */
function DungeonBg() {
  return (
    <div className="dbg" aria-hidden="true">
      <div className="dbg-bg" />
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} className="dbg-mote" style={{ "--i": i }} />
      ))}
    </div>
  );
}

/* Uses the key art from /public when present, else a styled CSS wordmark. */
function Brand({ mini }) {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <img
        className={`brand-img${mini ? " brand-img--mini" : ""}`}
        src={mini ? "/emblem.webp" : "/logo.webp"}
        alt="SelfLeveling by Wots"
        onError={() => setImgOk(false)}
      />
    );
  }
  if (mini) return <div className="brand brand--mini"><b className="b1">Self&nbsp;Leveling</b></div>;
  return (
    <div className="brand">
      <b className="b1">Self</b>
      <b className="b2">Leveling</b>
      <div className="byline">by Wots</div>
    </div>
  );
}

const NAV_GLYPH = {
  today: <path d="M11 2 L19 6 V12 C19 16 15.5 19 11 20 C6.5 19 3 16 3 12 V6 Z M8 11 l2.2 2.4 L15 8" />,
  path:  <path d="M5 20 V10 a6 6 0 0 1 12 0 V20 M3 20 h16 M11 10 v10 M8 20 v-6 M14 20 v-6" />,
  stats: <path d="M11 2 L19 7 V15 L11 20 L3 15 V7 Z M11 6 L15.5 8.8 V13 L11 15.5 L6.5 13 V8.8 Z" />,
  you:   <path d="M11 3 a3.6 3.6 0 1 0 0 7.2 a3.6 3.6 0 0 0 0 -7.2 M4 20 c0 -4 3.2 -6.5 7 -6.5 s7 2.5 7 6.5" />,
};
function NavGlyph({ id }) {
  return <svg className="navglyph" viewBox="0 0 22 22" aria-hidden="true">{NAV_GLYPH[id]}</svg>;
}

function TopBar({ rank, level, streak }) {
  return (
    <div className="topbar">
      <div className="rankchip">
        <span>{rank.replace("-Rank", "").replace("National Level", "N")}</span>
        <i>RANK</i>
      </div>
      <Brand mini />
      <div className="hudpills">
        <div className="hudpill"><em>LV</em>{level}</div>
        <div className="hudpill hudpill--gold"><em>STK</em>{streak}</div>
      </div>
    </div>
  );
}

export default function SelfLeveling() {
  const [save, setSave] = useState(null);
  const [step, setStep] = useState("welcome");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({});
  const [tab, setTab] = useState("today");
  const [celebrate, setCelebrate] = useState(null); // quest just cleared → play its scene
  const [unlocked, setUnlocked] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [plan, setPlan] = useState("year");
  const [nowTick, setNowTick] = useState(Date.now());
  const loaded = useRef(false);
  const celebrateT = useRef(null);

  /* Only tick on the offer screens — no point re-rendering the app every second. */
  useEffect(() => {
    if (step !== "paywall" && step !== "lastchance") return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    (async () => {
      const s = await store.get(SAVE_KEY);
      setSave(s && s.v === 2 ? s : blankSave());
      if (s && s.onboarded) setStep("app");
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (loaded.current && save) store.set(SAVE_KEY, save);
  }, [save]);

  /* derived */
  const today = useMemo(() => (save ? iso(addDays(new Date(), save.offset)) : null), [save]);
  const dayIndex = useMemo(() => {
    if (!save) return 0;
    return Math.min(PROGRAM_DAYS - 1, Math.max(0, daysBetween(save.startDate, today)));
  }, [save, today]);

  const quests = useMemo(
    () => (save?.answers ? questsForDay(dayIndex, save.answers) : []),
    [dayIndex, save]
  );
  const doneToday = save?.log?.[today]?.done ?? [];

  /* Miss yesterday and today opens with a Penalty Quest (Solo-Leveling rules). */
  const penaltyActive = useMemo(() => {
    if (!save || dayIndex <= 0) return false;
    const prev = iso(addDays(new Date(save.startDate + "T00:00:00"), dayIndex - 1));
    return (save.log[prev]?.done?.length ?? 0) < CLEAR_TARGET;
  }, [save, dayIndex]);
  const dayQuests = penaltyActive ? [PENALTY_QUEST, ...quests] : quests;

  const summary = useMemo(() => {
    if (!save) return null;
    const { level, into, need } = levelFromXp(save.xp);
    const byTrack = Object.fromEntries(TRACKS.map((t) => [t.id, 0]));
    let totalQuests = 0, perfectDays = 0;
    Object.entries(save.log).forEach(([date, entry]) => {
      const idx = Math.max(0, daysBetween(save.startDate, date));
      const dayQuests = save.answers ? questsForDay(Math.min(idx, PROGRAM_DAYS - 1), save.answers) : [];
      const ids = new Set(dayQuests.map((q) => q.id));
      const done = entry.done.filter((id) => ids.has(id)); // ignore Penalty / stale ids
      done.forEach((id) => {
        totalQuests += 1;
        const q = dayQuests.find((x) => x.id === id);
        if (q) byTrack[q.track] = (byTrack[q.track] ?? 0) + 1;
      });
      if (dayQuests.length && done.length === dayQuests.length) perfectDays += 1;
    });
    // streak: walk back from today while the day logged at least CLEAR_TARGET quests
    let streak = 0;
    for (let i = 0; i <= dayIndex; i++) {
      const d = iso(addDays(new Date(save.startDate + "T00:00:00"), dayIndex - i));
      const e = save.log[d];
      if (e && e.done.length >= CLEAR_TARGET) streak += 1;
      else if (i > 0) break;
    }
    const stats = Object.fromEntries(
      TRACKS.map((t) => {
        const base = save.answers ? baseFromAnswer(save.answers[t.id]) : 20;
        return [t.id, Math.min(100, Math.round(base + byTrack[t.id] * 1.6))];
      })
    );
    return { level, into, need, byTrack, totalQuests, perfectDays, streak, stats };
  }, [save, dayIndex]);

  /* achievements check */
  useEffect(() => {
    if (!save || !summary || !save.onboarded) return;
    const newly = ACHIEVEMENTS.filter(
      (a) => !save.achievements.includes(a.id) && a.test(summary)
    );
    if (newly.length) {
      setSave((s) => ({ ...s, achievements: [...s.achievements, ...newly.map((a) => a.id)] }));
      setUnlocked(newly[0]);
    }
  }, [summary, save?.onboarded]);

  /* Level-up window: fire once when the level ticks past what the player has seen. */
  useEffect(() => {
    if (!save || !summary || !save.onboarded) return;
    if (save.lvlSeen == null) { setSave((s) => ({ ...s, lvlSeen: summary.level })); return; }
    if (summary.level > save.lvlSeen) {
      setLevelUp(summary.level);
      setSave((s) => ({ ...s, lvlSeen: summary.level }));
    }
  }, [summary, save?.onboarded]);

  /* Start each offer clock the first time its screen is seen, then keep it. */
  useEffect(() => {
    if (!save) return;
    if (step === "paywall" && !save.offerEnds) {
      setSave((s) => ({ ...s, offerEnds: Date.now() + OFFER_MINUTES * 60000 }));
    }
    if (step === "lastchance" && !save.lastChanceEnds) {
      setSave((s) => ({ ...s, lastChanceEnds: Date.now() + LAST_CHANCE_MINUTES * 60000, sawLastChance: true }));
    }
  }, [step, save?.offerEnds, save?.lastChanceEnds]);

  if (!save) return <div className="sl"><style>{CSS}</style></div>;

  const offerLive = save.offerEnds ? nowTick < save.offerEnds : true;
  const lastChanceLive = save.lastChanceEnds ? nowTick < save.lastChanceEnds : true;

  /* actions */
  function toggleQuest(q) {
    const has = doneToday.includes(q.id);
    setSave((s) => {
      const cur = s.log[today]?.done ?? [];
      const next = has ? cur.filter((x) => x !== q.id) : [...cur, q.id];
      return {
        ...s,
        xp: Math.max(0, s.xp + (has ? -q.xp : q.xp)),
        log: { ...s.log, [today]: { done: next } },
      };
    });
    if (!has) {
      clearTimeout(celebrateT.current);
      setCelebrate({ scene: q.scene ?? q.track, xp: q.xp, key: Date.now() });
      celebrateT.current = setTimeout(() => setCelebrate(null), 1500);
    }
  }

  function finishQuiz(final) {
    setAnswers(final);
    setStep("analyzing");
    setTimeout(() => setStep("reveal"), 1900);
  }

  function beginProgram() {
    setSave((s) => ({ ...s, onboarded: true, answers, startDate: iso(new Date()) }));
    setStep("app");
  }

  /* ------------------------- onboarding UI ------------------------ */

  if (step === "welcome") {
    return (
      <Shell>
        <div style={{ paddingTop: 44 }}>
          <div style={{ margin: "0 0 26px" }}><Brand /></div>
          <p className="syslabel" style={{ marginBottom: 12 }}>⟦ System ⟧</p>
          <h1 className="h1 serif" style={{ fontSize: 40 }}>
            You have been selected as a Player.
          </h1>
          <p className="lede">
            For the next 66 days the System issues you a Daily Quest — training, a rotating
            Gate, and the basics that keep you standing. Clear it, level up, rank up. Miss it
            and the next day costs more. Six questions set your starting point.
          </p>
          <button className="cta" onClick={() => setStep("quiz")}>Accept</button>
        </div>
      </Shell>
    );
  }

  if (step === "quiz") {
    const q = QUIZ[qi];
    return (
      <Shell>
        <div className="bar" style={{ marginBottom: 28 }}>
          <i style={{ width: `${((qi + 1) / QUIZ.length) * 100}%` }} />
        </div>
        <p className="syslabel">⟦ Calibration {qi + 1} / {QUIZ.length} ⟧</p>
        <h2 className="h1 serif" style={{ fontSize: 30 }}>{q.q}</h2>
        <p className="lede" style={{ marginBottom: 20 }}>Answer honestly. The System sets your quests from the real starting point, not the flattering one.</p>
        {q.options.map((o, i) => (
          <button key={o} className="opt" data-sel={answers[q.id] === i}
            onClick={() => {
              const next = { ...answers, [q.id]: i };
              setAnswers(next);
              if (qi + 1 < QUIZ.length) setTimeout(() => setQi(qi + 1), 160);
              else setTimeout(() => finishQuiz(next), 160);
            }}>
            {o}
          </button>
        ))}
        {qi > 0 && <button className="cta ghost" onClick={() => setQi(qi - 1)}>Back</button>}
      </Shell>
    );
  }

  if (step === "analyzing") {
    return (
      <Shell>
        <div style={{ paddingTop: 140, textAlign: "center" }}>
          <p className="syslabel" style={{ letterSpacing: ".28em" }}>Generating Daily Quest</p>
          <p className="serif" style={{ fontSize: 30, margin: "8px 0 10px" }}>Calibrating your 66 days</p>
          <p className="muted" style={{ fontSize: 14 }}>Week one is set low enough that you clear it. That's the point.</p>
          <div className="bar" style={{ marginTop: 26 }}><i style={{ width: "100%", transition: "width 1.8s linear" }} /></div>
        </div>
      </Shell>
    );
  }

  if (step === "reveal") {
    const stats = Object.fromEntries(TRACKS.map((t) => [t.id, baseFromAnswer(answers[t.id])]));
    const overall = Math.round(Object.values(stats).reduce((a, b) => a + b, 0) / 6);
    return (
      <Shell>
        <p className="syslabel">⟦ Status Window ⟧</p>
        <h2 className="h1 serif" style={{ fontSize: 30 }}>Your starting stats</h2>
        <p className="lede">Overall {overall} out of 100. Not a verdict — a baseline. STR, AGI and VIT climb the fastest once the training starts.</p>
        <div className="panel" style={{ marginBottom: 18 }}>
          <Radar stats={stats} />
        </div>
        <div className="panel" style={{ marginBottom: 22 }}>
          {TRACKS.map((t) => (
            <div key={t.id} className="statrow">
              <span>{t.label}</span>
              <div className="bar" style={{ flex: 1 }}><i style={{ width: `${stats[t.id]}%` }} /></div>
              <b>{stats[t.id]}</b>
            </div>
          ))}
        </div>
        <button className="cta" onClick={() => setStep("paywall")}>See my program</button>
      </Shell>
    );
  }

  if (step === "paywall") {
    return (
      <Shell>
        <Countdown
          until={save.offerEnds}
          label="Your launch discount ends in"
          expiredLabel="Launch discount expired — standard pricing shown"
        />
        <p className="syslabel">⟦ Daily Quest — ready ⟧</p>
        <h2 className="h1 serif" style={{ fontSize: 32 }}>Your 66 days are ready.</h2>
        <p className="lede">Free for 7 days. Cancel any time in Settings, and we'll remind you two days before it renews.</p>

        <button className="plan" data-sel={plan === "year"} onClick={() => setPlan("year")}>
          <div>
            <div style={{ fontWeight: 600 }}>Yearly</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {offerLive ? (<><span className="strike">$99.99</span> $59.99 a year — $5.00 a month</>)
                         : (<>$99.99 a year — $8.33 a month</>)}
            </div>
          </div>
          {offerLive && <span className="tagline">Save 58%</span>}
        </button>

        <button className="plan" data-sel={plan === "month"} onClick={() => setPlan("month")}>
          <div>
            <div style={{ fontWeight: 600 }}>Monthly</div>
            <div className="muted" style={{ fontSize: 13 }}>$11.99 a month</div>
          </div>
        </button>

        <button className="cta" style={{ marginTop: 14 }}
          onClick={() => { setSave((s) => ({ ...s, pro: true })); beginProgram(); }}>
          Start free trial
        </button>
        <button className="cta ghost"
          onClick={() => (save.sawLastChance ? beginProgram() : setStep("lastchance"))}>
          Continue without it
        </button>
      </Shell>
    );
  }

  if (step === "lastchance") {
    return (
      <Shell>
        <Countdown
          until={save.lastChanceEnds}
          label="This offer closes in"
          expiredLabel="Offer closed"
        />
        <h2 className="h1 serif" style={{ fontSize: 32 }}>One offer before you go.</h2>
        <p className="lede">
          Half of people who skip the program never open the app again. Here's the lowest price we do —
          it won't be shown twice.
        </p>

        <div className="panel" style={{ textAlign: "center", padding: "26px 20px", marginBottom: 16 }}>
          <div className="muted" style={{ fontSize: 14 }}>Yearly, first year</div>
          <div className="serif" style={{ fontSize: 52, color: "var(--gold)", lineHeight: 1.05, margin: "6px 0" }}>
            {lastChanceLive ? "$29.99" : "$59.99"}
          </div>
          <div className="muted" style={{ fontSize: 14 }}>
            {lastChanceLive
              ? (<><span className="strike">$99.99</span> — that's $2.50 a month</>)
              : "Standard launch price"}
          </div>
        </div>

        <button className="cta"
          onClick={() => { setSave((s) => ({ ...s, pro: true })); beginProgram(); }}>
          {lastChanceLive ? "Claim $29.99 and start" : "Start free trial"}
        </button>
        <button className="cta ghost" onClick={beginProgram}>No thanks, start the free version</button>
      </Shell>
    );
  }

  /* ----------------------------- app ------------------------------ */

  const s = summary;

  return (
    <div className="sl">
      <style>{CSS}</style>
      <div className="sl-frame">
        <DungeonBg />
        <div className="sl-body">
          <TopBar rank={rankFor(s.level)} level={s.level} streak={s.streak} />

          {tab === "today" && (
            <>
              <p className="syslabel">⟦ Status ⟧</p>
              <div className="status">
                <div className="lvlnum">{s.level}</div>
                <div className="lvlmeta">
                  <div className="rank">{rankFor(s.level)}</div>
                  <div className="dayline">Day {dayIndex + 1} of {PROGRAM_DAYS}</div>
                </div>
              </div>
              <div className="barrow"><span>{s.into} / {s.need} XP</span><span>Level {s.level + 1}</span></div>
              <div className="bar" style={{ marginBottom: 18 }}><i style={{ width: `${(s.into / s.need) * 100}%` }} /></div>

              <div className="syswin" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
                <div className="streak"><b>{s.streak}</b><span className="muted">day streak</span></div>
                <div className="streak"><b>{doneToday.length}/{dayQuests.length}</b><span className="muted">cleared</span></div>
              </div>

              {penaltyActive && (
                <div className="sysbanner">
                  ⚠ PENALTY QUEST ADDED — yesterday's Daily Quest went uncleared.
                  Log {CLEAR_TARGET} today to clear the penalty.
                </div>
              )}

              <p className="syslabel">⟦ Daily Quest ⟧</p>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
                Log {CLEAR_TARGET} to keep the streak. Miss the day and tomorrow opens with a Penalty.
              </p>
              {dayQuests.map((q) => {
                const done = doneToday.includes(q.id);
                const isGate = q.id === "gate";
                const isPen = q.id === "penalty";
                return (
                  <button key={q.id} className={`quest${done ? " done" : ""}`}
                    onClick={() => toggleQuest(q)} aria-pressed={done}>
                    <span className="tick"><Check /></span>
                    <span style={{ flex: 1 }}>
                      {isGate && <span className="syslabel" style={{ display: "block", margin: "0 0 3px" }}>⟦ Gate ⟧</span>}
                      {isPen && <span className="syslabel" style={{ display: "block", margin: "0 0 3px", color: "#F0A9A9" }}>⟦ Penalty ⟧</span>}
                      <span className="qtitle">{q.title}</span>
                      <span className="qnote" style={{ display: "block" }}>{q.note}</span>
                    </span>
                    <span className="qxp">+{q.xp}</span>
                  </button>
                );
              })}
            </>
          )}

          {tab === "stats" && (
            <>
              <p className="syslabel">⟦ Status Window ⟧</p>
              <h2 className="h1 serif" style={{ fontSize: 28 }}>Your stats</h2>
              <p className="lede">Every cleared quest pushes its stat up. Nothing decays — you keep what you earn.</p>
              <div className="panel" style={{ marginBottom: 16 }}><Radar stats={s.stats} /></div>
              <div className="panel">
                {TRACKS.map((t) => (
                  <div key={t.id} style={{ marginBottom: 14 }}>
                    <div className="statrow" style={{ marginBottom: 5 }}>
                      <span>{t.label}</span>
                      <div className="bar" style={{ flex: 1 }}><i style={{ width: `${s.stats[t.id]}%` }} /></div>
                      <b>{s.stats[t.id]}</b>
                    </div>
                    <p className="muted" style={{ fontSize: 12, margin: 0, paddingLeft: 62 }}>{t.blurb}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "path" && (
            <>
              <p className="syslabel">⟦ Quest Log ⟧</p>
              <h2 className="h1 serif" style={{ fontSize: 28 }}>The 66 days</h2>
              <p className="lede">Gold is a logged day. The ramp steepens every week — week one is deliberately easy.</p>
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="grid66">
                  {Array.from({ length: PROGRAM_DAYS }, (_, i) => {
                    const d = iso(addDays(new Date(save.startDate + "T00:00:00"), i));
                    const e = save.log[d];
                    let st = "none";
                    if (i < dayIndex) st = !e || e.done.length === 0 ? "miss" : e.done.length >= CLEAR_TARGET ? "full" : "part";
                    if (i === dayIndex) st = "today";
                    return <div key={i} className="cell" data-s={st} title={`Day ${i + 1}`} />;
                  })}
                </div>
              </div>
              <div className="panel">
                <div className="h2">Week {Math.floor(dayIndex / 7) + 1}</div>
                <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: "6px 0 0" }}>
                  Targets step up at the start of each week. If a week breaks you, repeat it rather than
                  pushing on — the program is a floor, not a race.
                </p>
              </div>
            </>
          )}

          {tab === "you" && (
            <>
              <p className="syslabel">⟦ Records ⟧</p>
              <h2 className="h1 serif" style={{ fontSize: 28 }}>Achievements</h2>
              <p className="lede">{save.achievements.length} of {ACHIEVEMENTS.length} unlocked · {rankFor(s.level)}.</p>
              {ACHIEVEMENTS.map((a) => {
                const got = save.achievements.includes(a.id);
                return (
                  <div key={a.id} className="panel" style={{ marginBottom: 8, opacity: got ? 1 : 0.45 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{a.desc}</div>
                      </div>
                      {got && <span style={{ color: "var(--gold)", fontSize: 13, fontWeight: 700 }}>Unlocked</span>}
                    </div>
                  </div>
                );
              })}

              <div className="panel" style={{ marginTop: 20 }}>
                <div className="h2">Testing controls</div>
                <p className="muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>
                  Remove these before you ship.
                </p>
                <button className="opt" onClick={() => setSave((s2) => ({ ...s2, offset: s2.offset + 1 }))}>
                  Skip to next day (currently +{save.offset})
                </button>
                <button className="opt" onClick={() => { setSave(blankSave()); setAnswers({}); setQi(0); setStep("welcome"); }}>
                  Reset everything
                </button>
              </div>
            </>
          )}
        </div>

        <nav className="nav">
          {[["today", "QUEST"], ["path", "GATES"], ["stats", "STATUS"], ["you", "RECORDS"]].map(([id, label]) => (
            <button key={id} data-on={tab === id} onClick={() => setTab(id)}>
              <NavGlyph id={id} />{label}
            </button>
          ))}
        </nav>
      </div>

      {celebrate && (
        <div className="qcele" key={celebrate.key}>
          <div className="qcele-card">
            <QuestScene scene={celebrate.scene} />
            <div className="qcele-xp">+{celebrate.xp} XP</div>
          </div>
        </div>
      )}

      {unlocked && (
        <div className="scrim" onClick={() => setUnlocked(null)}>
          <div className="panel" style={{ maxWidth: 320, textAlign: "center", padding: 26 }}>
            <div className="badge">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>{unlocked.name}</div>
            <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>{unlocked.desc}</p>
            <button className="cta" onClick={() => setUnlocked(null)}>Nice</button>
          </div>
        </div>
      )}

      {levelUp && (
        <div className="scrim" onClick={() => setLevelUp(null)}>
          <div className="sysmodal" onClick={(e) => e.stopPropagation()}>
            <div className="syslabel" style={{ letterSpacing: ".3em" }}>⟪ Level Up ⟫</div>
            <div className="serif" style={{ fontSize: 54, color: "var(--cyan)", lineHeight: 1, margin: "6px 0 4px" }}>
              Lv {levelUp}
            </div>
            <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>
              {rankFor(levelUp)} · the ramp gets heavier from here.
            </p>
            <button className="cta" onClick={() => setLevelUp(null)}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="sl">
      <style>{CSS}</style>
      <div className="sl-frame">
        <DungeonBg />
        <div className="sl-body" style={{ paddingBottom: 32 }}>{children}</div>
      </div>
    </div>
  );
}

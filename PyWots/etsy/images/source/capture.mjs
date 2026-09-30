// Captures real PyWots screens for the Etsy mockups and video.
//
//   cd etsy/video && npm install && npm run screens
//   (or: node etsy/images/source/capture.mjs [shotName ...])
//
// Every screen is the real app, built from this repo with the Supabase keys blanked, so there's
// no sign-in wall in the shots (the live site has one once accounts are switched on). Set
// PYWOTS_URL to capture a running site instead. A save is seeded into localStorage by replaying
// real day clears from curriculum.js, so XP, stats, ranks and achievements are exactly what a
// Hunter who did those days would have. The Dungeon shots run real Python through Pyodide
// (loaded from its CDN) and submit it for grading, so they need network access.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../video/package.json"));
const { chromium } = require("playwright-core");
const cur = await import(pathToFileURL(path.join(here, "../../../curriculum.js")).href);

const LOCAL_ORIGIN = "http://pywots.local";
const URL = process.env.PYWOTS_URL ?? `${LOCAL_ORIGIN}/`;
const APP_ROOT = path.join(here, "../../..");
const BUILD = path.join(here, ".app-build"); // git-ignored
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(here, "shots");
const SAVE_KEY = "pywots:local:pywots:save:v1";
fs.mkdirSync(OUT, { recursive: true });

const dayStr = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const yesterday = dayStr(new Date(Date.now() - 86400000));

/** A save for a Hunter whose current day is `day`, having cleared every day before it on consecutive days. */
function saveAt(day, { summoned = true, hints = [] } = {}) {
  const answers = { exp: 1, flow: 1, data: 0, func: 0, oop: 0 }; // "some other languages, seen loops"
  const s = {
    createdAt: new Date(Date.now() - day * 86400000).toISOString(),
    answers, stats: cur.startingStats(answers), xp: 0, day,
    completed: {}, drafts: {}, hintDays: {}, streak: 0, bestStreak: 0, lastActive: yesterday,
    flawless: 0, achievements: [], penalty: false,
    reminder: { enabled: true, hour: 9, minute: 0 },
    summonedOn: summoned ? dayStr() : null,
  };
  for (let d = 1; d < day; d++) {
    const c = cur.dayContent(d);
    const n = c.lessons.length;
    s.completed[d] = { lessons: Array(n).fill(true), dungeon: true, boss: c.boss };
    s.xp += 8 * n + c.dungeon.xp;
    s.stats[c.stat] += n + (c.boss ? 3 : 2);
    if (c.boss) for (const st of cur.STATS) s.stats[st.id] += 1;
    if (hints.includes(d)) s.hintDays[d] = true; else s.flawless += 1;
  }
  s.streak = s.bestStreak = day - 1;
  s.achievements = cur.earnedAchievements(s);
  return s;
}

// 797 tall = an 844-pt iPhone screen minus the 47-pt status bar the mockup frame draws on top.
const PHONE = { viewport: { width: 390, height: 797 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

if (!process.env.PYWOTS_URL) {
  console.log("building the app (ungated) …");
  execSync(`npx vite build --outDir "${BUILD}" --emptyOutDir --logLevel error`, {
    cwd: APP_ROOT, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  });
}

const browser = await chromium.launch({ executablePath: CHROME });

async function open(device, save) {
  const ctx = await browser.newContext({ ...device, colorScheme: "dark" });
  if (!process.env.PYWOTS_URL) {
    // Serve the local build (SPA fallback to index.html) at a stable origin.
    await ctx.route(`${LOCAL_ORIGIN}/**`, async (route) => {
      let file = path.join(BUILD, decodeURIComponent(new globalThis.URL(route.request().url()).pathname));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(BUILD, "index.html");
      await route.fulfill({ body: fs.readFileSync(file), headers: { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" } });
    });
  }
  await ctx.addInitScript(([key, val]) => {
    try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch {}
  }, [SAVE_KEY, save === null ? null : JSON.stringify(save)]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2600); // boot splash is 2.05 s
  return page;
}

const shot = async (page, name, opts = {}) => {
  const file = path.join(OUT, `${name}.png`);
  if (opts.el) {
    // Element crops: hide the fixed chrome (nav dock, status bar, toasts) that floats over them.
    await opts.el.screenshot({ path: file, style: ".pw-dock,.pw-toast,.pw-status{display:none!important}" });
  } else {
    await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  }
  console.log("  ✓", name);
};
const tab = (page, label) => page.locator(".pw-dockbtn", { hasText: label }).click();

/** Types a solution into today's Dungeon, submits it and waits for every test to pass. */
async function clearDungeon(page, code) {
  const editor = page.locator(".pw-editor");
  await editor.fill(code);
  await page.locator(".pw-portal .pw-btn.primary").click();
  await page.waitForFunction(() => document.querySelector(".pw-portal")?.textContent.includes("CLEARED"), null, { timeout: 90000 });
  await editor.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(400);
}

const DAY9 = `def times_table(n):
    rows = []
    for i in range(1, 11):
        rows.append(f"{n} x {i} = {n * i}")
    return rows

print(times_table(7)[6])
`;
const DAY10 = `def fizzbuzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0: out.append("FizzBuzz")
        elif i % 3 == 0: out.append("Fizz")
        elif i % 5 == 0: out.append("Buzz")
        else: out.append(i)
    return out

def stairs(rows):
    return "\\n".join("#" * r for r in range(1, rows + 1))

def is_prime(x):
    if x < 2:
        return False
    for d in range(2, x):
        if x % d == 0:
            return False
    return True

def next_prime(n):
    n += 1
    while not is_prime(n):
        n += 1
    return n

print(stairs(4))
`;

const SHOTS = {
  // Awakening Test (fresh install)
  async awaken() {
    for (const [dev, tag] of [[PHONE, "phone"], [DESKTOP, "desk"]]) {
      const p = await open(dev, null);
      await shot(p, `awaken-${tag}`);
      await p.context().close();
    }
  },

  // Day 9: system message + skill codex, a lesson answered, and the Dungeon graded
  async day9() {
    for (const [dev, tag] of [[PHONE, "phone"], [DESKTOP, "desk"]]) {
      const p = await open(dev, saveAt(9, { hints: [4] }));
      await shot(p, `today-${tag}`);
      const card = p.locator(".pw-frame", { hasText: "Predict the output" }).first();
      await card.scrollIntoViewIfNeeded();
      const right = cur.dayContent(9).lessons[0].answer;
      await card.locator(".pw-choice").nth(right).click();
      // This save sits 4 XP under Level 5, so the right answer triggers the LEVEL UP burst.
      await p.waitForSelector(".pw-burst", { timeout: 3000 }).then(() => p.waitForTimeout(600)).then(() => shot(p, `levelup-${tag}`), () => {});
      await p.waitForSelector(".pw-burst", { state: "detached", timeout: 5000 });
      await p.waitForTimeout(300);
      await shot(p, `lesson-${tag}`, { el: card });
      await shot(p, `today-lesson-${tag}`);
      await clearDungeon(p, DAY9);
      await p.locator(".pw-portal").scrollIntoViewIfNeeded();
      await shot(p, `dungeon-toast-${tag}`);
      await p.waitForTimeout(5600); // let toasts clear
      await shot(p, `dungeon-${tag}`, { el: p.locator(".pw-portal") });
      await p.evaluate(() => document.querySelector(".pw-portal").scrollIntoView({ block: "end" }));
      await p.waitForTimeout(300);
      await shot(p, `dungeon-view-${tag}`);
      if (tag === "desk") {
        // A tall window, so the whole graded Dungeon sits between the status bar and the nav dock.
        await p.setViewportSize({ width: 1440, height: 1400 });
        await p.evaluate(() => scrollTo(0, document.querySelector(".pw-portal").getBoundingClientRect().top + scrollY - 92));
        await p.waitForTimeout(400);
        await shot(p, "dungeon-tall-desk");
      }
      await p.context().close();
    }
  },

  // Day 10: the D-Rank Gate boss, cleared → rank up burst
  async boss() {
    for (const [dev, tag] of [[PHONE, "phone"], [DESKTOP, "desk"]]) {
      const p = await open(dev, saveAt(10));
      await p.locator(".pw-portal").scrollIntoViewIfNeeded();
      await shot(p, `boss-open-${tag}`, { el: p.locator(".pw-portal") });
      const editor = p.locator(".pw-editor");
      await editor.fill(DAY10);
      await p.locator(".pw-portal .pw-btn.primary").click();
      await p.waitForSelector(".pw-burst", { timeout: 90000 });
      await p.waitForTimeout(700);
      await shot(p, `rankup-${tag}`);
      await p.waitForTimeout(6000);
      await shot(p, `boss-${tag}`, { el: p.locator(".pw-portal") });
      await p.context().close();
    }
  },

  // Tower + Hunter for a Hunter three weeks in (C-rank)
  async progress() {
    for (const [dev, tag] of [[PHONE, "phone"], [DESKTOP, "desk"]]) {
      const p = await open(dev, saveAt(23, { hints: [4, 13, 17] }));
      await tab(p, "Tower");
      await p.waitForTimeout(600);
      await shot(p, `tower-top-${tag}`);
      if (tag === "phone") await shot(p, "tower-list-phone", { el: p.locator(".pw-wrap") }); // all 100 Gates, for the video scroll
      await p.locator(".pw-dayrow.cur").evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.waitForTimeout(400);
      await shot(p, `tower-${tag}`);
      await tab(p, "Hunter");
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(900);
      await shot(p, `hunter-${tag}`);
      await shot(p, `hunter-full-${tag}`, { fullPage: true });
      await p.context().close();
    }
  },

  // The daily System summons
  async summons() {
    for (const [dev, tag] of [[PHONE, "phone"], [DESKTOP, "desk"]]) {
      const p = await open(dev, saveAt(12, { summoned: false }));
      await p.waitForSelector(".pw-summon");
      await p.waitForTimeout(900);
      await shot(p, `summons-${tag}`);
      await p.context().close();
    }
  },
};

const wanted = process.argv.slice(2);
for (const [name, fn] of Object.entries(SHOTS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  console.log(name);
  await fn();
}
await browser.close();
console.log(`shots in ${OUT}`);

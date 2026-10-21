/* Game Mode: the same 100-day course, played as a side-scrolling MMORPG.
   Each Day is a zone. Lesson cards are mob encounters, the day's Dungeon is
   a fight scored by the real Pyodide tests, and boss days are Gate Bosses.
   Rewards come from useDayActions, the same rules the classic view uses,
   so progress is shared both ways. Art: public/game (scripts/import_game_assets.py). */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  LessonCard, Dungeon, Radar, useDayActions, countBosses, phaseFor,
} from "../../PyWots.jsx";
import {
  STATS, PROGRAM_DAYS, BOSS_DAYS, isBossDay, levelFromXP, rankFromBosses,
  dayContent, topicFor, ACHIEVEMENTS,
} from "../../curriculum.js";
import { Engine } from "./engine.js";
import { biomeFor, bossFor, MOB_IDS, mobName, rng, reviewLessons } from "./world.js";

const BASE = import.meta.env.BASE_URL || "/";
let manifestPromise = null;
const loadManifest = () =>
  (manifestPromise ||= fetch(`${BASE}game/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json();
  }).catch((e) => { manifestPromise = null; throw e; }));

/* What a Day looks like as a zone. Built once per Day visit. */
function buildZone(day, save) {
  const content = dayContent(day);
  const rec = save.completed?.[day] || {};
  const r = rng(day * 13 + 5);
  const pickMob = () => MOB_IDS[Math.floor(r() * MOB_IDS.length)];
  const lessons = content.lessons || [];
  let mobs = lessons
    .map((lesson, idx) => ({ lesson, idx }))
    .filter(({ idx }) => !rec.lessons?.[idx])
    .map(({ lesson, idx }) => { const id = pickMob(); return { id, name: mobName(id), lesson, idx }; });
  if (!lessons.length) {
    // no authored lessons yet: wandering mobs re-ask earlier questions (practice only)
    mobs = reviewLessons(day, 2).map((lesson) => {
      const id = pickMob();
      return { id, name: `${mobName(id)} (review)`, lesson, idx: -1, review: true };
    });
  }
  const elite = pickMob();
  const boss = bossFor(day);
  return {
    day, biome: biomeFor(day), title: content.title, mobs,
    elite, eliteName: `Elite ${mobName(elite)}`,
    boss,
    dungeonDone: !!rec.dungeon,
    portalOpen: false,
    portalLabel: `DAY ${day + 1} ▶`,
  };
}

const isTyping = (el) => el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable);

function Bar({ value, max, kind, label }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`gm-bar gm-bar--${kind}`}>
      <i style={{ width: `${pct}%` }} />
      <span>{label ?? `${Math.ceil(value)} / ${max}`}</span>
    </div>
  );
}

function Win({ title, onClose, className = "", children, tone }) {
  return (
    <div className={`gm-panel gm-win ${className} ${tone ? `gm-win--${tone}` : ""}`} role="dialog" aria-label={title}
      onKeyDown={(e) => e.stopPropagation()}>
      <div className="gm-wintitle">
        <span>{title}</span>
        {onClose && <button className="gm-x" onClick={onClose} aria-label="Close">✕</button>}
      </div>
      <div className="gm-winbody">{children}</div>
    </div>
  );
}

function Portrait({ engine }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!engine) return;
    const an = engine.M.hero.idle;
    let alive = true;
    engine.load([an.src]).then(() => {
      const im = engine.img(an.src);
      const c = ref.current;
      if (!alive || !im || !c) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      // head + shoulders of idle frame 0
      ctx.drawImage(im, an.f[0][0] + 78, an.f[0][1] + 14, 104, 104, 0, 0, c.width, c.height);
    });
    return () => { alive = false; };
  }, [engine]);
  return <canvas ref={ref} width={112} height={112} className="gm-portrait" />;
}

export default function GameMode({ save, mutate, toast, toasts, py, auth, viewDay, setViewDay, onExit }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [failed, setFailed] = useState(null);
  const [loading, setLoading] = useState(1);
  const [progress, setProgress] = useState(0);
  const [snap, setSnap] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [dungeon, setDungeon] = useState(false);
  const [victory, setVictory] = useState(false);
  const [win, setWin] = useState(null); // quest | map | hero | help
  const [dead, setDead] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatOpen, setChatOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 760);
  const [banner, setBanner] = useState(null);
  const seenToasts = useRef(new Set());
  const questSeen = useRef(new Set());

  const A = useDayActions({ save, viewDay, mutate, toast });
  const { level, into, need } = levelFromXP(save.xp || 0);
  const rank = rankFromBosses(countBosses(save));
  const heroName = (auth?.email || "").split("@")[0] || "Hunter";
  const portalOpen = A.dayCleared && viewDay < PROGRAM_DAYS && (save.day || 1) > viewDay;

  const say = useCallback((kind, text) => {
    setChat((c) => [...c.slice(-60), { id: Math.random().toString(36).slice(2), kind, text }]);
  }, []);

  // app toasts (XP, achievements, warnings) land in the chat log
  useEffect(() => {
    for (const t of toasts) {
      if (seenToasts.current.has(t.id)) continue;
      seenToasts.current.add(t.id);
      say(t.kind === "ach" ? "ach" : "sys", `${t.title.replace(/^[⟢★]\s*/, "")}: ${t.body}`);
    }
  }, [toasts, say]);

  // lock page scroll underneath
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ---------- engine boot ---------- */
  const handlers = useRef({});
  useEffect(() => {
    let alive = true;
    loadManifest().then((M) => {
      if (!alive || !canvasRef.current) return;
      const on = new Proxy({}, { get: (_, k) => (...args) => handlers.current[k]?.(...args) });
      const e = new Engine(canvasRef.current, M, BASE, on);
      engineRef.current = e;
      if (import.meta.env.DEV) window.__pywotsGame = e; // poke the world from devtools
      e.start();
      setEngine(e);
    }).catch((err) => alive && setFailed(String(err.message || err)));
    return () => { alive = false; engineRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (!engine) return;
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvasRef.current);
    const iv = setInterval(() => setSnap(engine.snapshot()), 120);
    return () => { ro.disconnect(); clearInterval(iv); };
  }, [engine]);

  // hero vitals follow level
  useEffect(() => {
    if (!engine) return;
    const h = engine.hero;
    const maxHp = 100 + (level - 1) * 12;
    const maxMp = 60 + (level - 1) * 5;
    if (h.maxHp !== maxHp) { h.hp = h.hp === h.maxHp ? maxHp : Math.min(h.hp, maxHp); h.maxHp = maxHp; }
    if (h.maxMp !== maxMp) { h.maxMp = maxMp; h.mp = Math.min(h.mp, maxMp); }
    h.name = `${heroName} · Lv ${level}`;
  }, [engine, level, heroName]);

  /* ---------- zone (one per Day) ---------- */
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    const z = buildZone(viewDay, save);
    setEncounter(null); setDungeon(false); setVictory(false); setLoading(1); setProgress(0);
    engine.locked = true;
    engine.load(engine.zoneSources(z), (p) => alive && setProgress(p)).then(() => {
      if (!alive) return;
      engine.setZone(z);
      engine.portal.active = portalOpen;
      engine.locked = false;
      setLoading(0);
      setBanner({ day: viewDay, name: z.biome.name, title: z.title, boss: z.boss?.name });
      setTimeout(() => alive && setBanner(null), 3200);
      say("zone", `Entered Day ${viewDay}: ${z.title} — ${z.biome.name}.`);
      if (!questSeen.current.has(viewDay) && !A.dayCleared) {
        questSeen.current.add(viewDay);
        setTimeout(() => alive && setWin("quest"), 900);
      }
    });
    return () => { alive = false; };
  }, [engine, viewDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // progress made (here or in the classic view) opens the way forward
  useEffect(() => {
    if (!engine?.zone || engine.zone.day !== viewDay) return;
    engine.zone.portalOpen = portalOpen;
    if (engine.scene === "field") engine.portal.active = portalOpen;
    engine.gate.cleared = A.dungeonDone;
  }, [engine, portalOpen, A.dungeonDone, viewDay, loading]);

  /* ---------- engine events ---------- */
  handlers.current = {
    encounter: (m) => {
      setWin(null);
      setEncounter(m);
      say("combat", m.review ? `${m.name} challenges you to a review.` : `${m.name} blocks the path! Answer to strike.`);
    },
    gate: () => {
      setWin(null);
      engine.enterArena();
      setDungeon(true);
      setVictory(false);
      const z = engine.zone;
      if (z.boss) say("boss", `◆ GATE BOSS — ${z.boss.name} awakens. Pass every test to bring it down.`);
      else say("combat", `You enter the Dungeon. ${z.eliteName} guards the core. Each passing test lands a hit.`);
    },
    portal: () => {
      if (viewDay < (save.day || 1)) setViewDay(viewDay + 1);
    },
    loot: (label) => say("loot", `You receive [${label}].`),
    died: () => {
      setDead(true); setEncounter(null); setDungeon(false);
      say("bad", "You have fallen. The System is reviving you…");
    },
    revived: () => { setDead(false); say("sys", "Revived. Your progress is safe — try again."); },
  };

  /* ---------- lesson fights ---------- */
  const onCorrect = () => {
    const m = encounter;
    if (!m || m.dying || m.struck) return;
    m.struck = true;
    if (!m.review) A.markLesson(m.idx);
    engine.strike(m, () => {
      setEncounter((cur) => (cur === m ? null : cur));
      say("combat", m.review ? `${m.name} defeated. Good recall!` : `${m.name} defeated! Lesson cleared.`);
    });
  };
  const onWrong = () => {
    const m = encounter;
    if (!m || m.struck) return;
    const dmg = 14 + Math.floor(Math.random() * 8);
    engine.enemyStrike(m, dmg);
    say("bad", `${m.name} hits you for ${dmg}. Read the explanation and try again.`);
  };
  const flee = () => { engine.flee(); setEncounter(null); say("sys", "You step back."); };

  /* ---------- dungeon fight ---------- */
  const onResult = (res, submit) => {
    const e = engine.enemy;
    if (!e || e.dying) return;
    if (res.error) {
      const first = String(res.error).trim().split("\n").filter(Boolean).pop() || "error";
      say("bad", `Your spell fizzles — ${first}`);
      engine.cast({ fizzle: true, done: () => engine.enemyStrike(e, 12) });
      return;
    }
    if (!submit) {
      engine.cast({ hits: 1, onHit: () => engine.float(e.x, e.y - (e.plateH || 200) * 0.75, "probe", "#38e1ff", 22) });
      say("sys", "Run: your code executed. Submit to attack for real.");
      return;
    }
    const n = res.results.length || 1;
    const k = res.results.filter((r) => r.ok).length;
    if (e.maxHp !== n) { e.maxHp = n; e.hp = n; }
    const target = n - k;
    if (target > e.hp) { e.hp = target; engine.float(e.x, e.y - (e.plateH || 200) * 0.8, "regenerates", "#3df0a9", 22); }
    const hits = Math.max(0, e.hp - target);
    const won = k === n;
    say(won ? "combat" : "bad", `${k}/${n} tests passed.`);
    if (!hits) { engine.enemyStrike(e, 16); return; }
    engine.cast({
      hits,
      onHit: () => {
        e.hp = Math.max(target, e.hp - 1);
        engine.hurt(e, 120 + Math.floor(Math.random() * 90));
      },
      done: () => {
        if (won) {
          setTimeout(() => engine.die(e, () => {
            engine.drop(e.x, e.y - 160, "code_key", e.boss ? "Gate Key" : "Dungeon Key");
            setVictory(true);
            say("boss", e.boss ? `◆ ${e.name} is defeated! The Gate is cleared.` : `${e.name} is defeated! Dungeon cleared.`);
          }), 350);
        } else {
          setTimeout(() => engine.enemyStrike(e, 16), 300);
        }
      },
    });
  };
  const leaveDungeon = () => {
    engine.leaveArena(A.dungeonDone);
    engine.portal.active = portalOpen;
    setDungeon(false); setVictory(false);
  };

  // keep the fight visible: beside a window docked on the right (desktop),
  // or above the bottom sheet it becomes on phones (it grows as feedback appears)
  useEffect(() => {
    if (!engine) return;
    const el = document.querySelector(".gm-win--side");
    const upd = () => {
      const r = el?.getBoundingClientRect();
      const docked = r && window.innerWidth > 760;
      engine.setInset(docked ? window.innerWidth - r.left + 8 : 0);
      engine.setInsetBottom(r && !docked ? window.innerHeight - r.top : 0);
    };
    upd();
    const ro = el ? new ResizeObserver(upd) : null;
    ro?.observe(el);
    window.addEventListener("resize", upd);
    return () => { ro?.disconnect(); window.removeEventListener("resize", upd); engine.setInsetBottom(0); };
  }, [engine, dungeon, encounter]);

  /* ---------- input ---------- */
  const anyModal = !!(encounter || dungeon || win);
  useEffect(() => {
    if (!engine) return;
    const map = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const down = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (map[e.key]) { engine.keys[map[e.key]] = true; e.preventDefault(); return; }
      if (e.key === "Escape") { if (win) setWin(null); else if (encounter) flee(); return; }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "arrowup" || k === "w") { engine.press("jump"); e.preventDefault(); }
      else if (k === "j" || k === "1") engine.press("attack");
      else if (k === "k" || k === "2") engine.press("cast");
      else if (k === "q" || k === "3") setWin((w) => (w === "quest" ? null : "quest"));
      else if (k === "m" || k === "4") setWin((w) => (w === "map" ? null : "map"));
      else if (k === "c" || k === "5") setWin((w) => (w === "hero" ? null : "hero"));
      else if (k === "h" || k === "?") setWin((w) => (w === "help" ? null : "help"));
    };
    const up = (e) => { if (map[e.key]) engine.keys[map[e.key]] = false; };
    const blur = () => { engine.keys = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [engine, win, encounter]); // eslint-disable-line react-hooks/exhaustive-deps

  const hold = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); if (engine) engine.keys[k] = true; },
    onPointerUp: () => { if (engine) engine.keys[k] = false; },
    onPointerCancel: () => { if (engine) engine.keys[k] = false; },
    onContextMenu: (e) => e.preventDefault(),
  });

  /* ---------- derived HUD ---------- */
  const day = A.day;
  const lessonsTotal = (day.lessons || []).length;
  const lessonsDoneN = (A.rec.lessons || []).filter(Boolean).length;
  const zoneBiome = biomeFor(viewDay);
  const hp = snap?.hp ?? 100, maxHp = snap?.maxHp ?? 100, mp = snap?.mp ?? 60, maxMp = snap?.maxMp ?? 60;

  if (failed) {
    return (
      <div className="gm-root gm-root--msg">
        <style>{GM_CSS}</style>
        <div className="gm-panel gm-win gm-win--center">
          <div className="gm-wintitle"><span>Game Mode unavailable</span></div>
          <div className="gm-winbody">
            <p className="pw-read">The game art couldn’t load ({failed}). Check your connection and try again.</p>
            <button className="pw-btn primary" onClick={onExit}>Back to classic view</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`gm-root ${anyModal ? "gm-root--modal" : ""}`}>
      <style>{GM_CSS}</style>
      <canvas ref={canvasRef} className="gm-canvas" />

      {/* unit frame */}
      <div className="gm-panel gm-unit">
        <div className="gm-portraitwrap">
          <Portrait engine={engine} />
          <span className="gm-lvl">{level}</span>
        </div>
        <div className="gm-unitbody">
          <div className="gm-unitname">
            <b>{heroName}</b>
            <span className="gm-rank">{rank}-Rank</span>
            <span className="gm-streak" title="Daily streak">🔥{save.streak || 0}</span>
          </div>
          <Bar kind="hp" value={hp} max={maxHp} />
          <Bar kind="mp" value={mp} max={maxMp} />
        </div>
      </div>

      {/* minimap + system buttons */}
      <div className="gm-topright">
        <div className="gm-panel gm-minimap">
          <div className="gm-minititle">
            <span>Day {viewDay} · {zoneBiome.name}</span>
          </div>
          <div className="gm-ministrip">
            {snap && snap.scene === "field" && <>
              {snap.mobs.map((x, i) => <i key={i} className="gm-dot gm-dot--mob" style={{ left: `${(x / snap.levelW) * 100}%` }} />)}
              {snap.gate && <i className={`gm-dot ${isBossDay(viewDay) ? "gm-dot--boss" : "gm-dot--gate"} ${snap.gateCleared ? "gm-dot--cleared" : ""}`} style={{ left: `${(snap.gate / snap.levelW) * 100}%` }} />}
              {snap.portal && <i className="gm-dot gm-dot--portal" style={{ left: `${(snap.portal / snap.levelW) * 100}%` }} />}
              <i className="gm-dot gm-dot--hero" style={{ left: `${(snap.x / snap.levelW) * 100}%` }} />
            </>}
            {snap && snap.scene === "arena" && <span className="gm-ministate">{isBossDay(viewDay) ? "◆ Boss arena" : "▶ Dungeon"}</span>}
          </div>
        </div>
        <div className="gm-sysbtns">
          <button className="gm-iconbtn" onClick={() => setWin(win === "help" ? null : "help")} title="Controls (H)">?</button>
          <button className="gm-exit" onClick={onExit} title="Back to the classic view">⟵ Classic view</button>
        </div>
      </div>

      {/* quest tracker */}
      <button className="gm-panel gm-tracker" onClick={() => setWin(win === "quest" ? null : "quest")}>
        <div className="gm-trackhead">{isBossDay(viewDay) ? "◆ Gate Quest" : "Daily Quest"} · Day {viewDay}</div>
        <div className="gm-tracktitle">{day.title}</div>
        {lessonsTotal > 0 && (
          <div className={`gm-obj ${lessonsDoneN === lessonsTotal ? "done" : ""}`}>
            {lessonsDoneN === lessonsTotal ? "✓" : "◇"} Defeat training mobs ({lessonsDoneN}/{lessonsTotal})
          </div>
        )}
        <div className={`gm-obj ${A.dungeonDone ? "done" : ""}`}>
          {A.dungeonDone ? "✓" : "◇"} {isBossDay(viewDay) ? `Defeat ${bossFor(viewDay)?.name}` : "Clear the Dungeon"}
        </div>
        {A.dayCleared && viewDay < PROGRAM_DAYS && <div className="gm-obj gold">▶ Portal to Day {viewDay + 1} is open</div>}
        {A.isReplay && <div className="gm-obj dim">Replay · no rewards</div>}
      </button>

      {/* chat log */}
      <div className={`gm-panel gm-chat ${chatOpen ? "" : "gm-chat--closed"}`}>
        <button className="gm-chathead" onClick={() => setChatOpen(!chatOpen)}>
          <span>Chat · System</span><span>{chatOpen ? "▾" : "▴"}</span>
        </button>
        {chatOpen && <ChatLog lines={chat} />}
      </div>

      {/* hotbar + xp */}
      <div className="gm-bottom">
        <div className="gm-hotbar">
          {[
            ["1", "⚔", "Strike", () => engine?.press("attack")],
            ["2", "✦", "Crystal", () => engine?.press("cast")],
            ["3", "❖", "Quest", () => setWin(win === "quest" ? null : "quest")],
            ["4", "⌖", "Map", () => setWin(win === "map" ? null : "map")],
            ["5", "☗", "Hunter", () => setWin(win === "hero" ? null : "hero")],
          ].map(([key, icon, label, fn]) => (
            <button key={key} className={`gm-slot ${key <= "2" ? "gm-slot--act" : ""}`} onClick={fn} title={`${label} (${key})`}>
              <span className="gm-slotkey">{key}</span>
              <span className="gm-sloticon">{icon}</span>
              <span className="gm-slotlabel">{label}</span>
            </button>
          ))}
        </div>
        <div className="gm-xp">
          <Bar kind="xp" value={into} max={need} label={`Lv ${level} · ${into} / ${need} XP`} />
        </div>
      </div>

      {/* touch controls */}
      <div className="gm-touch gm-touch--left">
        <button className="gm-tbtn" {...hold("left")} aria-label="Move left">◀</button>
        <button className="gm-tbtn" {...hold("right")} aria-label="Move right">▶</button>
      </div>
      <div className="gm-touch gm-touch--right">
        <button className="gm-tbtn gm-tbtn--sm" onPointerDown={(e) => { e.preventDefault(); engine?.press("cast"); }} aria-label="Crystal cast">✦</button>
        <button className="gm-tbtn" onPointerDown={(e) => { e.preventDefault(); engine?.press("attack"); }} aria-label="Strike">⚔</button>
        <button className="gm-tbtn" onPointerDown={(e) => { e.preventDefault(); engine?.press("jump"); }} aria-label="Jump">⤒</button>
      </div>

      {/* encounter: a lesson card is the fight */}
      {encounter && (
        <Win title={`⚔ ${encounter.name}`} className="gm-win--side" tone={encounter.review ? "review" : "bad"}>
          <div className="gm-encsub pw-read">
            {encounter.review
              ? `Review from Day ${encounter.lesson.fromDay}. Practice only, nothing is saved.`
              : "Answer correctly to strike. A wrong answer lets it hit back. You can retry as often as you like."}
          </div>
          <LessonCard key={`${viewDay}-${encounter.idx}-${encounter.name}`} lesson={encounter.lesson} done={false}
            onDone={onCorrect} onWrong={onWrong} />
          <div className="gm-winactions">
            <button className="pw-btn" onClick={flee}>Flee</button>
          </div>
        </Win>
      )}

      {/* dungeon: the real graded challenge */}
      {dungeon && (
        <Win title={isBossDay(viewDay) ? `◆ Gate Boss · ${bossFor(viewDay)?.name}` : `▶ Dungeon · Day ${viewDay}`}
          className="gm-win--side gm-win--wide" tone={isBossDay(viewDay) ? "bad" : undefined}>
          {victory && (
            <div className="gm-victory">
              <b>{isBossDay(viewDay) ? "GATE CLEARED" : "DUNGEON CLEARED"}</b>
              <span>{A.isReplay ? "Practice run complete." : `+${day.dungeon.xp} XP · rewards distributed`}</span>
            </div>
          )}
          {snap?.enemy && !victory && (
            <div className="gm-enemybar">
              <span>Enemy HP = tests still failing</span>
              <Bar kind="hp" value={snap.enemy.hp} max={snap.enemy.maxHp}
                label={snap.enemy.maxHp > 1 ? `${snap.enemy.hp} / ${snap.enemy.maxHp} tests left` : "submit to reveal"} />
            </div>
          )}
          <Dungeon day={day} draft={A.draft} setDraft={A.setDraft} py={py}
            cleared={A.dungeonDone} onClear={A.clearDungeon}
            onHint={A.revealHint} hinted={A.hinted} onResult={onResult} />
          <div className="gm-winactions">
            <button className={`pw-btn ${victory ? "primary" : ""}`} onClick={leaveDungeon}>
              {victory ? "Return to the field" : "Leave the Dungeon"}
            </button>
          </div>
        </Win>
      )}

      {win === "quest" && (
        <Win title={`❖ Quest · Day ${viewDay}: ${day.title}`} className="gm-win--center" onClose={() => setWin(null)}>
          <div className="gm-questgiver">
            <div className="pw-eyebrow"><b>⟢ SYSTEM MESSAGE</b> · {phaseFor(viewDay)}</div>
            <div className="pw-sys">{day.system}</div>
          </div>
          {(day.concepts?.length || 0) > 0 && (
            <>
              <div className="gm-sect">Skill Codex</div>
              <ul className="pw-read gm-codex">{day.concepts.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </>
          )}
          <div className="gm-sect">Objectives</div>
          <ul className="gm-objlist">
            {lessonsTotal > 0 && <li className={lessonsDoneN === lessonsTotal ? "done" : ""}>Defeat the training mobs on the path ({lessonsDoneN}/{lessonsTotal}). Each one asks a lesson question.</li>}
            <li className={A.dungeonDone ? "done" : ""}>{isBossDay(viewDay) ? `Enter the red Gate and defeat ${bossFor(viewDay)?.name} by passing every test.` : "Enter the blue Dungeon portal and pass every test in real Python."}</li>
            <li>Reward: +{day.dungeon.xp} XP{lessonsTotal ? `, +8 XP per mob` : ""} · {STATS.find((s) => s.id === day.stat)?.label} stat</li>
          </ul>
          <div className="gm-winactions">
            <button className="pw-btn primary" onClick={() => setWin(null)}>{A.dayCleared ? "Close" : "Accept quest"}</button>
          </div>
        </Win>
      )}

      {win === "map" && (
        <Win title="⌖ World Map · The Tower" className="gm-win--center gm-win--map" onClose={() => setWin(null)}>
          <WorldMap save={save} viewDay={viewDay} onTravel={(d) => { setWin(null); if (d !== viewDay) setViewDay(d); }} />
        </Win>
      )}

      {win === "hero" && (
        <Win title={`☗ ${heroName} · Hunter`} className="gm-win--center" onClose={() => setWin(null)}>
          <div className="gm-herogrid">
            <div><span>Rank</span><b className="gm-big">{rank}</b></div>
            <div><span>Level</span><b className="gm-big">{level}</b></div>
            <div><span>Total XP</span><b>{save.xp || 0}</b></div>
            <div><span>Gates</span><b>{countBosses(save)} / {Object.keys(BOSS_DAYS).length}</b></div>
            <div><span>Streak</span><b>🔥 {save.streak || 0} <small>(best {save.bestStreak || 0})</small></b></div>
            <div><span>Achievements</span><b>{(save.achievements || []).length} / {ACHIEVEMENTS.length}</b></div>
          </div>
          <div className="gm-sect">Stats</div>
          <Radar stats={save.stats || {}} />
          <div className="gm-statlist">
            {STATS.map((s) => <div key={s.id}><span>{s.label}</span><b>{save.stats?.[s.id] || 0}</b></div>)}
          </div>
        </Win>
      )}

      {win === "help" && (
        <Win title="Controls" className="gm-win--center" onClose={() => setWin(null)}>
          <ul className="gm-help pw-read">
            <li><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd>: move. <kbd>Space</kbd>/<kbd>W</kbd>: jump.</li>
            <li><kbd>1</kbd>/<kbd>J</kbd>: strike. <kbd>2</kbd>/<kbd>K</kbd>: crystal cast (15 MP), which pulls a mob into a fight.</li>
            <li><kbd>3</kbd>/<kbd>Q</kbd> quest · <kbd>4</kbd>/<kbd>M</kbd> map · <kbd>5</kbd>/<kbd>C</kbd> hunter · <kbd>Esc</kbd> close / flee.</li>
            <li>Walk into a mob to fight it: its lesson question is the battle. The blue portal is the Dungeon, the red one a Gate Boss: your code’s passing tests are your hits.</li>
            <li>Clear the day and a gold portal opens to the next one. Progress is the same save as the classic view.</li>
          </ul>
        </Win>
      )}

      {banner && !anyModal && (
        <div className="gm-banner" key={banner.day}>
          <span className="gm-banner-eye">Day {banner.day} · {banner.name}</span>
          <b>{banner.title}</b>
          {banner.boss && <span className="gm-banner-boss">◆ Gate Boss: {banner.boss}</span>}
        </div>
      )}

      {dead && (
        <div className="gm-dead">
          <b>YOU HAVE FALLEN</b>
          <span>The System is reviving you…</span>
        </div>
      )}

      {(loading > 0 || !engine) && (
        <div className="gm-loading">
          <div className="gm-loadtitle">{engine ? `Opening Day ${viewDay}` : "Entering Game Mode"}</div>
          <div className="gm-loadbar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <div className="pw-muted" style={{ fontSize: 12 }}>{zoneBiome.name}</div>
        </div>
      )}
    </div>
  );
}

function ChatLog({ lines }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]);
  return (
    <div className="gm-chatlog" ref={ref}>
      {lines.length === 0 && <div className="gm-line sys">[System] Welcome, Hunter. Walk right to begin.</div>}
      {lines.map((l) => <div key={l.id} className={`gm-line ${l.kind}`}>[{LABEL[l.kind] || "System"}] {l.text}</div>)}
    </div>
  );
}
const LABEL = { sys: "System", ach: "Achievement", combat: "Combat", bad: "Combat", loot: "Loot", zone: "Zone", boss: "Gate" };

function WorldMap({ save, viewDay, onTravel }) {
  const cur = save.day || 1;
  const groups = useMemo(() => {
    const out = [];
    for (let d = 1; d <= PROGRAM_DAYS; d++) {
      const b = biomeFor(d).name;
      if (!out.length || out[out.length - 1].name !== b) out.push({ name: b, phase: phaseFor(d), days: [] });
      out[out.length - 1].days.push(d);
    }
    return out;
  }, []);
  return (
    <div className="gm-map">
      {groups.map((g) => (
        <div key={g.name} className="gm-region">
          <div className="gm-regionname">{g.name} <small>{g.phase}</small></div>
          <div className="gm-nodes">
            {g.days.map((d) => {
              const done = !!save.completed?.[d]?.dungeon;
              const locked = d > cur;
              const meta = d <= 10 ? dayContent(d) : topicFor(d);
              return (
                <button key={d} disabled={locked} onClick={() => onTravel(d)}
                  className={`gm-node ${isBossDay(d) ? "boss" : ""} ${done ? "done" : ""} ${d === viewDay ? "here" : ""} ${d === cur ? "cur" : ""}`}
                  title={`Day ${d}: ${meta?.title || ""}${locked ? " (locked)" : ""}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="gm-maplegend pw-muted">◆ red = Gate Boss · green = cleared · gold ring = you are here · locked days open as you clear the Tower.</div>
    </div>
  );
}

const GM_CSS = `
.gm-root{position:fixed;inset:0;z-index:65;background:#06060d;color:var(--text);font-family:var(--sans);
  overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none;
  --gold1:#f6d27a;--gold2:#a8802f;--edge:rgba(214,170,84,.55)}
.gm-root--msg{display:grid;place-items:center}
.gm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.gm-panel{background:linear-gradient(180deg,rgba(22,19,40,.9),rgba(9,9,22,.92));border:1px solid var(--edge);
  border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,220,150,.07),inset 0 1px 0 rgba(255,230,170,.12),0 10px 30px rgba(0,0,0,.55)}
.gm-root button{font-family:inherit}

/* unit frame */
.gm-unit{position:absolute;top:calc(10px + env(safe-area-inset-top));left:calc(10px + env(safe-area-inset-left));
  display:flex;gap:10px;align-items:center;padding:8px 12px 8px 8px;width:min(330px,calc(100vw - 20px))}
.gm-portraitwrap{position:relative;flex:none}
.gm-portrait{width:56px;height:56px;border-radius:50%;display:block;border:2px solid var(--gold1);
  background:radial-gradient(circle at 50% 35%,#2b2552,#0b0a1a);box-shadow:0 0 14px rgba(154,123,255,.45)}
.gm-lvl{position:absolute;bottom:-4px;right:-4px;min-width:22px;height:22px;border-radius:11px;padding:0 5px;
  display:grid;place-items:center;font:800 11px var(--display);color:#1a1205;background:linear-gradient(180deg,#ffe08a,#e2a530);border:1px solid #fff3c4}
.gm-unitbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.gm-unitname{display:flex;align-items:center;gap:8px;min-width:0;font-size:15px}
.gm-unitname b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7dffb2}
.gm-rank{font:800 10px var(--display);letter-spacing:.08em;color:var(--cyan);border:1px solid rgba(56,225,255,.5);border-radius:4px;padding:1px 5px;flex:none}
.gm-streak{margin-left:auto;font-size:12px;flex:none}
.gm-bar{position:relative;height:14px;border-radius:7px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.12);overflow:hidden}
.gm-bar i{position:absolute;inset:0 auto 0 0;border-radius:7px;transition:width .35s ease}
.gm-bar span{position:relative;display:block;text-align:center;font:700 10px/13px var(--sans);letter-spacing:.04em;color:#fff;text-shadow:0 1px 2px #000}
.gm-bar--hp i{background:linear-gradient(180deg,#ff7a7a,#c0263b)}
.gm-bar--mp i{background:linear-gradient(180deg,#6fb8ff,#2747c9)}
.gm-bar--xp{height:12px}
.gm-bar--xp i{background:linear-gradient(90deg,#9a7bff,#e56bff,#ffc24b)}

/* minimap */
.gm-topright{position:absolute;top:calc(10px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right));
  display:flex;flex-direction:column;align-items:flex-end;gap:6px;width:min(300px,40vw)}
.gm-minimap{width:100%;padding:7px 10px 9px}
.gm-minititle{font:800 10.5px var(--display);letter-spacing:.08em;color:var(--gold1);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm-ministrip{position:relative;height:18px;margin-top:6px;border-radius:9px;background:linear-gradient(90deg,rgba(56,225,255,.08),rgba(154,123,255,.12));border:1px solid rgba(255,255,255,.1)}
.gm-ministate{display:block;text-align:center;font:700 11px/16px var(--sans);color:var(--dim)}
.gm-dot{position:absolute;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%}
.gm-dot--mob{background:#ff6b6b;box-shadow:0 0 6px #ff6b6b}
.gm-dot--gate{background:var(--cyan);box-shadow:0 0 8px var(--cyan);width:11px;height:11px;margin:-5.5px 0 0 -5.5px}
.gm-dot--boss{background:#ff3d63;box-shadow:0 0 8px #ff3d63;transform:rotate(45deg);border-radius:2px;width:11px;height:11px;margin:-5.5px 0 0 -5.5px}
.gm-dot--portal{background:var(--gold);box-shadow:0 0 8px var(--gold)}
.gm-dot--cleared{background:#7d86a3;box-shadow:none;opacity:.7}
.gm-dot--hero{background:#7dffb2;box-shadow:0 0 8px #7dffb2;border:1.5px solid #fff;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;z-index:1}
.gm-sysbtns{display:flex;gap:6px}
.gm-exit,.gm-iconbtn{cursor:pointer;font:800 11px var(--display);letter-spacing:.08em;color:var(--text);
  background:rgba(10,10,24,.85);border:1px solid var(--edge);border-radius:8px;padding:7px 10px}
.gm-exit:hover,.gm-iconbtn:hover{color:#fff;border-color:var(--gold1);box-shadow:0 0 12px rgba(246,210,122,.35)}
.gm-iconbtn{width:32px;padding:7px 0}

/* quest tracker */
.gm-tracker{position:absolute;right:calc(10px + env(safe-area-inset-right));top:calc(120px + env(safe-area-inset-top));width:min(280px,40vw);
  text-align:left;padding:9px 12px;cursor:pointer;color:var(--text)}
.gm-tracker:hover{border-color:var(--gold1)}
.gm-trackhead{font:800 10px var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--gold1)}
.gm-tracktitle{font-weight:700;font-size:15px;margin:2px 0 4px;color:#fff}
.gm-obj{font-size:13px;color:#e8e2c8;margin-top:2px}
.gm-obj.done{color:var(--ok)}
.gm-obj.gold{color:var(--gold)}
.gm-obj.dim{color:var(--dim)}

/* chat */
.gm-chat{position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(64px + env(safe-area-inset-bottom));width:min(380px,36vw);
  display:flex;flex-direction:column;background:rgba(6,6,16,.62);backdrop-filter:blur(2px)}
.gm-chathead{display:flex;justify-content:space-between;background:none;border:0;border-bottom:1px solid rgba(214,170,84,.25);
  color:var(--gold1);font:800 10px var(--display);letter-spacing:.1em;text-transform:uppercase;padding:6px 10px;cursor:pointer}
.gm-chat--closed .gm-chathead{border-bottom:0}
.gm-chatlog{height:150px;overflow-y:auto;padding:6px 10px 8px;font:500 13px/1.35 var(--read);user-select:text;-webkit-user-select:text}
.gm-line{margin:1px 0;color:#f4e7b0}
.gm-line.combat{color:#ffb38a}.gm-line.bad{color:#ff8c9e}.gm-line.loot{color:#7dffb2}
.gm-line.ach{color:var(--gold)}.gm-line.zone{color:var(--cyan)}.gm-line.boss{color:#ff5c7a;font-weight:700}

/* hotbar + xp */
.gm-bottom{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;align-items:center;gap:6px;width:min(560px,calc(100vw - 20px))}
.gm-hotbar{display:flex;gap:6px;padding:6px;border-radius:12px;background:rgba(8,8,20,.78);border:1px solid var(--edge)}
.gm-slot{position:relative;width:54px;height:54px;border-radius:9px;cursor:pointer;color:#fff;
  background:radial-gradient(circle at 50% 30%,#2f2a55,#100e24);border:1px solid rgba(214,170,84,.6);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}
.gm-slot:hover{border-color:var(--gold1);box-shadow:0 0 14px rgba(246,210,122,.4)}
.gm-slot:active{transform:translateY(1px)}
.gm-slotkey{position:absolute;top:2px;left:5px;font:700 10px var(--sans);color:var(--gold1)}
.gm-sloticon{font-size:20px;line-height:1}
.gm-slotlabel{font:700 9.5px var(--sans);letter-spacing:.05em;color:#cfc6a6}
.gm-xp{width:100%}

/* touch */
.gm-touch{position:absolute;bottom:calc(84px + env(safe-area-inset-bottom));display:none;gap:10px}
.gm-touch--left{left:calc(12px + env(safe-area-inset-left))}
.gm-touch--right{right:calc(12px + env(safe-area-inset-right));align-items:flex-end}
.gm-tbtn{width:62px;height:62px;border-radius:50%;font-size:24px;color:#fff;touch-action:none;
  background:radial-gradient(circle at 50% 35%,rgba(60,52,110,.85),rgba(14,12,32,.85));border:1.5px solid var(--edge);
  box-shadow:0 4px 16px rgba(0,0,0,.5)}
.gm-tbtn:active{background:radial-gradient(circle at 50% 35%,rgba(110,90,200,.9),rgba(30,24,60,.9))}
.gm-tbtn--sm{width:48px;height:48px;font-size:19px}
@media (pointer:coarse){.gm-touch{display:flex}.gm-slot--act{display:none}}

/* windows */
.gm-win{position:absolute;display:flex;flex-direction:column;max-height:calc(100% - 24px);user-select:text;-webkit-user-select:text;touch-action:auto;z-index:5}
.gm-wintitle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;
  border-bottom:1px solid rgba(214,170,84,.35);background:linear-gradient(180deg,rgba(246,210,122,.12),rgba(246,210,122,0));
  font:800 13px var(--display);letter-spacing:.06em;color:var(--gold1);border-radius:10px 10px 0 0}
.gm-win--bad .gm-wintitle{color:#ff8c9e;border-bottom-color:rgba(255,92,122,.4);background:linear-gradient(180deg,rgba(255,92,122,.14),rgba(255,92,122,0))}
.gm-win--bad{border-color:rgba(255,92,122,.55)}
.gm-win--review .gm-wintitle{color:#c9b8ff}
.gm-x{background:none;border:0;color:var(--dim);font-size:16px;cursor:pointer;padding:0 2px}
.gm-x:hover{color:#fff}
.gm-winbody{padding:12px 14px 14px;overflow-y:auto;overscroll-behavior:contain}
.gm-winbody .pw-frame{background:rgba(5,6,18,.6)}
.gm-winactions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.gm-win--side{right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));bottom:calc(10px + env(safe-area-inset-bottom));
  width:min(470px,46vw);max-height:none}
.gm-win--wide{width:min(560px,52vw)}
.gm-win--center{left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 100vmax rgba(3,3,10,.5),0 10px 30px rgba(0,0,0,.55);width:min(620px,calc(100vw - 24px));max-height:min(86vh,760px)}
.gm-win--map{width:min(760px,calc(100vw - 24px))}
.gm-root--modal .gm-tracker,.gm-root--modal .gm-topright{opacity:0;pointer-events:none}
.gm-encsub{font-size:13px;color:var(--dim);margin-bottom:2px}
.gm-enemybar{margin-bottom:6px}
.gm-enemybar span{display:block;font:700 10.5px var(--display);letter-spacing:.06em;color:#ff8c9e;margin-bottom:4px;text-transform:uppercase}
.gm-victory{text-align:center;padding:12px;margin-bottom:6px;border-radius:8px;border:1px solid rgba(255,194,75,.5);
  background:radial-gradient(circle at 50% 0%,rgba(255,194,75,.25),rgba(0,0,0,0))}
.gm-victory b{display:block;font:900 22px var(--display);letter-spacing:.12em;color:var(--gold);text-shadow:0 0 18px rgba(255,194,75,.7)}
.gm-victory span{font-size:13px;color:#f4e7b0}
.gm-questgiver{border:1px solid rgba(56,225,255,.3);border-radius:8px;padding:10px 12px;background:rgba(56,225,255,.05)}
.gm-sect{font:800 11px var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--gold1);margin:14px 0 6px}
.gm-codex{margin:0;padding-left:18px;line-height:1.6;font-size:14px}
.gm-codex li{margin-bottom:6px}
.gm-objlist{margin:0;padding-left:18px;font-size:14px;line-height:1.5}
.gm-objlist li.done{color:var(--ok);text-decoration:line-through;text-decoration-color:rgba(61,240,169,.5)}
.gm-herogrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gm-herogrid div,.gm-statlist div{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 10px}
.gm-herogrid span,.gm-statlist span{display:block;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}
.gm-herogrid b{font-size:15px}
.gm-big{font:900 24px var(--display);color:var(--cyan)}
.gm-statlist{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
.gm-help{margin:0;padding-left:18px;line-height:1.8;font-size:14px}
.gm-help kbd{display:inline-block;min-width:22px;text-align:center;padding:0 5px;margin:0 2px;border-radius:4px;
  border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);font:700 12px var(--mono)}

/* world map */
.gm-map{display:flex;flex-direction:column;gap:10px}
.gm-regionname{font:800 12px var(--display);letter-spacing:.06em;color:var(--gold1);margin-bottom:5px}
.gm-regionname small{font:600 11px var(--sans);color:var(--dim);margin-left:6px;letter-spacing:.04em}
.gm-nodes{display:flex;flex-wrap:wrap;gap:5px}
.gm-node{width:36px;height:30px;border-radius:6px;cursor:pointer;font:700 12px var(--sans);color:var(--text);
  background:rgba(56,225,255,.06);border:1px solid rgba(56,225,255,.3)}
.gm-node:hover:not(:disabled){border-color:var(--cyan);box-shadow:0 0 10px rgba(56,225,255,.4)}
.gm-node:disabled{opacity:.3;cursor:not-allowed}
.gm-node.boss{border-color:rgba(255,92,122,.7);color:#ff8c9e}
.gm-node.done{background:rgba(61,240,169,.14);border-color:rgba(61,240,169,.6);color:var(--ok)}
.gm-node.cur{box-shadow:inset 0 0 0 1px var(--cyan)}
.gm-node.here{outline:2px solid var(--gold);outline-offset:1px}
.gm-maplegend{font-size:12px}

/* banners */
.gm-banner{position:absolute;left:50%;top:22%;transform:translateX(-50%);text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:4px;animation:gm-banner 3.2s ease forwards;width:90vw}
.gm-banner-eye{font:800 12px var(--display);letter-spacing:.3em;text-transform:uppercase;color:var(--gold1);text-shadow:0 2px 6px #000}
.gm-banner b{font:900 clamp(24px,4.2vw,44px) var(--display);letter-spacing:.06em;color:#fff;text-shadow:0 0 22px rgba(154,123,255,.8),0 3px 8px #000}
.gm-banner-boss{font:800 13px var(--display);letter-spacing:.16em;color:#ff5c7a;text-shadow:0 2px 6px #000}
@keyframes gm-banner{0%{opacity:0;transform:translate(-50%,10px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}
.gm-dead{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  background:radial-gradient(circle,rgba(60,0,10,.35),rgba(0,0,0,.75));pointer-events:none;z-index:6}
.gm-dead b{font:900 clamp(26px,5vw,52px) var(--display);letter-spacing:.14em;color:#ff4d6d;text-shadow:0 0 30px rgba(255,60,90,.8)}
.gm-dead span{color:#f4d6dc}
.gm-loading{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#06060d}
.gm-loadtitle{font:900 18px var(--display);letter-spacing:.16em;color:var(--gold1);text-transform:uppercase}
.gm-loadbar{width:min(320px,70vw);height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid var(--edge)}
.gm-loadbar i{display:block;height:100%;background:linear-gradient(90deg,#9a7bff,#ffc24b);transition:width .2s}

/* phones + narrow windows */
@media (max-width:760px){
  .gm-unit{width:min(250px,calc(100vw - 150px));padding:6px 8px 6px 6px;gap:7px}
  .gm-portrait{width:42px;height:42px}
  .gm-unitname{font-size:13px}
  .gm-streak{display:none}
  .gm-bar{height:12px}.gm-bar span{font-size:9px;line-height:11px}
  .gm-topright{width:130px}
  .gm-minimap{padding:5px 7px 7px}
  .gm-exit{font-size:9.5px;padding:6px 7px}
  .gm-tracker{display:none}
  .gm-chat{width:calc(100vw - 20px);bottom:calc(150px + env(safe-area-inset-bottom))}
  .gm-chatlog{height:84px;font-size:12px}
  .gm-slot{width:46px;height:46px}.gm-slotlabel{display:none}
  .gm-touch{bottom:calc(76px + env(safe-area-inset-bottom))}
  .gm-win--side,.gm-win--wide{left:6px;right:6px;width:auto;top:auto;bottom:calc(6px + env(safe-area-inset-bottom));max-height:54%}
  .gm-win--side .gm-wintitle{padding:7px 12px;font-size:12px}
  .gm-win--side .gm-winbody{padding:8px 10px 10px}
  .gm-win--side .gm-encsub{display:none}
  .gm-win--side .pw-frame{margin-top:4px !important;padding:10px 12px}
  .gm-win--side .pw-choice{padding:9px 11px;margin:5px 0}
  .gm-win--side .gm-winactions{margin-top:8px}
  .gm-root--modal .gm-chat,.gm-root--modal .gm-touch,.gm-root--modal .gm-bottom{display:none}
  .gm-herogrid,.gm-statlist{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:760px) and (pointer:coarse){
  .gm-chat{bottom:calc(150px + env(safe-area-inset-bottom))}
}
@media (prefers-reduced-motion:reduce){.gm-banner{animation:none}}
`;

/* Game Mode engine: a small canvas side-scroller. The world is authored in
   the asset pack's 1x units (768 tall, walk line at y=522); the canvas scales
   it to fit. React (GameMode.jsx) owns the UI and the lesson/dungeon logic and
   drives this through a handful of commands (strike, mobHit, cast, ...);
   the engine reports back through `on` callbacks (encounter, gate, portal...). */
import { FIELD, rng } from "./world.js";

const VIEW_H = 768;
const WALK_Y = 522;
const FLOOR_TOP = 512;
const FILL_Y = 640;
const MIN_VIEW_W = 760;
const GRAVITY = 2600;
const SPEED = 420;
const JUMP_V = 1050;
const CONTACT = 170; // hero halts this far from a mob and the fight starts
const GATE_WALL = 60; // an uncleared gate is a wall this far before its centre

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function actor(anims, artFace, props = {}) {
  return {
    anims, artFace, face: artFace, x: 0, y: WALK_Y, vx: 0, vy: 0, ground: true,
    anim: null, animName: null, i: 0, t: 0, loop: true, done: null, at: null,
    scale: 1, alpha: 1, flash: 0, offX: 0, offY: 0, hp: 1, maxHp: 1, dead: false, busy: false,
    ...props,
  };
}

function play(a, name, { loop = true, done = null, at = null } = {}) {
  const anim = a.anims[name];
  if (!anim) { done?.(); return false; }
  if (a.animName === name && loop && a.loop) return true;
  a.animName = name; a.anim = anim; a.i = 0; a.t = 0; a.loop = loop; a.done = done; a.at = at;
  a.at?.[0]?.();
  return true;
}

function stepAnim(a, dt) {
  const an = a.anim;
  if (!an) return;
  a.t += dt * 1000;
  while (a.t >= an.d[a.i]) {
    a.t -= an.d[a.i];
    if (a.i + 1 < an.f.length) {
      a.i++;
      a.at?.[a.i]?.();
    } else if (a.loop) {
      a.i = 0;
    } else {
      a.t = 0;
      const cb = a.done;
      a.done = null;
      cb?.();
      break;
    }
  }
}

/* a still image dressed up as a one-frame animation (boss concept art) */
const stillAnim = (img) => ({ src: img.src, w: img.w, h: img.h, px: 0.5, py: 0, f: [[0, 0]], d: [1e9] });

export class Engine {
  constructor(canvas, manifest, base, on = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.M = manifest;
    this.base = base.replace(/\/$/, "");
    this.on = on;
    this.imgs = new Map();
    this.keys = {};
    this.time = 0;
    this.fc = document.createElement("canvas"); // white-flash scratch
    this.fctx = this.fc.getContext("2d");
    this.hero = actor(manifest.hero, 1, { name: "Hunter", hp: 100, maxHp: 100, mp: 60, maxMp: 60 });
    this.mobs = [];
    this.enemy = null;
    this.fx = [];
    this.texts = [];
    this.shots = [];
    this.pickups = [];
    this.tweens = [];
    this.props = [];
    this.gate = null;
    this.portal = null;
    this.locked = false;
    this.zone = null;
    this.scene = "field";
    this.camX = 0;
    this.shake = 0;
    this.insetR = 0; // css px covered by a docked window on the right
    this.insetB = 0; // css px covered by a bottom sheet (phones)
    this.raf = 0;
    this.last = 0;
    this.resize();
  }

  /* ---------------- assets ---------------- */
  url(src) { return this.base + src; }
  img(src) {
    const im = this.imgs.get(src);
    return im && im.complete && im.naturalWidth ? im : null;
  }
  load(srcs, onProgress) {
    let n = 0;
    const list = [...new Set(srcs.filter(Boolean))];
    return Promise.all(list.map((src) => new Promise((res) => {
      let im = this.imgs.get(src);
      const fin = () => { n++; onProgress?.(n / list.length); res(); };
      if (im && im.complete) return fin();
      if (!im) { im = new Image(); im.decoding = "async"; im.src = this.url(src); this.imgs.set(src, im); }
      im.addEventListener("load", fin, { once: true });
      im.addEventListener("error", fin, { once: true });
    })));
  }
  zoneSources(z) {
    const M = this.M;
    const anims = (o) => Object.values(o || {}).map((a) => a.src);
    const out = [
      M.bg[z.biome.env]?.src, M.tiles[z.biome.set]?.top.src, M.tiles[z.biome.set]?.fill.src,
      M.layers[z.biome.set]?.mid.src, M.layers[z.biome.set]?.fg.src,
      ...Object.values(M.props[z.biome.set] || {}).map((p) => p.src),
      ...anims(M.hero), ...anims(M.items), ...anims(M.fx),
    ];
    for (const m of z.mobs) out.push(...anims(M.mobs[m.id]));
    if (z.elite) out.push(...anims(M.mobs[z.elite]));
    if (z.boss) {
      const B = M.bosses[z.boss.id];
      out.push(B?.still.src, B?.idle?.src, B?.overlay_rot?.src, M.arenas[z.boss.id]?.src);
    }
    return out;
  }

  /* ---------------- sizing ---------------- */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.c.clientWidth || 1;
    const H = this.c.clientHeight || 1;
    this.c.width = Math.round(W * dpr);
    this.c.height = Math.round(H * dpr);
    let s = H / VIEW_H;
    const minW = W < 520 ? 600 : MIN_VIEW_W; // phones: zoom in a little
    if (W / s < minW) s = W / minW;
    this.dpr = dpr; this.W = W; this.H = H; this.s = s;
    this.viewW = W / s;
    // portrait: pin the world under the HUD and let the floor run to the bottom
    this.baseOy = Math.max(0, Math.min((H - VIEW_H * s) / 2, 64));
    this.oy = this.targetOy();
    if (this.scene === "arena") this.placeArena();
  }

  /* ---------------- scenes ---------------- */
  setZone(z) {
    this.zone = z;
    this.scene = "field";
    this.enemy = null;
    this.fx = []; this.shots = []; this.pickups = []; this.texts = []; this.tweens = [];
    const r = rng(z.day * 97 + 3);
    this.mobs = z.mobs.map((m, i) => {
      const a = actor(this.M.mobs[m.id], -1, {
        id: m.id, name: m.name, lesson: m.lesson, idx: m.idx, review: m.review,
        x: FIELD.firstMob + i * FIELD.gap, hp: 1, maxHp: 1,
      });
      play(a, "idle");
      a.i = Math.floor(r() * a.anim.f.length); // de-sync idles
      return a;
    });
    const lastX = this.mobs.length ? this.mobs[this.mobs.length - 1].x : FIELD.firstMob - FIELD.gap;
    this.gate = { x: lastX + FIELD.gap + 80, boss: !!z.boss, cleared: z.dungeonDone, inside: false };
    this.portal = { x: this.gate.x + 640, active: z.portalOpen, inside: false, label: z.portalLabel };
    this.levelW = this.portal.x + 420;
    // set dressing
    const set = this.M.props[z.biome.set] || {};
    const floorProps = Object.entries(set).filter(([, p]) => !p.hang);
    const hangProps = Object.entries(set).filter(([, p]) => p.hang);
    this.props = [];
    for (let x = 520; x < this.levelW; x += 380 + r() * 360) {
      if (Math.abs(x - this.gate.x) < 260 || Math.abs(x - this.portal.x) < 220) continue;
      const pool = r() < 0.22 && hangProps.length ? hangProps : floorProps;
      const [name, p] = pool[Math.floor(r() * pool.length)];
      this.props.push({ name, ...p, x, scale: 0.78 + r() * 0.2, flip: r() < 0.5 });
    }
    this.resetHero(FIELD.start);
  }

  resetHero(x) {
    const h = this.hero;
    Object.assign(h, { x, y: WALK_Y, vx: 0, vy: 0, ground: true, face: 1, alpha: 1, dead: false, busy: false, flash: 0, offX: 0 });
    h.animName = null;
    play(h, "idle");
    this.camX = clamp(x - this.viewW * 0.35, 0, Math.max(0, this.levelW - this.viewW));
  }

  enterArena() {
    const z = this.zone;
    this.scene = "arena";
    this.locked = true;
    this.fx = []; this.shots = []; this.texts = []; this.tweens = [];
    let e;
    if (z.boss) {
      const B = this.M.bosses[z.boss.id];
      const anims = { idle: B.idle || stillAnim(B.still) };
      e = actor(anims, -1, { id: z.boss.id, name: z.boss.name, boss: true, still: !B.idle, overlay: B.overlay_rot });
      e.plateH = B.idle ? 360 : B.still.h + 10;
    } else {
      e = actor(this.M.mobs[z.elite], -1, { id: z.elite, name: z.eliteName, elite: true, scale: 1.55 });
      e.plateH = 190 * 1.55;
    }
    e.hp = e.maxHp = 1;
    play(e, "idle");
    this.enemy = e;
    this.hero.animName = null;
    Object.assign(this.hero, { vx: 0, vy: 0, y: WALK_Y, ground: true, face: 1, busy: false });
    play(this.hero, "idle");
    this.placeArena();
  }

  /* with a bottom sheet open, lift the world so the walk line (and the
     fight on it) sits just above the sheet */
  targetOy() {
    if (!this.insetB) return this.baseOy;
    const lifted = this.H - this.insetB - 10 - (WALK_Y + 26) * this.s;
    return Math.min(this.baseOy, lifted);
  }
  setInsetBottom(px) { this.insetB = Math.max(0, px); }

  /* world units actually visible (left of any docked window) */
  get openW() { return Math.max(450, this.viewW - this.insetR / this.s); }
  setInset(px) {
    if (Math.abs(px - this.insetR) < 1) return;
    this.insetR = px;
    if (this.scene === "arena") this.placeArena();
  }

  placeArena() {
    const A = this.zone?.boss && this.M.arenas[this.zone.boss.id];
    const mid = A ? A.w / 2 : 682;
    const w = this.openW;
    const half = Math.min(w / 2, 420);
    this.hero.x = mid - half * 0.6;
    if (this.enemy) this.enemy.x = mid + half * (this.enemy.boss ? 0.5 : 0.55);
    this.camX = mid - w / 2;
  }

  leaveArena(cleared) {
    this.scene = "field";
    this.enemy = null;
    this.shots = []; this.fx = [];
    if (cleared) { this.gate.cleared = true; this.portal.active = this.zone.portalOpen || this.portal.active; }
    this.resetHero(this.gate.x - 200);
    this.gate.inside = true; // don't re-trigger until the hero walks off it
    this.locked = false;
  }

  /* ---------------- loop ---------------- */
  start() {
    const tick = (ts) => {
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000);
      this.last = ts;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { cancelAnimationFrame(this.raf); }

  press(k) {
    if (k === "jump") this.jumpQueued = true;
    if (k === "attack") this.freeAttack();
    if (k === "cast") this.freeCast();
  }

  update(dt) {
    this.time += dt;
    this.oy += (this.targetOy() - this.oy) * Math.min(1, dt * 9);
    const h = this.hero;
    const z = this.zone;
    if (!z) return;

    // tweens
    this.tweens = this.tweens.filter((tw) => {
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(p);
      if (p >= 1) { tw.done?.(); return false; }
      return true;
    });

    // regen
    if (!h.dead) {
      h.mp = Math.min(h.maxMp, h.mp + dt * 4);
      if (!this.locked) h.hp = Math.min(h.maxHp, h.hp + dt * 2);
    }

    // hero control (field only)
    const free = this.scene === "field" && !this.locked && !h.dead;
    let dir = 0;
    if (free && !h.busy) dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (dir) h.face = dir;
    h.vx = dir * SPEED;
    if (this.jumpQueued && free && h.ground && !h.busy) {
      h.vy = -JUMP_V; h.ground = false;
      h.animName = null; play(h, "jump_takeoff", { loop: false });
    }
    this.jumpQueued = false;

    if (this.scene === "field") {
      h.x = clamp(h.x + h.vx * dt, 90, this.levelW - 90);
      // an uncleared gate seals the way, on the ground and in the air
      if (!this.gate.cleared) h.x = Math.min(h.x, this.gate.x - GATE_WALL);
      if (!h.ground) {
        h.vy += GRAVITY * dt;
        h.y += h.vy * dt;
        if (h.y >= WALK_Y) {
          h.y = WALK_Y; h.vy = 0; h.ground = true;
          h.busy = true; h.animName = null;
          play(h, "jump_land", { loop: false, done: () => { h.busy = false; } });
        }
      }
      // mobs block on the ground; touching one starts the fight
      if (h.ground && !this.locked && !h.dead) {
        for (const m of this.mobs) {
          if (m.dead || m.dying) continue;
          const dx = m.x - h.x;
          if (Math.abs(dx) < CONTACT) {
            h.x = m.x - Math.sign(dx || 1) * CONTACT;
            h.face = Math.sign(dx || 1);
            m.face = -h.face;
            this.locked = true;
            h.busy = false; h.animName = null; play(h, "idle");
            this.on.encounter?.(m);
            break;
          }
        }
      }
      // gate + portal: trigger on entering (a cleared gate is dormant and passable)
      const g = this.gate;
      const inG = !g.cleared && h.ground && Math.abs(h.x - g.x) < 70;
      if (inG && !g.inside && !this.locked && !h.dead) { this.on.gate?.(); }
      g.inside = inG;
      const p = this.portal;
      const inP = p.active && h.ground && Math.abs(h.x - p.x) < 70;
      if (inP && !p.inside && !this.locked && !h.dead) { this.on.portal?.(); }
      p.inside = inP;

      // camera
      const target = clamp(h.x - this.openW * (this.locked ? 0.45 : 0.38), 0, Math.max(0, this.levelW - this.viewW));
      this.camX += (target - this.camX) * Math.min(1, dt * 6);
    }

    // hero animation choice
    if (!h.busy && !h.dead) {
      if (!h.ground) {
        const n = h.vy < -220 ? "jump_rise" : h.vy > 220 ? "jump_fall" : "jump_apex";
        if (h.animName !== "jump_takeoff" || h.vy > -500) play(h, n);
      } else play(h, h.vx ? "run" : "idle");
    }

    stepAnim(h, dt);
    for (const m of this.mobs) stepAnim(m, dt);
    if (this.enemy) stepAnim(this.enemy, dt);
    h.flash = Math.max(0, h.flash - dt * 4);
    for (const m of this.mobs) m.flash = Math.max(0, m.flash - dt * 4);
    if (this.enemy) this.enemy.flash = Math.max(0, this.enemy.flash - dt * 4);
    this.shake = Math.max(0, this.shake - dt * 30);

    // projectiles
    this.shots = this.shots.filter((s) => {
      stepAnim(s, dt);
      if (s.target) { s.tx = s.target.x; s.ty = s.target.y - s.target.hitH; }
      const dx = s.tx - s.x, dy = s.ty - s.y;
      const d = Math.hypot(dx, dy);
      const v = 1300 * dt;
      s.life -= dt;
      if (d <= v || s.life <= 0) {
        this.burst(s.tx, s.ty);
        s.onHit?.();
        return false;
      }
      s.x += (dx / d) * v; s.y += (dy / d) * v;
      s.face = dx >= 0 ? 1 : -1;
      return true;
    });
    // one-shot fx
    this.fx = this.fx.filter((f) => { stepAnim(f, dt); return !f.gone; });
    // pickups: pop, hover, then fly to the hero
    this.pickups = this.pickups.filter((p) => {
      stepAnim(p, dt);
      p.t += dt;
      if (p.t < 0.5) { p.vy += GRAVITY * 0.5 * dt; p.y = Math.min(WALK_Y - 40, p.y + p.vy * dt); }
      else if (p.t > 0.9) {
        const tx = h.x, ty = h.y - 120;
        p.x += (tx - p.x) * Math.min(1, dt * 7);
        p.y += (ty - p.y) * Math.min(1, dt * 7);
        if (Math.hypot(tx - p.x, ty - p.y) < 30) { this.on.loot?.(p.label); return false; }
      }
      return true;
    });
    // floating text
    this.texts = this.texts.filter((t) => { t.life -= dt; t.y -= dt * 60; return t.life > 0; });
  }

  /* ---------------- combat commands ---------------- */
  float(x, y, text, color = "#fff", size = 26) {
    this.texts.push({ x, y, text, color, size, life: 1.3, max: 1.3 });
  }
  burst(x, y) {
    const f = actor({ fx: this.M.hero.cast_impact }, 1, { x, y });
    f.anim = this.M.hero.cast_impact; f.animName = "fx"; f.loop = false; f.done = () => { f.gone = true; };
    f.center = true;
    this.fx.push(f);
  }
  tween(dur, fn, done) { this.tweens.push({ t: 0, dur, fn, done }); }

  /* hurt an enemy; dmg in display points */
  hurt(e, dmg, then) {
    e.flash = 1;
    this.shake = 6;
    this.float(e.x, e.y - (e.plateH || 170) * 0.7, `-${dmg}`, "#ffd34b", 32);
    if (e.anims.hurt && !e.dying) {
      e.animName = null;
      play(e, "hurt", { loop: false, done: () => { if (!e.dying) play(e, "idle"); then?.(); } });
    } else {
      this.tween(0.32, (p) => { e.offX = Math.sin(p * Math.PI * 6) * 9 * (1 - p); }, then);
    }
  }

  die(e, done) {
    e.dying = true;
    const finish = () => {
      this.tween(0.5, (p) => { e.alpha = 1 - p; }, () => { e.dead = true; done?.(); });
    };
    if (e.anims.death) { e.animName = null; play(e, "death", { loop: false, done: finish }); }
    else {
      // concept-art boss: flash, shudder, sink and fade, with bursts
      let n = 0;
      const iv = setInterval(() => {
        this.burst(e.x + (Math.random() - 0.5) * 220, e.y - Math.random() * (e.plateH || 300));
        if (++n >= 6) clearInterval(iv);
      }, 140);
      this.tween(1.3, (p) => { e.offX = Math.sin(p * 40) * 6 * (1 - p); e.offY = p * 60; e.alpha = 1 - p * p; e.flash = 0.6 * (1 - p); },
        () => { e.dead = true; done?.(); });
    }
  }

  drop(x, y, item, label) {
    const anim = this.M.items[item];
    if (!anim) return;
    const p = actor({ spin: anim }, 1, { x, y, vy: -700, t: 0, label });
    p.anim = anim; p.animName = "spin"; p.loop = true;
    this.pickups.push(p);
  }

  /* hero strikes (lesson answered right) */
  strike(m, done) {
    const h = this.hero;
    h.busy = true; h.animName = null;
    h.face = m.x >= h.x ? 1 : -1;
    play(h, "attack", {
      loop: false,
      at: { 4: () => { this.hurt(m, 40 + Math.floor(Math.random() * 25)); } },
      done: () => { h.busy = false; play(h, "idle"); },
    });
    setTimeout(() => {
      this.die(m, () => {
        this.drop(m.x, m.y - 100, m.review ? "hp_potion" : "code_scroll", m.review ? "Health Potion" : "Code Scroll");
        this.locked = false;
        done?.();
      });
    }, 620);
  }

  /* an enemy hits the hero (wrong answer / failed run) */
  enemyStrike(e, dmg, done) {
    const h = this.hero;
    if (!e || e.dying || h.dead) { done?.(); return; }
    const land = () => {
      h.hp = Math.max(0, h.hp - dmg);
      h.flash = 1; this.shake = 10;
      this.float(h.x - 30 * h.face, h.y - 190, `-${dmg}`, "#ff5c7a", 30);
      if (h.hp <= 0) { this.heroDie(); return; }
      h.busy = true; h.animName = null;
      play(h, "hurt", { loop: false, done: () => { h.busy = false; play(h, "idle"); } });
    };
    if (e.anims.attack) {
      const special = e.anims.special && (e.elite || e.boss) && Math.random() < 0.4;
      const name = special ? "special" : "attack";
      const hitAt = Math.floor(e.anims[name].f.length * 0.55);
      e.animName = null;
      play(e, name, { loop: false, at: { [hitAt]: land }, done: () => { if (!e.dying) play(e, "idle"); done?.(); } });
    } else {
      // lunge
      const dist = Math.min(160, Math.abs(e.x - h.x) * 0.35);
      this.tween(0.22, (p) => { e.offX = -dist * p * p; }, () => {
        land();
        this.tween(0.35, (p) => { e.offX = -dist * (1 - p); }, done);
      });
    }
  }

  heroDie() {
    const h = this.hero;
    h.dead = true; h.busy = true; h.animName = null;
    this.locked = true;
    play(h, "death", { loop: false, done: () => {
      this.tween(0.5, (p) => { h.alpha = 1 - p; }, () => {
        this.on.died?.();
        setTimeout(() => {
          h.hp = h.maxHp; h.mp = h.maxMp;
          if (this.scene === "arena") this.leaveArena(false);
          else this.resetHero(FIELD.start);
          this.locked = false;
          this.on.revived?.();
        }, 1400);
      });
    } });
  }

  flee() {
    const h = this.hero;
    const m = this.mobs.find((x) => !x.dead && !x.dying && Math.abs(x.x - h.x) <= CONTACT + 2);
    const dir = m ? Math.sign(h.x - m.x) || -1 : -1;
    h.face = dir;
    const from = h.x;
    const to = clamp(from + dir * 320, 90, this.levelW - 90);
    h.busy = true; h.animName = null; play(h, "run");
    this.tween(0.45, (p) => { h.x = from + (to - from) * p; }, () => { h.busy = false; this.locked = false; });
  }

  /* hero casts a crystal at the arena enemy. hits: how many bolts land. */
  cast({ hits = 1, fizzle = false, onHit, done } = {}) {
    const h = this.hero;
    const e = this.enemy;
    if (!e || h.dead) { done?.(); return; }
    h.busy = true; h.animName = null; h.face = 1;
    e.hitH = (e.plateH || 200) * 0.45;
    play(h, "cast", {
      loop: false,
      at: { 5: () => {
        const n = fizzle ? 1 : Math.max(1, hits);
        for (let k = 0; k < n; k++) {
          setTimeout(() => {
            const s = actor({ fly: this.M.hero.cast_projectile }, 1, { x: h.x + 116, y: h.y - 152 - k * 6, life: 2 });
            s.anim = this.M.hero.cast_projectile; s.animName = "fly"; s.loop = true;
            if (fizzle) { s.tx = h.x + 260; s.ty = h.y - 150; s.life = 0.25; s.onHit = () => this.float(h.x + 260, h.y - 210, "fizzle", "#9aa3c7", 22); }
            else { s.target = e; s.tx = e.x; s.ty = e.y - e.hitH; s.onHit = () => onHit?.(k); }
            this.shots.push(s);
          }, k * 140);
        }
      } },
      done: () => { h.busy = false; play(h, "idle"); done?.(); },
    });
  }

  /* free-roam flourishes (hotbar 1/2) */
  freeAttack() {
    const h = this.hero;
    if (this.scene !== "field" || this.locked || h.busy || h.dead || !h.ground) return;
    h.busy = true; h.animName = null;
    play(h, "attack", { loop: false, done: () => { h.busy = false; } });
    const m = this.mobs.find((x) => !x.dead && !x.dying && (x.x - h.x) * h.face > 0 && Math.abs(x.x - h.x) < 330);
    if (m) setTimeout(() => {
      if (this.locked) return;
      h.x = m.x - h.face * CONTACT; m.face = -h.face; this.locked = true;
      this.on.encounter?.(m);
    }, 380);
  }
  freeCast() {
    const h = this.hero;
    if (this.scene !== "field" || this.locked || h.busy || h.dead || !h.ground) return;
    if (h.mp < 15) { this.float(h.x, h.y - 270, "not enough MP", "#7fb6ff", 20); return; }
    h.mp -= 15;
    h.busy = true; h.animName = null;
    const face = h.face;
    play(h, "cast", {
      loop: false,
      at: { 5: () => {
        const m = this.mobs.find((x) => !x.dead && !x.dying && (x.x - h.x) * face > 0 && Math.abs(x.x - h.x) < 900);
        const s = actor({ fly: this.M.hero.cast_projectile }, 1, { x: h.x + 116 * face, y: h.y - 152, life: 0.7, face });
        s.anim = this.M.hero.cast_projectile; s.animName = "fly"; s.loop = true;
        if (m) { m.hitH = 90; s.target = m; s.life = 2; s.onHit = () => { if (!this.locked) { m.face = -face; h.face = face; h.x = clamp(h.x, m.x - CONTACT, m.x + CONTACT); this.locked = true; this.walkTo(m, () => this.on.encounter?.(m)); } }; }
        else { s.tx = h.x + 900 * face; s.ty = h.y - 152; }
        this.shots.push(s);
      } },
      done: () => { h.busy = false; },
    });
  }
  walkTo(m, done) {
    const h = this.hero;
    const to = m.x - Math.sign(m.x - h.x || 1) * CONTACT;
    const from = h.x;
    h.busy = true; h.animName = null; play(h, "run");
    const dur = Math.min(1.2, Math.abs(to - from) / SPEED);
    this.tween(dur, (p) => { h.x = from + (to - from) * p; }, () => { h.busy = false; h.animName = null; play(h, "idle"); done?.(); });
  }

  /* ---------------- drawing ---------------- */
  snapshot() {
    const h = this.hero;
    return {
      hp: h.hp, maxHp: h.maxHp, mp: h.mp, maxMp: h.maxMp, dead: h.dead,
      x: h.x, levelW: this.levelW || 1, scene: this.scene,
      mobs: this.mobs.filter((m) => !m.dead).map((m) => m.x),
      gate: this.gate?.x, gateCleared: !!this.gate?.cleared, portal: this.portal?.active ? this.portal.x : null,
      enemy: this.enemy && { hp: this.enemy.hp, maxHp: this.enemy.maxHp },
    };
  }

  drawSprite(an, i, x, y, { face = 1, artFace = 1, scale = 1, alpha = 1, flash = 0, center = false } = {}) {
    const im = this.img(an.src);
    if (!im) return;
    const ctx = this.ctx;
    const [sx, sy] = an.f[i];
    const w = an.w, h = an.h;
    const dx = -an.px * w;
    const dy = center ? -h / 2 : -(1 - an.py) * h;
    ctx.save();
    ctx.translate(x, y);
    if (face !== artFace) ctx.scale(-1, 1);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, sx, sy, w, h, dx, dy, w, h);
    if (flash > 0.02) {
      if (this.fc.width < w || this.fc.height < h) { this.fc.width = Math.max(this.fc.width, w); this.fc.height = Math.max(this.fc.height, h); }
      const f = this.fctx;
      f.globalCompositeOperation = "source-over";
      f.clearRect(0, 0, w, h);
      f.drawImage(im, sx, sy, w, h, 0, 0, w, h);
      f.globalCompositeOperation = "source-in";
      f.fillStyle = "#fff";
      f.fillRect(0, 0, w, h);
      ctx.globalAlpha = alpha * flash * 0.75;
      ctx.drawImage(this.fc, 0, 0, w, h, dx, dy, w, h);
    }
    ctx.restore();
  }

  drawActor(a) {
    if (!a.anim || a.dead) return;
    const ctx = this.ctx;
    // contact shadow
    if (a.alpha > 0.05) {
      const air = Math.max(0, WALK_Y - a.y);
      ctx.save();
      ctx.globalAlpha = 0.5 * a.alpha * Math.max(0.25, 1 - air / 300);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(a.x + a.offX, WALK_Y + 2, 58 * a.scale * (a.boss ? 2.2 : 1), 9 * a.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Indent Spider hangs from a thread (drawn in code; hidden on the last two death frames)
    if (a.anim.ta && !(a.animName === "death" && a.i >= a.anim.f.length - 2)) {
      const [tx, ty] = a.anim.ta[a.i];
      const flip = a.face !== a.artFace ? -1 : 1;
      const ax = a.x + a.offX + flip * (tx - a.anim.px) * a.anim.w * a.scale;
      const ay = a.y - (1 - a.anim.py) * a.anim.h * a.scale + ty * a.anim.h * a.scale;
      ctx.save();
      ctx.globalAlpha = 0.55 * a.alpha;
      ctx.strokeStyle = "#d9dcef";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.restore();
    }
    this.drawSprite(a.anim, a.i, a.x + a.offX, a.y + a.offY, a);
    if (a.overlay && !a.dying) {
      // Bone Colossus "def smash(self):" — attach point from the still's json, never mirrored
      const im = this.img(a.overlay.src);
      if (im) {
        ctx.save();
        ctx.globalAlpha = a.alpha;
        ctx.drawImage(im, a.x + a.offX - 53.2 - a.overlay.w / 2, a.y + a.offY - 118.6 - a.overlay.h / 2);
        ctx.restore();
      }
    }
  }

  /* a cleared gate: an inert stone-grey ring the hero walks through */
  drawDormantGate(x, label) {
    const ctx = this.ctx;
    const cy = WALK_Y - 150;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(0.62, 1);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "rgba(10,12,24,.35)";
    ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8a93ad"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (label) this.labels.push({ x, y: cy - 175, text: label, color: "#9aa3bf" });
  }

  drawPortal(x, color, glow, label) {
    const ctx = this.ctx;
    const t = this.time;
    const cy = WALK_Y - 150;
    ctx.save();
    ctx.translate(x, cy);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
    g.addColorStop(0, glow.replace("A", ".55"));
    g.addColorStop(1, glow.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(-200, -200, 400, 400);
    // swirl
    ctx.save();
    ctx.scale(0.62, 1);
    const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 140);
    core.addColorStop(0, "rgba(255,255,255,.9)");
    core.addColorStop(0.25, glow.replace("A", ".8"));
    core.addColorStop(1, "rgba(5,6,20,.92)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.shadowColor = color; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, 40 + k * 32, t * (1.4 + k * 0.5) + k, t * (1.4 + k * 0.5) + k + Math.PI * 1.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    // rune sign over the gate
    const rune = this.M.fx.rune_glow;
    if (rune) this.drawSprite(rune, Math.floor(t * 8) % rune.f.length, x, cy - 205, { center: true, scale: 0.8 });
    if (label) this.labels.push({ x, y: cy - 260, text: label, color });
  }

  draw() {
    const { ctx, s, dpr, oy } = this;
    const z = this.zone;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#06060d";
    ctx.fillRect(0, 0, this.c.width, this.c.height);
    if (!z) return;
    this.labels = [];
    const M = this.M;
    const sh = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const world = (f = 1) => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (-this.camX * f * s + sh), dpr * oy);
    const viewL = (f) => this.camX * f;
    const bottomY = (this.H - oy) / s; // world-y of the canvas bottom
    const arena = this.scene === "arena";
    const A = arena && z.boss ? M.arenas[z.boss.id] : null;

    // far background (loops) — or the boss arena room
    const bg = this.img(M.bg[z.biome.env]?.src);
    if (bg) {
      const w = M.bg[z.biome.env].w;
      world(arena ? 1 : 0.25);
      const L = viewL(arena ? 1 : 0.25);
      for (let x = Math.floor(L / w) * w; x < L + this.viewW + w; x += w) ctx.drawImage(bg, x, 0, w, VIEW_H);
    }
    if (A) {
      const im = this.img(A.src);
      world(1);
      if (im) ctx.drawImage(im, 0, 0, A.w, A.h);
    }
    // ceiling fill above the world on tall screens
    if (oy > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#06060d"; ctx.fillRect(0, 0, this.c.width, oy * dpr); }

    // mid parallax
    const L2 = M.layers[z.biome.set];
    if (!arena && L2) {
      const im = this.img(L2.mid.src);
      if (im) {
        world(0.6);
        const L = viewL(0.6);
        ctx.globalAlpha = 0.85;
        for (let x = Math.floor(L / L2.mid.w) * L2.mid.w; x < L + this.viewW; x += L2.mid.w) ctx.drawImage(im, x, 0, L2.mid.w, L2.mid.h);
        ctx.globalAlpha = 1;
      }
    }

    world(1);
    // props
    if (!arena) for (const p of this.props) {
      const im = this.img(p.src);
      if (!im || p.x + p.w < this.camX - 50 || p.x - p.w > this.camX + this.viewW + 50) continue;
      const w = p.w * p.scale, h = p.h * p.scale;
      ctx.save();
      ctx.translate(p.x, p.hang ? 0 : WALK_Y + 4);
      if (p.flip) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, p.hang ? 0 : -h, w, h);
      ctx.restore();
    }

    // floor
    const T = M.tiles[z.biome.set];
    if (T) {
      const top = this.img(T.top.src), fill = this.img(T.fill.src);
      const x0 = Math.floor(this.camX / T.top.w) * T.top.w;
      for (let x = x0; x < this.camX + this.viewW + T.top.w; x += T.top.w) {
        if (fill) for (let y = FILL_Y; y < bottomY + T.fill.h; y += T.fill.h) ctx.drawImage(fill, x, y, T.fill.w, T.fill.h);
        if (top) ctx.drawImage(top, x, FLOOR_TOP, T.top.w, T.top.h);
      }
      if (z.biome.wash) {
        ctx.fillStyle = z.biome.wash;
        ctx.fillRect(this.camX - 10, WALK_Y - 2, this.viewW + 20, bottomY - WALK_Y + 10);
      }
    }

    // gates
    if (!arena) {
      const g = this.gate;
      if (g.cleared) this.drawDormantGate(g.x, g.boss ? "✓ GATE CLEARED" : "✓ DUNGEON CLEARED");
      else if (g.boss) this.drawPortal(g.x, "#ff4d6d", "rgba(255,60,90,A)", "◆ GATE BOSS");
      else this.drawPortal(g.x, "#38e1ff", "rgba(56,225,255,A)", "▶ DUNGEON");
      if (this.portal.active) this.drawPortal(this.portal.x, "#ffc24b", "rgba(255,194,75,A)", this.portal.label || "NEXT ZONE");
    }

    // actors
    for (const m of this.mobs) this.drawActor(m);
    if (this.enemy) this.drawActor(this.enemy);
    this.drawActor(this.hero);
    for (const p of this.pickups) this.drawSprite(p.anim, p.i, p.x, p.y, { center: true, scale: 0.9 });
    for (const sht of this.shots) this.drawSprite(sht.anim, sht.i, sht.x, sht.y, { center: true, face: sht.face ?? 1 });
    for (const f of this.fx) this.drawSprite(f.anim, f.i, f.x, f.y, { center: true, scale: 1.1 });

    // foreground hanging layer
    if (!arena && L2) {
      const im = this.img(L2.fg.src);
      if (im) {
        world(1.3);
        const L = viewL(1.3);
        ctx.globalAlpha = 0.92;
        for (let x = Math.floor(L / L2.fg.w) * L2.fg.w; x < L + this.viewW; x += L2.fg.w) ctx.drawImage(im, x, 0, L2.fg.w, L2.fg.h);
        ctx.globalAlpha = 1;
      }
    }

    // screen-space text: nameplates, gate labels, combat numbers
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (x) => (x - this.camX) * s;
    const sy = (y) => oy + y * s;
    const fs = clamp(s * 15, 11, 16);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    const plate = (a, color) => {
      if (a.dead || a.alpha < 0.3) return;
      const top = a.y + a.offY - (a === this.hero ? 262 : a.plateH || 185 * a.scale);
      const x = sx(a.x + a.offX), y = sy(top) - 6;
      ctx.font = `700 ${fs}px Rajdhani, system-ui, sans-serif`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(a.name, x, y);
      ctx.fillStyle = color; ctx.fillText(a.name, x, y);
      if (a !== this.hero) {
        const bw = 74, bh = 6;
        ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(x - bw / 2 - 1, y + 5, bw + 2, bh + 2);
        ctx.fillStyle = a.boss || a.elite ? "#ff5c7a" : "#e04848";
        ctx.fillRect(x - bw / 2, y + 6, bw * clamp(a.hp / a.maxHp, 0, 1), bh);
      }
    };
    for (const m of this.mobs) plate(m, m.review ? "#c9b8ff" : "#ff8f8f");
    if (this.enemy) plate(this.enemy, this.enemy.boss ? "#ff5c7a" : "#ffb07a");
    plate(this.hero, "#7dffb2");
    for (const l of this.labels) {
      ctx.font = `800 ${clamp(s * 15, 11, 16)}px Orbitron, Rajdhani, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(l.text, sx(l.x), sy(l.y));
      ctx.fillStyle = l.color; ctx.fillText(l.text, sx(l.x), sy(l.y));
    }
    for (const t of this.texts) {
      const a = clamp(t.life / t.max * 1.6, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.round(clamp(t.size * s, 14, t.size))}px Orbitron, Rajdhani, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.9)";
      ctx.strokeText(t.text, sx(t.x), sy(t.y));
      ctx.fillStyle = t.color; ctx.fillText(t.text, sx(t.x), sy(t.y));
      ctx.globalAlpha = 1;
    }
  }
}

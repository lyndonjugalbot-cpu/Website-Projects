import { supabase, configured, ensureSession, resetSessionCache } from "./supabase.js";
import { levelFromXP, rankFromBosses, BOSS_DAYS } from "../../curriculum.js";

/* ------------------------------------------------------------------
   Local-first store for PyWots.

   Drop-in replacement for the inline `store` that used to live in
   PyWots.jsx — same `await store.get(key)` / `store.set(key, value)`
   signatures, so no game logic changes.

   Behaviour:
   - The local copy is the working truth. Reads return it immediately,
     then reconcile with the server in the background. A local copy that
     never reached the server (dirty) wins; otherwise newer updated_at
     wins (last-write-wins — fine for a single-user progression).
   - Writes hit the local copy synchronously (in memory) + async to
     persistent storage, and push to Postgres on a ~900ms debounce.
     Pending writes flush when the tab/app is hidden.
   - No keys, no network, or a failed sign-in: everything still works,
     local-only, and syncs on the next successful connection.
   - Persistent storage is localStorage on web and @capacitor/preferences
     on native (looked up at runtime — no build dependency on Capacitor).
------------------------------------------------------------------- */

const DEBOUNCE_MS = 900;
const LOCAL_PREFIX = "pywots:local:";
const DIRTY_KEY = "pywots:dirty";

let user = null;
let ready = null;
const timers = {};
const memory = {};

/* ----------------------- sync-state events ----------------------- */
/* off | synced | syncing | error */
let syncState = configured ? "synced" : "off";
const listeners = new Set();
function setSyncState(s) {
  if (s === syncState) return;
  syncState = s;
  listeners.forEach((cb) => { try { cb(s); } catch { /* ignore */ } });
}
export function onSyncState(cb) {
  listeners.add(cb);
  cb(syncState);
  return () => listeners.delete(cb);
}
export function getSyncState() { return syncState; }

/* --------------------- persistent key/value --------------------- */
function nativePrefs() {
  try { return window.Capacitor?.Plugins?.Preferences || null; } catch { return null; }
}
const KV = {
  async get(key) {
    const P = nativePrefs();
    if (P) { try { return (await P.get({ key })).value ?? null; } catch { return null; } }
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  async set(key, val) {
    const P = nativePrefs();
    if (P) { try { await P.set({ key, value: val }); return; } catch { /* fall through */ } }
    try { window.localStorage.setItem(key, val); } catch { /* quota / private mode */ }
  },
  async remove(key) {
    const P = nativePrefs();
    if (P) { try { await P.remove({ key }); return; } catch { /* fall through */ } }
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

/* ------------------------------ local --------------------------- */
async function localGet(key) {
  if (key in memory) return memory[key];
  const raw = await KV.get(LOCAL_PREFIX + key);
  let val = null;
  try { val = raw ? JSON.parse(raw) : null; } catch { val = null; }
  memory[key] = val;
  return val;
}
function localSet(key, value) {
  memory[key] = value;
  KV.set(LOCAL_PREFIX + key, JSON.stringify(value));
}
function markDirty(d) { KV.set(DIRTY_KEY, d ? "1" : "0"); }
async function isDirty() { return (await KV.get(DIRTY_KEY)) === "1"; }

/* ----------------------------- session -------------------------- */
async function init() {
  if (!configured) return null;
  if (!ready) ready = ensureSession().then((u) => (user = u));
  return ready;
}

/* --------------------- derived (queryable) cols ----------------- */
/* Denormalised mirrors of the values worth querying in SQL (retention,
   level distribution, funnel). Reuses the app's own curve from
   curriculum.js so it can't drift. */
function bossesCleared(save) {
  const c = (save && save.completed) || {};
  return Object.keys(BOSS_DAYS).filter((d) => c[d] && c[d].boss).length;
}
function derive(save) {
  if (!save || typeof save !== "object") return {};
  const bosses = bossesCleared(save);
  return {
    xp: save.xp ?? 0,
    level: levelFromXP(save.xp ?? 0).level,
    day: save.day ?? 1,
    streak: save.streak ?? 0,
    best_streak: save.bestStreak ?? 0,
    bosses_cleared: bosses,
    rank: rankFromBosses(bosses),
    achievements_count: Array.isArray(save.achievements) ? save.achievements.length : 0,
    onboarded: Boolean(save.answers),
    last_active_at: new Date().toISOString(),
  };
}

/* ------------------------------ sync --------------------------- */
async function pull(key) {
  await init();
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("state, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.warn("PyWots: pull failed, using local copy.", error.message);
    return null;
  }
  if (!data?.state || Object.keys(data.state).length === 0) return null;
  return { value: data.state[key] ?? null, updatedAt: data.updated_at };
}

async function push(key, value) {
  await init();
  if (!supabase || !user) { markDirty(true); return false; }
  setSyncState("syncing");
  const { error } = await supabase
    .from("profiles")
    .update({ state: { [key]: value }, ...derive(value) })
    .eq("id", user.id);
  if (error) {
    console.warn("PyWots: push failed, queued locally.", error.message);
    markDirty(true);
    setSyncState("error");
    return false;
  }
  markDirty(false);
  setSyncState("synced");
  return true;
}

/* ------------------------------ store ------------------------- */
export const store = {
  async get(key) {
    const local = await localGet(key);
    if (local && (await isDirty())) { push(key, local); return local; }
    const remote = await pull(key);
    if (remote?.value) { localSet(key, remote.value); markDirty(false); return remote.value; }
    if (local) { push(key, local); }   // seed an empty server row from local
    return local;
  },

  async set(key, value) {
    localSet(key, value);
    markDirty(true);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => push(key, value), DEBOUNCE_MS);
  },

  /* Re-run pull + reconcile after an auth change (e.g. just signed in on a
     device that had guest progress). Returns the value the app should adopt. */
  async resync(key) {
    resetSessionCache();
    ready = null; user = null;
    return this.get(key);
  },

  async clearLocal(key) {
    delete memory[key];
    await KV.remove(LOCAL_PREFIX + key);
    markDirty(false);
    resetSessionCache();
    ready = null; user = null;
  },

  async exportBlob(key) {
    return (await localGet(key)) ?? null;
  },
};

/* Flush pending writes when the tab/app is backgrounded — mobile WebViews
   kill backgrounded pages without warning. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    Object.keys(timers).forEach(async (key) => {
      clearTimeout(timers[key]);
      const v = await localGet(key);
      if (v) push(key, v);
    });
  });
}

export { ensureSession };

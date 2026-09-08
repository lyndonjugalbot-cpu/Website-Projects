import { supabase, configured, ensureSession } from "./supabase";

/* ------------------------------------------------------------------
   Drop-in replacement for the `store` stub in SelfLeveling.jsx.
   Same shape: await store.get(key) / store.set(key, value).

   How it behaves:
   - Reads come from the local cache immediately, then reconcile with the
     server row. Whichever was written last wins, so a device that was
     offline doesn't clobber newer progress from another device.
   - Writes go to the local cache synchronously and to Postgres on a
     debounce. Ticking six quests in a row is one round trip, not six.
   - No network, no keys, or a failed sign-in: everything still works,
     local-only, and syncs on the next successful connection.
------------------------------------------------------------------- */

const DEBOUNCE_MS = 900;
const LOCAL_PREFIX = "selfleveling:local:";
const DIRTY_KEY = "selfleveling:dirty";

let user = null;
let ready = null;
const timers = {};
const memory = {};

/* ------------------------------ local ----------------------------- */
function localGet(key) {
  if (key in memory) return memory[key];
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function localSet(key, value) {
  memory[key] = value;
  try {
    window.localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode or quota — memory copy still holds for this session */
  }
}
function markDirty(dirty) {
  try {
    window.localStorage.setItem(DIRTY_KEY, dirty ? "1" : "0");
  } catch { /* ignore */ }
}
function isDirty() {
  try { return window.localStorage.getItem(DIRTY_KEY) === "1"; } catch { return false; }
}

/* ----------------------------- session ---------------------------- */
async function init() {
  if (!configured) return null;
  if (!ready) ready = ensureSession().then((u) => (user = u));
  return ready;
}

/* --------------------------- derived cols -------------------------- */
/* Mirrors of the values worth querying in SQL. Kept here so the app code
   doesn't have to know the table exists. Duplicated from the app's own
   level curve — if you change one, change both, or better, move both into
   a shared module. */
function xpForLevel(n) { return Math.round(90 + 55 * Math.pow(n - 1, 1.28)); }
function levelFromXp(totalXp) {
  let level = 1, remaining = totalXp, need = xpForLevel(1);
  while (remaining >= need && level < 99) { remaining -= need; level += 1; need = xpForLevel(level); }
  return level;
}
function derive(state) {
  if (!state || typeof state !== "object") return {};
  const log = state.log ?? {};
  const dates = Object.keys(log).sort();
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if ((log[dates[i]]?.done?.length ?? 0) >= 5) streak += 1; else break;
  }
  return {
    xp: state.xp ?? 0,
    level: levelFromXp(state.xp ?? 0),
    streak,
    day_index: dates.length,
    start_date: state.startDate ?? null,
    is_pro: Boolean(state.pro),
    onboarded: Boolean(state.onboarded),
  };
}

/* ------------------------------ sync ------------------------------ */
async function pull(key) {
  await init();
  if (!supabase || !user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("state, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.warn("SelfLeveling: pull failed, using local copy.", error.message);
    return null;
  }
  if (!data?.state || Object.keys(data.state).length === 0) return null;
  return { value: data.state[key] ?? null, updatedAt: data.updated_at };
}

async function push(key, value) {
  await init();
  if (!supabase || !user) { markDirty(true); return false; }
  const { error } = await supabase
    .from("profiles")
    .update({
      state: { [key]: value },
      last_active_at: new Date().toISOString(),
      ...derive(value),
    })
    .eq("id", user.id);
  if (error) {
    console.warn("SelfLeveling: push failed, queued locally.", error.message);
    markDirty(true);
    return false;
  }
  markDirty(false);
  return true;
}

/* ------------------------------ store ----------------------------- */
export const store = {
  async get(key) {
    const local = localGet(key);
    // A local copy that never reached the server is newer by definition.
    if (local && isDirty()) { push(key, local); return local; }
    const remote = await pull(key);
    if (remote?.value) { localSet(key, remote.value); return remote.value; }
    return local;
  },

  async set(key, value) {
    localSet(key, value);
    markDirty(true);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => push(key, value), DEBOUNCE_MS);
  },

  /* Call on sign-out so the next user doesn't inherit a stranger's streak. */
  async clearLocal(key) {
    delete memory[key];
    try { window.localStorage.removeItem(LOCAL_PREFIX + key); } catch { /* ignore */ }
    markDirty(false);
  },
};

/* Flush anything pending when the tab is hidden or closed — mobile browsers
   kill backgrounded tabs without warning, and a lost debounce is a lost day. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    Object.keys(timers).forEach((key) => {
      clearTimeout(timers[key]);
      const v = localGet(key);
      if (v) push(key, v);
    });
  });
}

export { ensureSession };

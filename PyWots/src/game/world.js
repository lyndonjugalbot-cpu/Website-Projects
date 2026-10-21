/* Game Mode world data: which biome, mobs and boss each Day uses.
   Pure functions of the day number, so a zone always looks the same. */
import { DAYS, isBossDay } from "../../curriculum.js";

/* Phases (see PHASES in PyWots.jsx) -> background art. Tiles, mid/fg layers
   and props only exist for the crypt and bone sets; other biomes borrow the
   crypt set with a colour wash over the floor. */
const BIOMES = [
  { from: 1,   env: "env00", name: "Flooded Crypt",        set: "crypt", wash: null },
  { from: 11,  env: "env01", name: "Bone Catacombs",       set: "bone",  wash: null },
  { from: 21,  env: "env10", name: "Recursion Garden",     set: "crypt", wash: "rgba(40,120,70,.22)" },
  { from: 31,  env: "env02", name: "Iron Forge",           set: "crypt", wash: "rgba(140,70,30,.24)" },
  { from: 41,  env: "env05", name: "Library of Code",      set: "crypt", wash: "rgba(90,60,140,.22)" },
  { from: 51,  env: "env03", name: "Serpent Temple",       set: "crypt", wash: "rgba(30,110,100,.22)" },
  { from: 61,  env: "env04", name: "Crystal Caverns",      set: "crypt", wash: "rgba(40,110,190,.24)" },
  { from: 71,  env: "env09", name: "Clockwork Loop Tower", set: "crypt", wash: "rgba(150,110,40,.22)" },
  { from: 81,  env: "env08", name: "Frozen Stack",         set: "crypt", wash: "rgba(140,190,240,.22)" },
  { from: 91,  env: "env07", name: "Molten Core",          set: "crypt", wash: "rgba(200,60,20,.24)" },
  { from: 100, env: "env06", name: "The Null Void",        set: "crypt", wash: "rgba(20,10,40,.35)" },
];

export function biomeFor(day) {
  let b = BIOMES[0];
  for (const x of BIOMES) if (day >= x.from) b = x;
  return b;
}

/* Boss days (BOSS_DAYS in curriculum.js) -> boss art. Seven bosses for
   eleven Gates: later Gates bring back earlier bosses, awakened. */
const BOSSES = {
  7:   { id: "slime_king",     name: "Slime King" },
  10:  { id: "bone_colossus",  name: "Bone Colossus" },
  20:  { id: "iron_warden",    name: "Iron Warden" },
  30:  { id: "crystal_wyrm",   name: "Crystal Wyrm" },
  40:  { id: "compiler_lich",  name: "Compiler Lich" },
  50:  { id: "pythonis_hydra", name: "Pythonis Hydra" },
  60:  { id: "slime_king",     name: "Slime King, Awakened" },
  70:  { id: "bone_colossus",  name: "Bone Colossus, Awakened" },
  80:  { id: "crystal_wyrm",   name: "Crystal Wyrm, Awakened" },
  90:  { id: "compiler_lich",  name: "Compiler Lich, Awakened" },
  100: { id: "null_hoodie",    name: "Null Hoodie" },
};
export const bossFor = (day) => (isBossDay(day) ? BOSSES[day] || BOSSES[7] : null);

export const MOB_IDS = [
  "syntax_serpent", "bracket_imp", "indent_spider", "keyerror_ghoul", "lambda_wisp",
  "loop_wyrm", "loop_drone", "recursion_slime", "tuple_turtle", "bug_beetle",
  "yield_bat", "async_phantom", "decorator_mimic", "typeerror_golem", "dark_cultist", "cable_ghoul",
];
export const mobName = (id) => id.split("_").map((w) =>
  w === "keyerror" ? "KeyError" : w === "typeerror" ? "TypeError" : w[0].toUpperCase() + w.slice(1)).join(" ");

/* small deterministic PRNG so a day's layout is stable */
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* Review questions for days that have no authored lessons yet: earlier
   lesson cards, re-asked by wandering mobs. Practice only, never saved. */
const REVIEW_POOL = DAYS.flatMap((d) => (d.lessons || []).map((l) => ({ ...l, fromDay: d.day })));
export function reviewLessons(day, n = 2) {
  if (!REVIEW_POOL.length) return [];
  const r = rng(day * 31 + 7);
  const picked = [];
  while (picked.length < Math.min(n, REVIEW_POOL.length)) {
    const l = REVIEW_POOL[Math.floor(r() * REVIEW_POOL.length)];
    if (!picked.includes(l)) picked.push(l);
  }
  return picked;
}

export const FIELD = {
  start: 220,      // hero spawn x
  firstMob: 1050,  // first encounter
  gap: 760,        // between encounters
  mobStop: 250,    // hero halts this far from a mob
};

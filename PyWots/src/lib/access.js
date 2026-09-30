import { supabase } from "./supabase.js";
import { isNative } from "./platform.js";

/* ------------------------------------------------------------------
   Paid access (12 months per Etsy code). The server decides everything
   (supabase/schema.sql): the client reads its own `entitlements` row,
   redeems through `redeem_access_code`, and claims through the `claim`
   edge function. Nothing here can grant access by itself.

   The last known entitlement is cached per user, so a paying user who
   opens PyWots offline isn't locked out.
------------------------------------------------------------------- */

const DAY_MS = 86_400_000;
const CACHE_PREFIX = "pywots:access:";

/* Public site, used for links out of the native app (claiming is web-only). */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://pywots.vercel.app").replace(/\/+$/, "");
/* The Etsy listing, for "Buy on Etsy" links. Hidden until it's set. */
export const ETSY_LISTING_URL = import.meta.env.VITE_ETSY_LISTING_URL || null;

export const claimHref = () => (isNative ? `${SITE_URL}/claim` : "/claim");

export const isActive = (expiresAt, now = Date.now()) => expiresAt != null && expiresAt > now;
export const daysLeft = (expiresAt, now = Date.now()) => Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
export const formatDate = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function readCache(userId) {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + userId) || "null"); } catch { return null; }
}
function writeCache(userId, value) {
  try { localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(value)); } catch { /* private mode */ }
}

/* → { expiresAt: ms | null, plan: "12m" | null, offline?: true }. Throws only
   when the server can't be reached and nothing is cached. */
export async function fetchAccess(userId) {
  const { data, error } = await supabase
    .from("entitlements")
    .select("access_expires_at, plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    const cached = readCache(userId);
    if (cached) return { ...cached, offline: true };
    throw error;
  }
  const value = { expiresAt: data ? Date.parse(data.access_expires_at) : null, plan: data?.plan ?? null };
  writeCache(userId, value);
  return value;
}

/* → { ok: true, expiresAt, plan, durationDays } | { ok: false, error } */
export async function redeemCode(userId, code) {
  const { data, error } = await supabase.rpc("redeem_access_code", { p_code: code });
  if (error) return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  if (!data?.ok) return { ok: false, error: data?.error || "That code didn't work." };
  const value = { expiresAt: Date.parse(data.access_expires_at), plan: data.plan };
  writeCache(userId, value);
  return { ok: true, ...value, durationDays: data.duration_days };
}

/* Etsy order number (+ buyer email) → codes.
   → { ok: true, codes: [{ code, plan }] } | { ok: false, error, needsEmail? } */
export async function claimOrder(receiptId, email) {
  let data, error;
  try {
    ({ data, error } = await supabase.functions.invoke("claim", { body: { receiptId, email } }));
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
  if (!error && data?.codes) return { ok: true, codes: data.codes };
  // Non-2xx: the function's JSON error body is on the response.
  const body = typeof error?.context?.json === "function" ? await error.context.json().catch(() => null) : null;
  if (body?.error) return { ok: false, error: body.error, needsEmail: body.needsEmail === true };
  return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
}

import { supabase, configured, resetSessionCache } from "./supabase.js";
import { store } from "./persistence.js";
import { isNative } from "./platform.js";
import { SAVE_KEY } from "./keys.js";

/* ------------------------------------------------------------------
   Auth helpers. Every function is a no-op-ish when Supabase isn't
   configured, so the app runs local-only with zero setup.

   Model: when Supabase is configured, PyWots is paid, so everyone signs
   in (email + password, or Google / Apple if enabled) before the app
   opens. Local progress from before sign-in is carried into the account
   by persistence.js (an unsynced local save wins over an empty row).
------------------------------------------------------------------- */

export function isConfigured() { return configured; }

/* The locally stored session's user (no network call), so a signed-in
   player who opens PyWots offline isn't bounced to the sign-in screen. */
export function currentUser() {
  return supabase ? supabase.auth.getSession().then(({ data }) => data.session?.user ?? null) : Promise.resolve(null);
}

export function isAnon(user) {
  return Boolean(user && (user.is_anonymous === true || user.app_metadata?.provider === "anonymous"));
}

/* Fires on every auth transition. cb receives (event, session). */
export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

/* ------------------------------ email --------------------------- */
export async function signInEmail(email, password) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await store.resync(SAVE_KEY);
  return data.user;
}

/* Returns the new user. If the project requires email confirmation, the
   user comes back unconfirmed and without a session: the UI asks them to
   check their inbox, then sign in. */
export async function registerEmail(email, password) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) throw error;
  if (data.session) await store.resync(SAVE_KEY);
  return data.user;
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/* After following a reset link the user has a recovery session; this sets
   the new password on it. */
export async function updatePassword(password) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/* Google / Apple buttons only show for providers listed in
   VITE_OAUTH_PROVIDERS (e.g. "google,apple") once they're enabled in
   Supabase; otherwise the button would just error. */
export const oauthProviders = (import.meta.env.VITE_OAUTH_PROVIDERS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter((p) => p === "google" || p === "apple");

/* --------------------------- google / apple -------------------- */
export async function signInWithProvider(provider) {
  if (!supabase) throw new Error("Accounts are not configured.");
  if (provider !== "google" && provider !== "apple") throw new Error(`Unknown provider ${provider}`);

  if (isNative) {
    // iOS: open the provider in an in-app Safari view; the pywots:// deep
    // link is caught by native-bridge.js, which finishes the session.
    // (A native Sign-in-with-Apple sheet can be dropped in later — see
    //  CAPACITOR.md. This all-first-party flow works for App Store today.)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: "pywots://auth-callback", skipBrowserRedirect: true },
    });
    if (error) throw error;
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    return null;
  }

  // Web: redirect flow.
  const redirectTo = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
  return null; // browser navigates away; session resolves on return
}

/* Handle the OAuth return.
   - Web: `detectSessionInUrl` in the client config already parses `?code=` on
     load, so here we just clean the URL and refresh the local save.
   - Native (Capacitor): the deep-link handler passes the callback URL in; we
     pull the `code` out and exchange it for a session. */
export async function completeOAuthFromUrl(url) {
  if (!supabase) return;
  try {
    const href = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!href) return;
    const hasCode = href.includes("code=") || href.includes("access_token=");
    if (!hasCode) return;

    if (url) {
      // explicit URL => native deep link; do the exchange ourselves
      const code = new URL(href.replace(/#/, "?")).searchParams.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
    }
    // web: client already handled it via detectSessionInUrl
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    await store.resync(SAVE_KEY);
  } catch (e) {
    console.warn("PyWots: OAuth completion failed.", e?.message || e);
  }
}

/* ------------------------------ session ------------------------- */
export async function signOut() {
  if (supabase) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
  await store.clearLocal(SAVE_KEY);
  resetSessionCache();
}

/* App Store requires in-app account deletion. `delete_user()` is a
   SECURITY DEFINER function in schema.sql that removes the auth user
   (cascading to the profiles row). */
export async function deleteAccount() {
  if (!supabase) throw new Error("Accounts are not configured.");
  const { error } = await supabase.rpc("delete_user");
  if (error) throw error;
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  await store.clearLocal(SAVE_KEY);
  resetSessionCache();
}

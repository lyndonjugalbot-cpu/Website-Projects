import { supabase, configured, resetSessionCache } from "./supabase.js";
import { store } from "./persistence.js";
import { isNative } from "./platform.js";
import { SAVE_KEY } from "./keys.js";

/* ------------------------------------------------------------------
   Auth helpers. Every function is a no-op-ish when Supabase isn't
   configured, so the app runs local-only with zero setup.

   Model: anonymous session by default (see supabase.js `ensureSession`).
   "Register" either links an email onto the current anonymous user
   (progress kept, same id) or, if already a full user, is a normal sign
   up. Google / Apple go through OAuth on web and native plugins on iOS.
------------------------------------------------------------------- */

export function isConfigured() { return configured; }

export function currentUser() {
  return supabase ? supabase.auth.getUser().then(({ data }) => data.user) : Promise.resolve(null);
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

/* Register: if the current user is anonymous, link the email onto it so
   the guest's progress carries over on the same id. Otherwise create a
   fresh account. */
export async function registerEmail(email, password) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (user && isAnon(user)) {
    const { data, error } = await supabase.auth.updateUser({ email, password });
    if (error) throw error;
    return data.user; // may need email confirmation depending on project settings
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  await store.resync(SAVE_KEY);
  return data.user;
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error("Accounts are not configured.");
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

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

  // Web: redirect flow. For an anonymous user, link the identity so the
  // row (and progress) is kept; fall back to a plain OAuth sign-in.
  const redirectTo = window.location.origin;
  const { data: { user } } = await supabase.auth.getUser();
  if (user && isAnon(user)) {
    const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo } });
    if (!error) return null; // browser navigates away
    console.warn("PyWots: linkIdentity unavailable, using OAuth sign-in.", error.message);
  }
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

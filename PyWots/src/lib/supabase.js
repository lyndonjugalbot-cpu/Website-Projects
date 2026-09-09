import { createClient } from "@supabase/supabase-js";

/* Vite exposes only VITE_-prefixed vars. The anon key is meant to be public —
   Row Level Security is what protects the data, so the service_role key must
   never appear in client code.

   When these are unset (no .env.local, no Vercel env), `configured` is false and
   the whole app falls back to local-only storage — exactly how it behaved before
   accounts existed. That keeps `npm run dev` working with zero setup. */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE so the OAuth redirect works the same on web and in the
        // Capacitor deep-link callback (pywots://auth-callback).
        flowType: "pkce",
      },
    })
  : null;

/* Anonymous sign-in gives every user a real, durable account on first launch,
   before any signup form. Progress is server-side from day one; linking an email
   later (`supabase.auth.updateUser`) upgrades the same user id, so nothing is
   lost. Enable it under Authentication -> Providers -> Anonymous sign-ins. */
let sessionPromise = null;

export function ensureSession() {
  if (!supabase) return Promise.resolve(null);
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn("PyWots: anonymous sign-in failed, staying local.", error.message);
      return null;
    }
    return data.user;
  })();
  return sessionPromise;
}

/* Called after sign-out so the cached session promise doesn't hand back a
   stale user. */
export function resetSessionCache() {
  sessionPromise = null;
}

import { createClient } from "@supabase/supabase-js";

/* Vite exposes only VITE_-prefixed vars. The anon key is meant to be public —
   Row Level Security is what protects the data, so the service_role key must
   never appear in client code.

   When these are set, PyWots requires an account and a redeemed access code
   (see src/lib/access.js). When they're unset (no .env.local, no Vercel env),
   `configured` is false and the app runs open and local-only, with no sign-in
   and no access check. That keeps `npm run dev` working with zero setup. */
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

/* Resolves to the signed-in user, or null. There are no anonymous sessions:
   PyWots is paid, so everyone signs in before the app opens. */
let sessionPromise = null;

export function ensureSession() {
  if (!supabase) return Promise.resolve(null);
  if (sessionPromise) return sessionPromise;
  sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => session?.user ?? null);
  return sessionPromise;
}

/* Called after sign-out so the cached session promise doesn't hand back a
   stale user. */
export function resetSessionCache() {
  sessionPromise = null;
}

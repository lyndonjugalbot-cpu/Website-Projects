import { createClient } from "@supabase/supabase-js";

/* Vite: VITE_ prefix. Next.js: rename both to NEXT_PUBLIC_ and swap import.meta.env
   for process.env. The anon key is meant to be public — row level security is what
   protects the data, so never put the service_role key in client code. */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/* Anonymous sign-in: the user gets a real, durable account without a signup form,
   which matters when your onboarding quiz comes before any reason to trust you.
   Enable it under Authentication → Providers → Anonymous sign-ins.
   Later, linking an email upgrades the same user id, so progress carries over:

     await supabase.auth.updateUser({ email, password })
*/
export async function ensureSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("SelfLeveling: anonymous sign-in failed, staying local.", error.message);
    return null;
  }
  return data.user;
}

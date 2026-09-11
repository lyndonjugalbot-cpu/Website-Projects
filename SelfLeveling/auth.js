import { supabase, configured, ensureSession } from "./supabase";
import { store } from "./persistence";

const SAVE_KEY = "selfleveling:save";
export { configured };

function stateOf(session) {
  if (!session?.user) return { status: "signedout", email: null, id: null };
  const u = session.user;
  const anon = u.is_anonymous === true || (!u.email && !u.phone);
  return { status: anon ? "anonymous" : "email", email: u.email ?? null, id: u.id };
}

/* Subscribe to auth state. Calls back immediately with the current state,
   then on every change. Returns an unsubscribe function. */
export function watchAuth(cb) {
  if (!supabase) {
    cb({ status: "unconfigured", email: null, id: null });
    return () => {};
  }
  supabase.auth.getSession().then(({ data }) => cb(stateOf(data.session)));
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(stateOf(session)));
  return () => data.subscription.unsubscribe();
}

/* Create a permanent account. On an anonymous session this LINKS the email
   to the same user id, so the current progress carries over untouched. */
export async function register(email, password) {
  if (!supabase) throw new Error("Cloud sync isn't set up on this build.");
  const { data: { session } } = await supabase.auth.getSession();
  const anon =
    session?.user && (session.user.is_anonymous === true || !session.user.email);
  if (anon) {
    const { data, error } = await supabase.auth.updateUser({ email, password });
    if (error) throw error;
    const pending = !data?.user?.email || data.user.email !== email;
    return { linked: true, pending };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { linked: false, pending: !data.session };
}

/* Sign into an existing account. Its progress replaces what's on the device
   (the persistence layer re-pulls on the auth change). */
export async function signIn(email, password) {
  if (!supabase) throw new Error("Cloud sync isn't set up on this build.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  await store.clearLocal(SAVE_KEY);
  await ensureSession(); // hand the device a fresh anonymous slot to keep playing
}

export async function resetPassword(email) {
  if (!supabase) throw new Error("Cloud sync isn't set up on this build.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  if (error) throw error;
}

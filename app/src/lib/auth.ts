// Auth: email + password (v1). No social providers — keeps the App Store
// build free of the Sign in with Apple requirement (guideline 4.8). Signups
// are auto-confirmed (no verification email); the only email the app ever
// sends is the password reset.
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type AuthListener = (session: Session | null) => void;
const listeners = new Set<AuthListener>();
let currentSession: Session | null = null;
let initialized = false;

// True between arriving via a password-recovery link and setting the new
// password. The Account UI shows the "set new password" form while set.
let recoveryPending = false;

function notify() {
  listeners.forEach((l) => l(currentSession));
}

/** Lazily wires onAuthStateChange the first time something subscribes. */
function init() {
  if (initialized) return;
  const supabase = getSupabase();
  if (!supabase) return;
  initialized = true;
  void supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    notify();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveryPending = true;
    currentSession = session;
    notify();
  });
}

export function getSession(): Session | null {
  return currentSession;
}

export function isRecoveryPending(): boolean {
  return recoveryPending;
}

export function subscribeAuth(listener: AuthListener): () => void {
  init();
  listeners.add(listener);
  listener(currentSession);
  return () => listeners.delete(listener);
}

/** Creates the account and signs in (auto-confirmed, session is immediate).
 * Resolves to a user-facing error message or null on success. */
export async function signUp(email: string, password: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Sync isn't available in this build";
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (/already registered/i.test(error.message)) return "That email already has an account — sign in instead";
    if (/password/i.test(error.message)) return "Password needs at least 8 characters";
    return error.message;
  }
  if (!data.session) return "That email already has an account — sign in instead";
  return null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Sync isn't available in this build";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) return "Wrong email or password";
    return error.message;
  }
  return null;
}

/** Sends the password reset email. The link lands back in the app, which
 * detects PASSWORD_RECOVERY and shows the set-new-password form. */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Sync isn't available in this build";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  return error ? error.message : null;
}

export async function updatePassword(newPassword: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Sync isn't available in this build";
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (/password/i.test(error.message)) return "Password needs at least 8 characters";
    return error.message;
  }
  recoveryPending = false;
  notify();
  return null;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

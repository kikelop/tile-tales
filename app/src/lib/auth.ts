// Auth: email magic link only (v1). No social providers — keeps the App Store
// build free of the Sign in with Apple requirement (guideline 4.8).
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type AuthListener = (session: Session | null) => void;
const listeners = new Set<AuthListener>();
let currentSession: Session | null = null;
let initialized = false;

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
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    notify();
  });
}

export function getSession(): Session | null {
  return currentSession;
}

export function subscribeAuth(listener: AuthListener): () => void {
  init();
  listeners.add(listener);
  listener(currentSession);
  return () => listeners.delete(listener);
}

/** Sends the magic link. Resolves to an error message or null on success. */
export async function signInWithEmail(email: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Sync isn't available in this build";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

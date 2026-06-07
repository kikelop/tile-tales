// Supabase client singleton. Sync is optional: the app works fully offline
// without an account — these helpers no-op gracefully when env vars are absent
// (e.g. local builds without .env.local).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // magic link lands back here
      },
    });
  }
  return client;
}

export function isSyncAvailable(): boolean {
  return Boolean(url && anonKey);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null when no project is configured, which is the signal the rest of the app
 * uses to fall back to the local store and demo auth. The anon key is meant to
 * ship in the client; every table is protected by row-level security instead.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'wingz:auth',
        },
      })
    : null;

export const isSupabaseConfigured = supabase != null;

/** The project's own URL and anon key, for the few calls that predate a session. */
export const SUPABASE_URL = url ?? '';
export const SUPABASE_ANON_KEY = anonKey ?? '';

export const PHOTO_BUCKET = 'wing-photos';

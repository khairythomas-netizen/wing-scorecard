import { supabase } from '../supabase/client';
import { createLocalStore } from './localStore';
import { createSupabaseStore } from './supabaseStore';
import type { WingzStore } from './store';

/**
 * The single place that decides where data lives. With a project configured
 * the app talks to Postgres under row-level security; without one it runs on
 * the seeded local store so the demo keeps working.
 */
export const store: WingzStore = supabase
  ? createSupabaseStore(supabase)
  : createLocalStore();

export * from './store';

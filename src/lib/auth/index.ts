import { supabase } from '../supabase/client';
import { createLocalAuth } from './localAuth';
import { createSupabaseAuth } from './supabaseAuth';
import type { AuthClient } from './types';

/** Real auth when a project is configured, demo auth otherwise. */
export const authClient: AuthClient = supabase
  ? createSupabaseAuth(supabase)
  : createLocalAuth();

export * from './types';

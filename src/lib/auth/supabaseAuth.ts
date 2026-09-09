import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../types';
import { AuthError, friendlyAuthError, type AuthClient, type AuthUser } from './types';

/** Database row shape, which is snake_case unlike the app's Profile. */
interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  avatar_url: string;
  is_private: boolean;
}

export function toProfile(row: ProfileRow, counts?: Partial<Profile>): Profile {
  return {
    id: row.id,
    // Null means "not claimed yet"; the app routes to the username step.
    username: row.username ?? '',
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    isPrivate: row.is_private ?? false,
    followerCount: counts?.followerCount ?? 0,
    followingCount: counts?.followingCount ?? 0,
    reviewCount: counts?.reviewCount ?? 0,
  };
}

export function createSupabaseAuth(client: SupabaseClient): AuthClient {
  const listeners = new Set<() => void>();

  client.auth.onAuthStateChange(() => listeners.forEach((l) => l()));

  const fail = (message: string): never => {
    throw new AuthError(friendlyAuthError(message));
  };

  return {
    name: 'supabase',
    requiresSignIn: true,

    async current() {
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session?.user) return { user: null, profile: null };

      const user: AuthUser = { id: session.user.id, email: session.user.email ?? '' };

      const { data: row, error } = await client
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, is_private')
        .eq('id', user.id)
        .maybeSingle();

      // A brand-new signup can beat the profile trigger by a few milliseconds.
      // Report the user without a profile rather than treating it as an error;
      // the caller retries.
      if (error || !row) return { user, profile: null };
      return { user, profile: toProfile(row as ProfileRow) };
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) fail(error.message);
      // With email confirmation on, Supabase returns a user but no session.
      return { needsEmailConfirmation: !data.session };
    },

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) fail(error.message);
    },

    async signOut() {
      await client.auth.signOut();
    },

    async isUsernameAvailable(username) {
      const { data, error } = await client.rpc('username_available', {
        desired: username.trim().toLowerCase(),
      });
      if (error) return false;
      return Boolean(data);
    },

    async claimUsername(username) {
      const { error } = await client.rpc('claim_username', {
        desired: username.trim().toLowerCase(),
      });
      if (error) fail(error.message);
      listeners.forEach((l) => l());
    },

    async updateProfile(patch) {
      const row: Record<string, unknown> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.bio !== undefined) row.bio = patch.bio;
      if (patch.isPrivate !== undefined) row.is_private = patch.isPrivate;
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
      if (!Object.keys(row).length) return;

      const { data: session } = await client.auth.getSession();
      const id = session.session?.user.id;
      if (!id) fail('Not signed in');

      const { error } = await client.from('profiles').update(row).eq('id', id);
      if (error) fail(error.message);
      listeners.forEach((l) => l());
    },
  };
}

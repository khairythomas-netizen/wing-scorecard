import { CURRENT_USER_ID, SEED_PROFILES } from '../../data/seed';
import type { Profile } from '../types';
import type { AuthClient, AuthUser } from './types';

const KEY = 'wingz:local-profile';

/**
 * Demo authentication for when no Supabase project is configured.
 *
 * It signs the seeded user in automatically and never shows an auth wall, so
 * the app stays usable — and the deployed demo stays working — without
 * credentials. It is deliberately not a fake login screen: pretending to
 * authenticate would be worse than being obviously a demo.
 */
export function createLocalAuth(): AuthClient {
  const listeners = new Set<() => void>();
  const base = SEED_PROFILES.find((p) => p.id === CURRENT_USER_ID)!;

  const read = (): Profile => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Profile>) };
    } catch {
      /* fall through */
    }
    return { ...base };
  };

  const write = (profile: Profile) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l());
  };

  const user: AuthUser = { id: CURRENT_USER_ID, email: 'demo@wingz.app' };

  return {
    name: 'local',
    requiresSignIn: false,

    async current() {
      return { user, profile: read() };
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async signUp() {
      return { needsEmailConfirmation: false };
    },
    async signIn() {},
    async signOut() {},

    // Demo mode signs in automatically, so there is nothing to offer and
    // nowhere to send anyone.
    async enabledProviders() {
      return [];
    },
    async signInWithProvider() {},

    async isUsernameAvailable() {
      return true;
    },

    async claimUsername(username) {
      write({ ...read(), username: username.trim().toLowerCase() });
    },

    async updateProfile(patch) {
      write({ ...read(), ...patch });
    },
  };
}

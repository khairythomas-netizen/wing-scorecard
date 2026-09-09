import type { ID, Profile } from '../types';

export interface AuthUser {
  id: ID;
  email: string;
}

/**
 * The signed-in person, plus the profile row that belongs to them.
 * `profile.username` is null until they have claimed one, which is what the
 * app uses to decide whether to show the username step.
 */
export interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
}

export class AuthError extends Error {}

/**
 * Authentication behind an interface, so the app runs unchanged with or
 * without a Supabase project attached. `localAuth` signs a demo user in
 * automatically; `supabaseAuth` does the real thing.
 */
export interface AuthClient {
  readonly name: 'local' | 'supabase';
  /** Whether sign-in is real. Drives whether the app shows an auth wall. */
  readonly requiresSignIn: boolean;

  current(): Promise<{ user: AuthUser | null; profile: Profile | null }>;
  onChange(listener: () => void): () => void;

  signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  isUsernameAvailable(username: string): Promise<boolean>;
  claimUsername(username: string): Promise<void>;
  updateProfile(
    patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'isPrivate' | 'avatarUrl'>>,
  ): Promise<void>;
}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function validateUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (name.length < 3) return 'At least 3 characters.';
  if (name.length > 30) return 'At most 30 characters.';
  if (!USERNAME_PATTERN.test(name)) return 'Letters, numbers, dot and underscore only.';
  return null;
}

/** Supabase surfaces these as opaque strings; make them human. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match.';
  if (m.includes('user already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('unable to validate email')) return 'That does not look like a valid email.';
  if (m.includes('email rate limit')) return 'Too many attempts. Try again in a few minutes.';
  if (m.includes('taken')) return 'That username is taken.';
  if (m.includes('email not confirmed'))
    return 'Confirm your email first — check your inbox for the link.';
  // Network failures surface as bare fetch errors, which tell a user nothing.
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return message;
}

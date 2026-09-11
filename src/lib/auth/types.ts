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
 * Social sign-in providers WingZ offers. Deliberately a short list: each one
 * has to be configured in the Supabase dashboard before it works, and a button
 * that leads to "provider is not enabled" is worse than no button at all.
 */
export type OAuthProvider = 'google' | 'apple';

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'apple'];

export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
};

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

  /**
   * Which social providers are actually turned on for this project. Asking the
   * server rather than hard-coding a list means a provider appears the moment
   * it is enabled in the dashboard, with no redeploy, and never appears while
   * it would only fail.
   */
  enabledProviders(): Promise<OAuthProvider[]>;
  /** Sends the browser to the provider. Resolves only if the redirect fails. */
  signInWithProvider(provider: OAuthProvider): Promise<void>;

  /** Emails a link that signs the person in long enough to set a new password. */
  sendPasswordReset(email: string): Promise<void>;
  /** Sets a new password for whoever is currently signed in. */
  updatePassword(password: string): Promise<void>;
  /**
   * Fires when the app is opened from a password reset link. The person is
   * signed in at that moment but has not proved they remember anything, so the
   * app shows a "set a new password" step rather than dropping them into the
   * feed.
   */
  onPasswordRecovery(listener: () => void): () => void;

  isUsernameAvailable(username: string): Promise<boolean>;
  claimUsername(username: string): Promise<void>;
  updateProfile(
    patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'isPrivate' | 'avatarUrl'>>,
  ): Promise<void>;
}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/**
 * A first guess at a username, from whatever the person already gave us: a
 * name from Google or Apple, otherwise the local part of their email. Signing
 * in with Google and then being asked to invent a handle from nothing is a
 * needless step when "sam.rivera" is sitting right there.
 */
export function suggestUsername(displayName: string, email: string): string {
  const source = displayName.trim() || email.split('@')[0] || '';
  const candidate = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);
  return USERNAME_PATTERN.test(candidate) ? candidate : '';
}

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
  // This is a project-wide email SENDING quota, not anything the person did.
  // Supabase's built-in mailer allows only a couple of messages an hour, so
  // blaming the user for "too many attempts" is both wrong and unhelpful.
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return 'We could not send your confirmation email just now. Please try again shortly.';
  }
  if (m.includes('over_request_rate_limit') || m.includes('too many requests')) {
    return 'Too many attempts. Try again in a few minutes.';
  }
  if (m.includes('taken')) return 'That username is taken.';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'That sign-in method is not available yet.';
  }
  if (m.includes('new password should be different')) {
    return 'That is the password you already have. Pick a different one.';
  }
  if (m.includes('email not confirmed'))
    return 'Confirm your email first — check your inbox for the link.';
  // Network failures surface as bare fetch errors, which tell a user nothing.
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return message;
}

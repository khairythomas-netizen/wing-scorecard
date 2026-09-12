/**
 * Browsing without an account.
 *
 * Someone who has just found WingZ should be able to look around before being
 * asked for an email. The wall moves from the front door to the first thing
 * that writes something: posting, liking, following.
 *
 * Row-level security already allows exactly the right amount without a
 * session, which is public reviews by public accounts, so guest mode is a
 * client-side flag rather than a different set of permissions.
 */

const KEY = 'wingz:guest';

export function isGuest(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function startGuest() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: guest mode lasts for this page instead */
  }
}

/** Called on sign-in, so the account takes over from the guest session. */
export function endGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

const SEED_KEY = 'wingz:seed-follow';

/**
 * Whether the house account still needs following for this person.
 *
 * Recorded per device and never re-checked, so someone who unfollows stays
 * unfollowed. New accounts get this from a database trigger instead; this is
 * only for people who signed up before it existed.
 */
export function needsSeedFollow(userId: string): boolean {
  try {
    return localStorage.getItem(`${SEED_KEY}:${userId}`) !== '1';
  } catch {
    return false;
  }
}

export function markSeedFollowDone(userId: string) {
  try {
    localStorage.setItem(`${SEED_KEY}:${userId}`, '1');
  } catch {
    /* it will simply be attempted again next time */
  }
}

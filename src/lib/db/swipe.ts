import type { Place, Profile, Review, WingFlavour } from '../types';

/**
 * A card in the Discover swipe deck.
 *
 * Two kinds, deliberately mixed. A "nearby" card is a wing place close to the
 * user that WingZ may know nothing about yet — the discovery half. A "friend"
 * card is a real review from someone they follow — the social half. Both are
 * swipeable the same way, and swiping right saves either to Want to Try.
 */
export type SwipeCard =
  | {
      kind: 'nearby';
      id: string;
      place: Place;
      distanceKm: number | null;
      /** From a WingZ review of this place, when one exists. */
      photoUrl: string | null;
      /** Community numbers, when WingZ has reviews here. */
      communityScore: number | null;
      communityHeat: number | null;
      reviewCount: number;
      topFlavour: string | null;
      wantToTry: boolean;
    }
  | {
      kind: 'friend';
      id: string;
      place: Place;
      distanceKm: number | null;
      photoUrl: string | null;
      review: Review;
      author: Profile;
      flavour: WingFlavour;
      wantToTry: boolean;
    };

const SEEN_KEY = 'wingz:swiped';
/** How long a card stays out of the deck after being swiped. */
const SEEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type SeenMap = Record<string, number>;

function readSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    const cutoff = Date.now() - SEEN_TTL_MS;
    // Expire as we read, so the store cannot grow without bound.
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => at > cutoff));
  } catch {
    return {};
  }
}

export function markSwiped(id: string): void {
  try {
    const seen = readSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode: the deck simply repeats sooner */
  }
}

export function hasSwiped(id: string): boolean {
  return readSeen()[id] != null;
}

export function filterUnseen(cards: SwipeCard[]): SwipeCard[] {
  const seen = readSeen();
  return cards.filter((c) => seen[c.id] == null);
}

/** Clear the history, for when someone wants another pass. */
export function resetSwiped(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Interleave discovery and social content so a run of one kind never buries
 * the other, while keeping each kind's own ordering (nearby by distance,
 * friends by recency).
 */
export function interleave(nearby: SwipeCard[], friends: SwipeCard[]): SwipeCard[] {
  const out: SwipeCard[] = [];
  let i = 0;
  let j = 0;
  // Two nearby places for every friend post: proximity is the point, but a
  // friend's wings are the reason to keep swiping.
  while (i < nearby.length || j < friends.length) {
    if (i < nearby.length) out.push(nearby[i++]!);
    if (i < nearby.length) out.push(nearby[i++]!);
    if (j < friends.length) out.push(friends[j++]!);
  }
  return out;
}

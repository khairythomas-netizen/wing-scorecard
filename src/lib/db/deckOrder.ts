/**
 * Ordering the swipe deck.
 *
 * Straight distance ordering buried the good cards. A place nobody has
 * reviewed sits at 200 m with an orange placeholder, while a place with a real
 * photo of its wings sits at 1.2 km and is never reached, so the deck looked
 * like the app had no photos at all when it had plenty.
 *
 * Photos are not free to come by from anywhere else, so the ones WingZ already
 * has should not be the hardest to see.
 */

export interface Orderable {
  distanceKm: number | null;
  photoUrl: string | null;
}

/**
 * A card with a photo counts as nearer than it is, by a bounded factor.
 *
 * Bounded matters. Swipe is a proximity feature and a photo must not drag
 * somewhere across the city to the front, so this halves the apparent distance
 * rather than ignoring it: a photographed place beats a bare one only while it
 * is within roughly twice the distance.
 */
export const PHOTO_ADVANTAGE = 0.5;

export function effectiveDistance(card: Orderable): number {
  const km = card.distanceKm ?? Number.MAX_SAFE_INTEGER;
  return card.photoUrl ? km * PHOTO_ADVANTAGE : km;
}

export function byPhotoThenDistance<T extends Orderable>(cards: T[]): T[] {
  return [...cards].sort((a, b) => effectiveDistance(a) - effectiveDistance(b));
}

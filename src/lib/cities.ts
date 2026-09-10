import type { Place } from './types';

/**
 * Canonical city identity.
 *
 * Place data arrives from several sources — Photon returns a full region name
 * ("Ontario"), the seeded data used a code ("ON"), a hand-added place gets
 * whatever a geocoder's formatted address happened to contain. Grouping on the
 * raw strings produced "Toronto, Ontario" and "Toronto, ON" as two separate
 * filter options for the same city.
 *
 * The fix is to key on city and country only. Region is display detail, not
 * identity: two Torontos in the same country are the same place for this
 * purpose, and dropping region from the key removes a whole class of
 * near-duplicates without needing a lookup table of every region's spellings.
 */

export interface City {
  /** Stable identity, safe to compare and store. */
  key: string;
  /** What to show: "Toronto" or, when disambiguation helps, "Toronto, US". */
  label: string;
  city: string;
  country: string;
  /** How many reviews sit in this city. Drives ordering and pruning. */
  count: number;
}

/** Strip accents, collapse whitespace and case for comparison. */
function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-case a city for display without mangling "of", "upon" and so on. */
function titleCase(value: string): string {
  const small = new Set(['of', 'upon', 'on', 'the', 'de', 'du', 'la', 'le', 'en', 'aux']);
  return value
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      // Preserve internal punctuation: "st. john's", "saint-jean".
      return lower.replace(/(^|[-'’.])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(' ');
}

const COUNTRY_SHORT: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  'united kingdom': 'UK',
  canada: 'Canada',
};

/**
 * The city a place belongs to. Falls back through the fields a geocoder might
 * have filled, because "city" is often empty for suburbs and rural addresses.
 */
export function cityOf(place: Pick<Place, 'city' | 'region' | 'country'>): {
  city: string;
  country: string;
} | null {
  const raw = (place.city || '').trim();
  if (!raw) return null;
  return { city: titleCase(fold(raw)), country: (place.country || '').trim() };
}

export function cityKey(city: string, country: string): string {
  return `${fold(city)}|${fold(country)}`;
}

/**
 * Build the filter list from places that actually carry reviews.
 *
 * Only cities with data appear, ordered by how much data they have, so the
 * list is useful rather than an inventory of every location string ever
 * stored.
 */
export function buildCityList(
  places: Pick<Place, 'id' | 'city' | 'region' | 'country'>[],
  reviewCountByPlaceId: Map<string, number>,
): City[] {
  const byKey = new Map<string, City>();

  for (const place of places) {
    const reviews = reviewCountByPlaceId.get(place.id) ?? 0;
    if (reviews === 0) continue;
    const resolved = cityOf(place);
    if (!resolved) continue;

    const key = cityKey(resolved.city, resolved.country);
    const existing = byKey.get(key);
    if (existing) {
      existing.count += reviews;
      continue;
    }
    byKey.set(key, {
      key,
      label: resolved.city,
      city: resolved.city,
      country: resolved.country,
      count: reviews,
    });
  }

  const cities = [...byKey.values()];

  // Disambiguate only where it is genuinely needed — a London in two countries
  // becomes "London, UK" and "London, US", but a lone Toronto stays "Toronto".
  const nameCounts = new Map<string, number>();
  cities.forEach((c) => nameCounts.set(fold(c.city), (nameCounts.get(fold(c.city)) ?? 0) + 1));
  cities.forEach((c) => {
    if ((nameCounts.get(fold(c.city)) ?? 0) > 1 && c.country) {
      const short = COUNTRY_SHORT[fold(c.country)] ?? c.country;
      c.label = `${c.city}, ${short}`;
    }
  });

  return cities.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Does a place belong to the given canonical city? */
export function placeIsInCity(
  place: Pick<Place, 'city' | 'region' | 'country'>,
  key: string,
): boolean {
  const resolved = cityOf(place);
  return resolved != null && cityKey(resolved.city, resolved.country) === key;
}

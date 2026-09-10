import type { Place } from '../types';

/**
 * Restaurant identity comes from a places provider. The app only ever talks to
 * this interface, so swapping the mock for Google Places is a one-line change
 * in `index.ts` and nothing in Rate / Discover / Rankings has to move.
 */
export interface PlacesProvider {
  readonly name: 'mock' | 'osm' | 'google';

  /**
   * Type-ahead search. `near` biases results toward the user when available.
   * Implementations should debounce upstream, not here.
   */
  autocomplete(query: string, near?: { lat: number; lng: number }): Promise<PlaceSuggestion[]>;

  /**
   * Resolve a suggestion into a full Place. Google charges per field, which is
   * why this is deliberately a second call rather than fattening autocomplete.
   */
  details(externalId: string): Promise<Place | null>;

  /** Places within a bounding box, for populating the Discover map. */
  nearby(bounds: LatLngBounds): Promise<Place[]>;
}

export interface PlaceSuggestion {
  externalId: string;
  /** "Bird Bar" */
  primaryText: string;
  /** "123 Ossington Ave, Toronto, ON" */
  secondaryText: string;
  /** Present when the provider returns coordinates, for distance display. */
  lat?: number;
  lng?: number;
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Lowercase, strip punctuation and collapse whitespace, for dedupe. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

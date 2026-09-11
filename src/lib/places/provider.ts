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

  /**
   * Resolve a street address to coordinates, for a restaurant the provider
   * has never heard of. New and small places are routinely missing from any
   * dataset, and a wing app hits that constantly — so a user must be able to
   * add one rather than be told it does not exist.
   */
  geocodeAddress(address: string): Promise<GeocodedAddress | null>;

  /**
   * Address type-ahead for adding a place by hand, so the user picks a real
   * recognised address rather than typing arbitrary text. Returning full
   * candidates means the chosen one already carries coordinates and a parsed
   * city, and the pin is correct the moment the restaurant is created.
   */
  searchAddresses(query: string, near?: { lat: number; lng: number }): Promise<GeocodedAddress[]>;

  /**
   * Photos of the restaurant itself, licensed by the provider.
   *
   * Deliberately not scraped. A restaurant's own website and Instagram are
   * copyrighted and, from a static site, unreachable anyway: the browser
   * blocks reading another origin. Providers that licence photos are the only
   * honest route, so a provider without them returns an empty list and the
   * card falls back to its placeholder.
   */
  photos(externalId: string, maxWidth: number): Promise<string[]>;
}

export interface GeocodedAddress {
  formatted: string;
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
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

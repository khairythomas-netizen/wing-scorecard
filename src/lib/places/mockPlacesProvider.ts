import type { Place } from '../types';
import { SEED_PLACES } from '../../data/seed';
import { normalizeName, type LatLngBounds, type PlaceSuggestion, type PlacesProvider } from './provider';

const latency = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/**
 * Development provider backed by seeded restaurants with real coordinates.
 * Returns the same shapes a live provider does, including the artificial
 * latency, so the UI is built against realistic async behaviour.
 */
export const mockPlacesProvider: PlacesProvider = {
  name: 'mock',

  async photos() {
    return [];
  },

  async autocomplete(query) {
    const q = normalizeName(query);
    if (!q) return latency<PlaceSuggestion[]>([]);
    const hits = SEED_PLACES.filter(
      (p) => p.normalizedName.includes(q) || normalizeName(p.city).includes(q),
    )
      .slice(0, 6)
      .map((p) => ({
        externalId: p.externalId,
        primaryText: p.displayName,
        secondaryText: p.formattedAddress,
      }));
    return latency(hits);
  },

  async details(externalId) {
    return latency(SEED_PLACES.find((p) => p.externalId === externalId) ?? null);
  },

  async searchAddresses(query) {
    const q = normalizeName(query);
    if (q.length < 4) return [];
    return SEED_PLACES.filter((p) => normalizeName(p.formattedAddress).includes(q))
      .slice(0, 6)
      .map((p) => ({
        formatted: p.formattedAddress,
        lat: p.lat,
        lng: p.lng,
        city: p.city,
        region: p.region,
        country: p.country,
      }));
  },

  async geocodeAddress(address) {
    const [first] = await this.searchAddresses(address);
    return first ?? null;
  },

  async nearby(bounds: LatLngBounds) {
    const hits = SEED_PLACES.filter(
      (p) =>
        p.lat <= bounds.north &&
        p.lat >= bounds.south &&
        p.lng <= bounds.east &&
        p.lng >= bounds.west,
    );
    return latency<Place[]>(hits);
  },
};

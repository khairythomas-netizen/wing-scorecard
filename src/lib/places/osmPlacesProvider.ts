import type { Place } from '../types';
import { normalizeName, type LatLngBounds, type PlaceSuggestion, type PlacesProvider } from './provider';

/**
 * OpenStreetMap-backed place search via Photon.
 *
 * The default provider: it needs no API key or billing account, covers
 * essentially anywhere in the world, and biases results toward the user. The
 * Google adapter remains for when a key is available — this exists so the app
 * has working, worldwide restaurant search in the meantime rather than a
 * hardcoded list.
 */

const ENDPOINT = 'https://photon.komoot.io/api/';

/** Places wings plausibly come from. Photon ORs repeated osm_tag params. */
const FOOD_TAGS = [
  'amenity:restaurant',
  'amenity:fast_food',
  'amenity:bar',
  'amenity:pub',
  'amenity:cafe',
  'amenity:food_court',
  'shop:deli',
];

interface PhotonProps {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
}

interface PhotonFeature {
  properties: PhotonProps;
  geometry: { coordinates: [number, number] };
}

function addressOf(p: PhotonProps): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const locality = p.city || p.district || p.county || '';
  return [street, locality, p.state, p.postcode].filter(Boolean).join(', ');
}

function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  // Photon returns streets and regions too; without a name it is not a venue.
  if (!p.name || p.osm_id == null) return null;
  const [lng, lat] = f.geometry.coordinates;
  return {
    id: `osm:${p.osm_type ?? 'N'}${p.osm_id}`,
    externalId: `${p.osm_type ?? 'N'}${p.osm_id}`,
    provider: 'osm',
    displayName: p.name,
    normalizedName: normalizeName(p.name),
    formattedAddress: addressOf(p),
    lat,
    lng,
    city: p.city || p.district || p.county || '',
    region: p.state || '',
    country: p.country || '',
  };
}

export function createOsmPlacesProvider(): PlacesProvider {
  // Photon returns full details on every hit, so a second lookup would be a
  // wasted round trip. Remember what search returned and serve details from it.
  const seen = new Map<string, Place>();

  const query = async (params: URLSearchParams): Promise<Place[]> => {
    const res = await fetch(`${ENDPOINT}?${params}`);
    if (!res.ok) throw new Error(`Place search unavailable (${res.status})`);
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const places = (data.features ?? [])
      .map(toPlace)
      .filter((p): p is Place => p != null);
    places.forEach((p) => seen.set(p.externalId, p));
    return places;
  };

  return {
    name: 'osm',

    async autocomplete(text, near) {
      const q = text.trim();
      if (q.length < 2) return [];

      const params = new URLSearchParams({ q, limit: '20' });
      if (near) {
        // Bias, not restrict: someone reviewing a trip abroad still finds it.
        params.set('lat', String(near.lat));
        params.set('lon', String(near.lng));
      }
      FOOD_TAGS.forEach((t) => params.append('osm_tag', t));

      let places = await query(params);

      // Nothing tagged as food matched — the venue may be mis-tagged in OSM,
      // or the user typed a mall or hotel. Retry unfiltered rather than
      // insisting the place does not exist.
      if (places.length === 0) {
        const loose = new URLSearchParams({ q, limit: '20' });
        if (near) {
          loose.set('lat', String(near.lat));
          loose.set('lon', String(near.lng));
        }
        places = await query(loose);
      }

      // Photon biases but does not strictly order by distance, and for a chain
      // the nearest branch is almost always the one meant.
      if (near) {
        const d = (p: Place) =>
          (p.lat - near.lat) ** 2 + ((p.lng - near.lng) * Math.cos((near.lat * Math.PI) / 180)) ** 2;
        places = [...places].sort((a, b) => d(a) - d(b));
      }

      return places.map<PlaceSuggestion>((p) => ({
        externalId: p.externalId,
        primaryText: p.displayName,
        secondaryText: p.formattedAddress || [p.city, p.country].filter(Boolean).join(', '),
        lat: p.lat,
        lng: p.lng,
      }));
    },

    async details(externalId) {
      return seen.get(externalId) ?? null;
    },

    async nearby(bounds: LatLngBounds) {
      const params = new URLSearchParams({
        q: 'wings',
        limit: '30',
        bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      });
      FOOD_TAGS.forEach((t) => params.append('osm_tag', t));
      return query(params);
    },
  };
}

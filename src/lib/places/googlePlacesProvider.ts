import type { Place } from '../types';
import { normalizeName, type LatLngBounds, type PlaceSuggestion, type PlacesProvider } from './provider';

/**
 * Google Places (New) adapter.
 *
 * Not wired up yet — it activates the moment VITE_GOOGLE_PLACES_KEY is set.
 * Kept alongside the mock so the shape of the real integration is visible and
 * the mapping from Google's response to our Place model lives in one place.
 */
export function createGooglePlacesProvider(apiKey: string): PlacesProvider {
  const BASE = 'https://places.googleapis.com/v1';

  const post = async (path: string, body: unknown, fieldMask: string) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    return res.json();
  };

  /** Pull a component like locality/country out of Google's address parts. */
  const component = (parts: GoogleAddressComponent[] | undefined, type: string): string =>
    parts?.find((c) => c.types.includes(type))?.longText ?? '';

  const toPlace = (p: GooglePlace): Place => ({
    id: `google:${p.id}`,
    externalId: p.id,
    provider: 'google',
    displayName: p.displayName?.text ?? '',
    normalizedName: normalizeName(p.displayName?.text ?? ''),
    formattedAddress: p.formattedAddress ?? '',
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    city: component(p.addressComponents, 'locality'),
    region: component(p.addressComponents, 'administrative_area_level_1'),
    country: component(p.addressComponents, 'country'),
  });

  const DETAIL_FIELDS =
    'id,displayName,formattedAddress,location,addressComponents';

  return {
    name: 'google',

    async autocomplete(query, near) {
      if (!query.trim()) return [];
      const body: Record<string, unknown> = {
        input: query,
        includedPrimaryTypes: ['restaurant'],
      };
      if (near) {
        body.locationBias = {
          circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 25000 },
        };
      }
      const data = (await post('/places:autocomplete', body, '*')) as GoogleAutocompleteResponse;
      return (data.suggestions ?? []).flatMap<PlaceSuggestion>((s) =>
        s.placePrediction
          ? [
              {
                externalId: s.placePrediction.placeId,
                primaryText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
                secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
              },
            ]
          : [],
      );
    },

    async details(externalId) {
      const res = await fetch(`${BASE}/places/${externalId}`, {
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAIL_FIELDS },
      });
      if (!res.ok) return null;
      return toPlace((await res.json()) as GooglePlace);
    },

    async geocodeAddress(address) {
      const data = (await post(
        '/places:searchText',
        { textQuery: address },
        'places.formattedAddress,places.location',
      )) as { places?: GooglePlace[] };
      const hit = data.places?.[0];
      if (!hit?.location) return null;
      return {
        lat: hit.location.latitude,
        lng: hit.location.longitude,
        formatted: hit.formattedAddress ?? address,
      };
    },

    async nearby(bounds: LatLngBounds) {
      const data = (await post(
        '/places:searchText',
        {
          textQuery: 'chicken wings',
          locationRestriction: {
            rectangle: {
              low: { latitude: bounds.south, longitude: bounds.west },
              high: { latitude: bounds.north, longitude: bounds.east },
            },
          },
        },
        DETAIL_FIELDS.split(',').map((f) => `places.${f}`).join(','),
      )) as { places?: GooglePlace[] };
      return (data.places ?? []).map(toPlace);
    },
  };
}

interface GoogleAddressComponent {
  longText: string;
  types: string[];
}
interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: GoogleAddressComponent[];
}
interface GoogleAutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

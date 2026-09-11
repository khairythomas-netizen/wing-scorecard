import { bestAimed, type StreetImage } from './bearing';

/**
 * Street-level photos of a restaurant, from Mapillary.
 *
 * This exists because Google and Foursquare both want a card on file before
 * they will hand over a single restaurant photo. Mapillary is free, needs no
 * card, and is indexed by coordinate, which suits us: every WingZ place
 * already carries a latitude and longitude.
 *
 * What comes back is the storefront from the street rather than a plate of
 * wings, so a real WingZ review photo always takes precedence. This only
 * fills the gap for places nobody has reviewed yet.
 */

const ENDPOINT = 'https://graph.mapillary.com/images';

/** Mapillary's radius parameter is capped at 50 metres. */
const RADIUS_M = 50;

const token = import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined;

export const STREET_PHOTOS_ENABLED = Boolean(token);

interface MapillaryImage {
  thumb_1024_url?: string;
  compass_angle?: number;
  computed_compass_angle?: number;
  geometry?: { coordinates?: [number, number] };
  computed_geometry?: { coordinates?: [number, number] };
}

export async function streetPhotos(
  place: { lat: number; lng: number },
  take = 3,
): Promise<string[]> {
  if (!token) return [];

  const params = new URLSearchParams({
    access_token: token,
    lat: String(place.lat),
    lng: String(place.lng),
    radius: String(RADIUS_M),
    limit: '50',
    fields: 'thumb_1024_url,compass_angle,computed_compass_angle,geometry,computed_geometry',
  });

  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) return [];

  const body = (await res.json()) as { data?: MapillaryImage[] };

  const images: StreetImage[] = [];
  for (const raw of body.data ?? []) {
    // Mapillary's "computed" values are its own corrected estimates and are
    // better than the phone's raw readings when present.
    const coords = raw.computed_geometry?.coordinates ?? raw.geometry?.coordinates;
    const compass = raw.computed_compass_angle ?? raw.compass_angle;
    if (!raw.thumb_1024_url || !coords || compass == null) continue;
    images.push({
      url: raw.thumb_1024_url,
      // GeoJSON is [longitude, latitude], which is the reverse of everywhere
      // else in this app and an easy thing to get backwards.
      at: { lat: coords[1], lng: coords[0] },
      compass,
    });
  }

  return bestAimed(images, place, take);
}

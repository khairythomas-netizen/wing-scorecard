/**
 * Choosing which street-level photo actually shows a restaurant.
 *
 * Mapillary returns every image within a radius, taken by whoever drove or
 * cycled past, pointing wherever they happened to be pointing. Most of them
 * face down the road. Each one carries the camera's compass angle and its own
 * position, so the frames aimed at the restaurant can be picked out rather
 * than taking whatever came back first.
 */

export interface Coords {
  lat: number;
  lng: number;
}

export interface StreetImage {
  url: string;
  at: Coords;
  /** Where the camera was pointing, degrees clockwise from north. */
  compass: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Compass bearing from one point to another, degrees clockwise from north. */
export function bearing(from: Coords, to: Coords): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two compass directions, 0 to 180. */
export function angleBetween(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Rough metres between two nearby points. Good enough inside a 50m radius. */
export function metresBetween(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  return Math.hypot(dLat, dLng) * R;
}

/**
 * How far off a camera is from facing the restaurant. Lower is better.
 *
 * An image taken further away but pointed straight at the building beats one
 * taken right outside it pointing at the kerb, so distance only breaks ties
 * between frames that are aimed similarly.
 */
export function aimScore(image: StreetImage, place: Coords): number {
  const off = angleBetween(image.compass, bearing(image.at, place));
  return off + metresBetween(image.at, place) * 0.4;
}

/** The cameras most likely to have the place in frame, best first. */
export function bestAimed(images: StreetImage[], place: Coords, take: number): string[] {
  return images
    .filter((i) => i.url)
    // A camera facing more than 60 degrees away is looking at something else,
    // and a wrong photo of the wrong building is worse than no photo.
    .filter((i) => angleBetween(i.compass, bearing(i.at, place)) <= 60)
    .sort((a, b) => aimScore(a, place) - aimScore(b, place))
    .slice(0, take)
    .map((i) => i.url);
}

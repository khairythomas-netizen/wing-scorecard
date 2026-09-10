/**
 * Where the user is, used to bias restaurant search.
 *
 * Without this, searching "wingstop" from Toronto returned branches in Mexico
 * and London while the four actual Toronto locations were buried — which is
 * exactly why a restaurant someone had just eaten at was impossible to find.
 *
 * Deliberately best-effort: search must work when permission is denied or
 * unavailable, just less well. Nothing here ever blocks a query.
 */

export interface Coords {
  lat: number;
  lng: number;
}

const CACHE_KEY = 'wingz:last-location';
const MAX_AGE_MS = 10 * 60 * 1000;

let inFlight: Promise<Coords | null> | null = null;
let memory: Coords | null = null;

function readCache(): Coords | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { lat, lng, at } = JSON.parse(raw) as Coords & { at: number };
    // A stale fix still beats no fix: someone is rarely in a different city.
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    void at;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(c: Coords) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

/** Last known position, without prompting. Safe to call during render. */
export function lastKnownLocation(): Coords | null {
  return memory ?? readCache();
}

/**
 * Ask the browser for a position. Resolves null rather than rejecting, so
 * callers never need to guard — a denied prompt simply means no bias.
 */
export function requestLocation(): Promise<Coords | null> {
  if (memory) return Promise.resolve(memory);
  if (inFlight) return inFlight;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(readCache());
  }

  inFlight = new Promise<Coords | null>((resolve) => {
    let settled = false;
    const done = (value: Coords | null) => {
      if (settled) return;
      settled = true;
      inFlight = null;
      resolve(value);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        memory = c;
        writeCache(c);
        done(c);
      },
      // Denied, unavailable, or timed out: fall back to whatever we last knew.
      () => done(readCache()),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: MAX_AGE_MS },
    );
  });

  return inFlight;
}

const EARTH_KM = 6371;

/** Great-circle distance, for showing which branch is nearest. */
export function distanceKm(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  if (km < 1000) return `${Math.round(km)} km`;
  return `${Math.round(km / 1000)},000 km`;
}

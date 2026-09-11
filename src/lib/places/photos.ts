/**
 * Caching for restaurant photos fetched from a places provider.
 *
 * Two reasons this exists rather than calling the provider inline. Providers
 * bill per request, and the swipe deck walks dozens of places, so asking twice
 * for the same restaurant is money for nothing. And a place's photo set barely
 * changes, so a day-old answer is as good as a fresh one.
 */

const KEY = 'wingz:place-photos';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  urls: string[];
  at: number;
}

type Store = Record<string, Entry>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode, or full: the memory cache still works for this session */
  }
}

const memory = new Map<string, string[]>();
const inFlight = new Map<string, Promise<string[]>>();

export function cachedPhotos(placeKey: string): string[] | null {
  const hit = memory.get(placeKey);
  if (hit) return hit;

  const entry = read()[placeKey];
  if (!entry || Date.now() - entry.at > TTL_MS) return null;
  memory.set(placeKey, entry.urls);
  return entry.urls;
}

/**
 * Resolve photos once per place, even when several cards ask at the same
 * moment. An empty array is cached too: a place with no photos should not be
 * asked about again every time it comes round.
 */
export async function resolvePhotos(
  placeKey: string,
  fetcher: () => Promise<string[]>,
): Promise<string[]> {
  const cached = cachedPhotos(placeKey);
  if (cached) return cached;

  const running = inFlight.get(placeKey);
  if (running) return running;

  const promise = fetcher()
    .catch(() => [] as string[])
    .then((urls) => {
      memory.set(placeKey, urls);
      const store = read();
      store[placeKey] = { urls, at: Date.now() };
      write(store);
      inFlight.delete(placeKey);
      return urls;
    });

  inFlight.set(placeKey, promise);
  return promise;
}

/** Drops everything, for tests and for a "photos look wrong" escape hatch. */
export function clearPhotoCache() {
  memory.clear();
  inFlight.clear();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

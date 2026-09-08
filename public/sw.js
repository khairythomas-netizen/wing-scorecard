/*
 * WingZ service worker.
 *
 * Rules, in order of importance:
 *  1. Never serve a stale document. Navigations are network-first, so a new
 *     GitHub Pages deploy is picked up on the next launch.
 *  2. Never rewrite application markup here. The previous worker string-replaced
 *     the HTML to change the default tab and swap the logo, which meant the app
 *     only behaved correctly once a worker was installed. Those are now facts of
 *     the source.
 *  3. Bump CACHE_VERSION on every meaningful release. Old caches are deleted on
 *     activate, so there is no way to get wedged on an old build.
 */

const CACHE_VERSION = 'v4';
const CACHE = `wingz-${CACHE_VERSION}`;
const SCOPE = new URL(self.registration.scope).pathname;

const PRECACHE = [
  SCOPE,
  `${SCOPE}manifest.webmanifest`,
  `${SCOPE}icons/icon-192.png`,
  `${SCOPE}icons/icon-512.png`,
  `${SCOPE}icons/apple-touch-icon.png`,
  `${SCOPE}icons/favicon.png`,
  `${SCOPE}icons/wingz-mark.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

// The page asks to hand over once the user taps Refresh.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, fallbackKey) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE);
    cache.put(fallbackKey || request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(fallbackKey || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents: always try the network, fall back to the shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SCOPE));
    return;
  }

  // Vite emits content-hashed asset filenames, so those are safe to cache
  // forever. Everything else stays network-first.
  const isHashedAsset = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg)$/.test(
    url.pathname,
  );
  event.respondWith(isHashedAsset ? cacheFirst(request) : networkFirst(request));
});

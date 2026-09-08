/**
 * Service-worker registration and update handling.
 *
 * The previous build kept users on stale HTML, so the contract here is:
 * the document is always network-first, and the Refresh control genuinely
 * fetches the newest deployed build rather than replaying the cache.
 */

let waitingWorker: ServiceWorker | null = null;
const updateListeners = new Set<(ready: boolean) => void>();

export function onUpdateAvailable(listener: (ready: boolean) => void): () => void {
  updateListeners.add(listener);
  listener(waitingWorker != null);
  return () => updateListeners.delete(listener);
}

function announce() {
  updateListeners.forEach((l) => l(waitingWorker != null));
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      });

      if (reg.waiting) {
        waitingWorker = reg.waiting;
        announce();
      }

      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          // A worker that reaches "installed" while one is already controlling
          // the page means a newer build is sitting ready.
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = next;
            announce();
          }
        });
      });

      // Check on every launch, and when the app returns to the foreground.
      void reg.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    } catch {
      /* offline or unsupported — the app still runs */
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/**
 * Load the newest deployed build. If a worker is already waiting we hand over
 * to it; otherwise we ask for a fresh check and fall back to a hard reload.
 */
export async function applyUpdate(): Promise<void> {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
  } catch {
    /* fall through to a plain reload */
  }
  window.location.reload();
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { isNative } from '../platform';

/**
 * Signing in with Google from inside the native shell.
 *
 * The web flow navigates the page to Google and lets it navigate back. A
 * native app has no page to navigate, so instead the app opens a system
 * browser, and Google returns to a link only this app can answer:
 * app.wingz.mobile://auth. The app catches that link, trades the code for a
 * session and closes the browser.
 *
 * Google will not redirect to a custom scheme directly, so the round trip goes
 * through Supabase, which can.
 */
export const NATIVE_REDIRECT = 'app.wingz.mobile://auth';

export async function nativeSignInWithProvider(
  client: SupabaseClient,
  provider: 'google' | 'apple',
): Promise<void> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_REDIRECT,
      // Do not send this web view anywhere; the system browser handles it, so
      // the person's existing Google session is available and the address bar
      // shows them who they are signing in to.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Could not start sign-in');

  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
}

/**
 * Watches for the app being opened by its own link and finishes the sign-in.
 *
 * Returns a function that stops listening. Does nothing on the web, where the
 * ordinary redirect handles this.
 */
export function listenForNativeAuthReturn(client: SupabaseClient): () => void {
  if (!isNative()) return () => {};

  let stop: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    const [{ App }, { Browser }] = await Promise.all([
      import('@capacitor/app'),
      import('@capacitor/browser'),
    ]);
    if (cancelled) return;

    const handle = await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return;
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          await client.auth.exchangeCodeForSession(code);
        } else {
          // Older implicit-style returns put the tokens in the fragment.
          const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          if (access_token && refresh_token) {
            await client.auth.setSession({ access_token, refresh_token });
          }
        }
      } finally {
        // Close it either way: leaving a browser sheet over a signed-in app
        // looks broken.
        await Browser.close().catch(() => {});
      }
    });

    stop = () => void handle.remove();
  })();

  return () => {
    cancelled = true;
    stop?.();
  };
}

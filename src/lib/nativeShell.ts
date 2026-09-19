import { isIOS, isNative } from './platform';

/**
 * Everything the native shell has to do at startup, in one place.
 *
 * The splash screen is set not to hide itself, so the app controls the moment
 * it disappears. Hiding it on a timer leaves either a blank gap or a splash
 * still covering a screen that is ready; hiding it when React has rendered
 * means the first thing anyone sees is the app.
 */
export async function startNativeShell(): Promise<void> {
  if (!isNative()) return;

  const [{ StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/keyboard'),
  ]);

  try {
    // The app draws its own header behind the status bar, which is what the
    // safe-area insets in the stylesheet are for.
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* Android without the plugin, or a simulator quirk */
  }

  try {
    if (!isIOS()) await Keyboard.setResizeMode({ mode: 'native' as never });
  } catch {
    /* keyboard plugin is Android-only for this call */
  }

  await SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
}

/** Follows the app's own light/dark choice, so the clock stays readable. */
export async function syncStatusBar(theme: 'dark' | 'light'): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
  } catch {
    /* not fatal */
  }
}

type Weight = 'light' | 'medium' | 'heavy';

/**
 * A tap you can feel, for the few actions that deserve one.
 *
 * Silent on the web and silent if the device refuses, because a missing buzz
 * must never interrupt what the person was actually doing.
 */
export async function tap(weight: Weight = 'light'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const style =
      weight === 'heavy'
        ? ImpactStyle.Heavy
        : weight === 'medium'
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch {
    /* no haptic engine */
  }
}

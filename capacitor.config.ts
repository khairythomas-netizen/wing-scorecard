import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native shell.
 *
 * `webDir` points at the built bundle, and no `server.url` is set on purpose:
 * the app runs from files inside the binary rather than loading a website.
 * Apple rejects apps that are a web page in a frame, and an app that only
 * works online is a worse app besides.
 */
const config: CapacitorConfig = {
  appId: 'app.wingz.mobile',
  appName: 'WingZ',
  webDir: 'dist',

  ios: {
    // The app draws its own header under the status bar, and the safe-area
    // insets in index.css already account for the notch.
    contentInset: 'never',
    backgroundColor: '#121212',
  },

  android: {
    backgroundColor: '#121212',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#121212',
      showSpinner: false,
      // The web app decides when it is ready and hides this itself, so there
      // is no blank gap between the splash and the first screen.
      launchAutoHide: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#121212',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;

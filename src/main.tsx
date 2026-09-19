import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { isNative } from './lib/platform';
import { startNativeShell } from './lib/nativeShell';
import { registerServiceWorker } from './lib/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isNative()) {
  // The shell hides its own splash once this resolves, so the first thing
  // anyone sees is the app rather than a gap.
  void startNativeShell();
} else {
  // A service worker inside the native shell would be a second, competing
  // cache in front of files that already ship in the binary.
  registerServiceWorker();
}

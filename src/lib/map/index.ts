import { lazy } from 'react';
import type { MapProvider } from './provider';

/**
 * The Discover map.
 *
 * MapLibre GL over OpenFreeMap's vector tiles: a real map engine on a real
 * tile service, with no API key. Setting VITE_MAPBOX_TOKEN switches the same
 * component to Mapbox's styles.
 *
 * Loaded lazily because the engine is a few hundred kilobytes and only the
 * Discover tab needs it — the rest of the app should not pay for it on launch.
 */
const Surface = lazy(() =>
  import('./MapLibreSurface').then((m) => ({ default: m.MapLibreSurface })),
);

export const mapProvider: MapProvider = {
  name: import.meta.env.VITE_MAPBOX_TOKEN ? 'mapbox' : 'maplibre',
  Surface,
};

export * from './provider';

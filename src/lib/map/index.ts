import { lazy } from 'react';
import type { MapProvider } from './provider';

/**
 * The Discover map.
 *
 * Leaflet over CARTO's raster basemaps: no API key, no WebGL, and about 42 KB
 * of engine. Lazy-loaded because only the Discover and Profile tabs need it.
 */
const Surface = lazy(() =>
  import('./LeafletSurface').then((m) => ({ default: m.LeafletSurface })),
);

export const mapProvider: MapProvider = { name: 'leaflet', Surface };

export * from './provider';

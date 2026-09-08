import { MapboxSurface } from './MapboxSurface';
import { MockMapSurface } from './MockMapSurface';
import type { MapProvider } from './provider';

/**
 * The single place that decides how the Discover map renders.
 * Set VITE_MAPBOX_TOKEN to go live.
 */
const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const mapProvider: MapProvider = token
  ? { name: 'mapbox', Surface: MapboxSurface }
  : { name: 'mock', Surface: MockMapSurface };

export * from './provider';

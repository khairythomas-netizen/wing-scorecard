import { MapboxSurface } from './MapboxSurface';
import { OsmMapSurface } from './OsmMapSurface';
import type { MapProvider } from './provider';

/**
 * The single place that decides how the Discover map renders.
 * OpenStreetMap raster tiles by default; set VITE_MAPBOX_TOKEN for Mapbox.
 */
const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const mapProvider: MapProvider = token
  ? { name: 'mapbox', Surface: MapboxSurface }
  : { name: 'osm', Surface: OsmMapSurface };

export * from './provider';

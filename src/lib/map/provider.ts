import type { ComponentType } from 'react';

/** Who a pin belongs to. Drives its colour on the map. */
export type MarkerOwner = 'mine' | 'friends' | 'community' | 'wantToTry';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  owner: MarkerOwner;
  /** Rendered inside the pin. A score, or a heart for Want to Try. */
  label: string;
  selected?: boolean;
}

export interface MapViewport {
  center: { lat: number; lng: number };
  /** Standard slippy-map zoom level. */
  zoom: number;
}

export interface MapSurfaceProps {
  viewport: MapViewport;
  markers: MapMarker[];
  theme: 'dark' | 'light';
  onMarkerClick(id: string): void;
  onViewportChange(viewport: MapViewport): void;
  className?: string;
}

/**
 * The map is a swappable rendering surface. Markers are supplied as real
 * lat/lng, never as percentages, so the mock and Mapbox consume identical
 * data and Discover does not change when the provider does.
 */
export interface MapProvider {
  readonly name: 'leaflet';
  readonly Surface: ComponentType<MapSurfaceProps>;
}

/* ------------------------------------------------- Web Mercator projection */
/* Shared so the mock positions pins exactly where a real tile map would.     */

export const TILE_SIZE = 256;
const TILE = TILE_SIZE;

export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function unproject(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI * (1 - (2 * y) / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

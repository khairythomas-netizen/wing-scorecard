import type * as React from 'react';
import type { MapSurfaceProps } from './provider';

/**
 * Mapbox GL surface.
 *
 * Intentionally a thin shell: once `mapbox-gl` is installed and
 * VITE_MAPBOX_TOKEN is set, this fills in with a map instance and HTML markers
 * built from the same `markers` prop the mock consumes. No caller changes.
 *
 * Sketch of the real body:
 *   const map = new mapboxgl.Map({ container, style: theme === 'dark' ? DARK : LIGHT,
 *     center: [viewport.center.lng, viewport.center.lat], zoom: viewport.zoom });
 *   map.on('moveend', () => onViewportChange({ center: map.getCenter(), zoom: map.getZoom() }));
 *   markers.forEach(m => new mapboxgl.Marker(pinEl(m)).setLngLat([m.lng, m.lat]).addTo(map));
 */
export function MapboxSurface(_props: MapSurfaceProps): React.ReactElement {
  throw new Error(
    'MapboxSurface is not implemented yet. Install mapbox-gl and set VITE_MAPBOX_TOKEN.',
  );
}

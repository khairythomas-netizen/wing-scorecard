/**
 * Tile sources, kept free of any Leaflet import so the selection logic can be
 * tested directly. Leaflet's zoom animation depends on requestAnimationFrame
 * and cannot be driven headlessly, so this is the only way to verify it.
 *
 * Choosing a source took several attempts, and the reasoning is worth keeping:
 *   - OpenStreetMap's tile server returns a "403 Access blocked" image. Their
 *     policy forbids application use of the volunteer servers.
 *   - CARTO returns HTTP 200 and a valid PNG with "API KEY REQUIRED" printed
 *     across it, so a status check proves nothing; only the pixels do.
 *   - Esri's grey canvas is clean but stops at z16, serving "Map data not yet
 *     available" above it, which is what made deep zoom blurry.
 *   - Esri's topographic map has parks, water, street labels and building
 *     footprints all the way down, so it reads like a real consumer map and
 *     needs no zoom-dependent switching.
 *
 * Dark mode inverts lightness while rotating hue, which keeps parks green and
 * water blue instead of turning the whole map magenta.
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

const ESRI_TOPO =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

export const BASE_TILES = {
  dark: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI_TOPO,
  light: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI_TOPO,
} as const;

export const USING_MAPTILER = Boolean(MAPTILER_KEY);
export const MAX_ZOOM = 19;

export const ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : 'Tiles &copy; <a href="https://www.esri.com">Esri</a>';

/** One source at every zoom now, so this is trivial — but still the seam. */
export function tileTemplateFor(_zoom: number, theme: 'dark' | 'light'): string {
  return BASE_TILES[theme];
}

/**
 * The topographic basemap is full-colour and light. Dark mode inverts its
 * lightness and rotates the hue back, so it darkens without going magenta.
 * MapTiler ships a real dark style, so it needs no filter.
 */
export function tileFilterFor(theme: 'dark' | 'light'): string {
  if (USING_MAPTILER || theme === 'light') return '';
  return 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.95)';
}

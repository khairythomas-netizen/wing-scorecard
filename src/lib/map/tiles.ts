/**
 * Tile sources, kept free of any Leaflet import so the selection logic can be
 * tested directly. The map's own zoom cannot be driven headlessly — Leaflet's
 * zoom animation depends on requestAnimationFrame — so this is the only way to
 * verify the behaviour that matters.
 *
 * Choosing a source took several attempts, and the reasoning is worth keeping:
 *   - OpenStreetMap's tile server returns a "403 Access blocked" image. Their
 *     policy forbids application use of the volunteer servers.
 *   - CARTO returns HTTP 200 and a valid PNG with "API KEY REQUIRED" printed
 *     across it, so a status check proves nothing; only the pixels do.
 *   - Esri's grey canvas is clean and keyless and suits both themes, but has
 *     no data above z16 — it serves "Map data not yet available", and
 *     upscaling z16 instead is what made deep zoom look blurry.
 *   - Esri's street map does have street-level detail, so past z16 we switch
 *     to it and darken it in dark mode to keep the palette.
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

/** The deepest zoom at which the grey canvas still has imagery. */
export const CANVAS_MAX_ZOOM = 16;

const ESRI_CANVAS = (variant: 'Dark' | 'Light') =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${variant}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;

const ESRI_STREET =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export const BASE_TILES = {
  dark: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI_CANVAS('Dark'),
  light: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI_CANVAS('Light'),
} as const;

export const USING_MAPTILER = Boolean(MAPTILER_KEY);

export const ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : 'Tiles &copy; <a href="https://www.esri.com">Esri</a>';

/** Which tile template applies at a given zoom. */
export function tileTemplateFor(zoom: number, theme: 'dark' | 'light'): string {
  if (MAPTILER_KEY) return BASE_TILES[theme];
  return zoom > CANVAS_MAX_ZOOM ? ESRI_STREET : BASE_TILES[theme];
}

/** True when the full-colour street map needs darkening to match the UI. */
export function needsDarkening(zoom: number, theme: 'dark' | 'light'): boolean {
  return !MAPTILER_KEY && theme === 'dark' && zoom > CANVAS_MAX_ZOOM;
}

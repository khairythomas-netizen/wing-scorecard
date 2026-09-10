import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker, MapSurfaceProps } from './provider';

/**
 * The Discover map: Leaflet over CARTO's raster basemaps.
 *
 * Chosen for robustness over sophistication. The previous attempt used a WebGL
 * vector engine, which had to download ~286 KB of JavaScript plus vector
 * tiles, sprite sheets and font glyphs before it would draw anything — and on
 * a phone over LTE it simply never finished. Leaflet is ~42 KB, needs no
 * WebGL at all, and each raster tile is about 20 KB with the labels already
 * baked in. It still gives real map behaviour: pinch-zoom, momentum panning,
 * double-tap zoom and inertia.
 *
 * CARTO's dark_all / light_all styles are made for app UIs and match the
 * WingZ palette without a key or an account.
 */

/**
 * Tile source.
 *
 * Getting here took three attempts, so the reasoning is worth recording:
 *   - OpenStreetMap's own tile server now returns a "403 Access blocked" image
 *     for us. Their policy forbids application use of the volunteer servers.
 *   - CARTO returns HTTP 200 with a perfectly valid PNG that has "API KEY
 *     REQUIRED" printed across it. Checking the status code is not enough;
 *     these were verified by inspecting the pixels.
 *   - Esri's canvas basemaps serve clean tiles, keyless, with open CORS and
 *     both a dark and a light variant that suit the app's two themes.
 *
 * Setting VITE_MAPTILER_KEY switches to MapTiler, which is the right move
 * before this carries real traffic — a keyed provider gives a quota and terms
 * rather than depending on a public endpoint's goodwill.
 */
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

const ESRI = (variant: 'Dark' | 'Light') =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${variant}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;

const TILES = {
  dark: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI('Dark'),
  light: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
    : ESRI('Light'),
} as const;

const ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : 'Tiles &copy; <a href="https://www.esri.com">Esri</a>';

const OWNER_COLOUR: Record<MapMarker['owner'], string> = {
  mine: 'var(--orange)',
  friends: 'var(--blue)',
  community: 'var(--surface2)',
  wantToTry: 'var(--violet)',
};

/** WingZ's own pin, so ownership colour and score survive the engine swap. */
function pinIcon(m: MapMarker): L.DivIcon {
  const colour = OWNER_COLOUR[m.owner];
  const text = m.owner === 'community' ? 'var(--text)' : '#fff';
  return L.divIcon({
    className: '',
    html: `<span data-marker style="
        display:grid;place-items:center;width:42px;height:42px;
        border:2px solid rgba(255,255,255,.92);border-radius:50% 50% 50% 12%;
        transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.4);
        background:${colour};color:${text};font-weight:900;font-size:11px;
      "><span style="transform:rotate(45deg)">${m.label}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
  });
}

export function LeafletSurface({
  viewport,
  markers,
  theme,
  onMarkerClick,
  onViewportChange,
  className = '',
}: MapSurfaceProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const pins = useRef<L.Marker[]>([]);
  const applying = useRef(false);
  const onViewport = useRef(onViewportChange);
  onViewport.current = onViewportChange;
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      center: [viewport.center.lat, viewport.center.lng],
      zoom: viewport.zoom,
      zoomControl: true,
      attributionControl: true,
      // Momentum panning and pinch zoom are what make it feel like a map.
      inertia: true,
    });

    const layer = L.tileLayer(TILES[theme], {
      attribution: ATTRIBUTION,
      subdomains: MAPTILER_KEY ? 'abcd' : '',
      // Esri's canvas basemaps have no imagery past z16; asking for more
      // returns blanks. maxNativeZoom upscales instead of showing nothing.
      maxZoom: 19,
      maxNativeZoom: MAPTILER_KEY ? 20 : 16,
      detectRetina: Boolean(MAPTILER_KEY),
    }).addTo(instance);

    // A tile 404 at the edge of coverage is normal; a wholesale failure is not.
    let tileErrors = 0;
    layer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors > 12) setFailure('Map tiles could not be loaded.');
    });
    layer.on('load', () => {
      tileErrors = 0;
      setFailure(null);
    });

    instance.on('moveend zoomend', () => {
      if (applying.current) return;
      const c = instance.getCenter();
      onViewport.current({ center: { lat: c.lat, lng: c.lng }, zoom: instance.getZoom() });
    });

    // Leaflet measures its container on creation. If that happens before
    // layout settles it renders into a zero-sized box and never draws.
    const ro = new ResizeObserver(() => instance.invalidateSize());
    ro.observe(container.current);
    requestAnimationFrame(() => instance.invalidateSize());

    map.current = instance;
    tileLayer.current = layer;
    return () => {
      ro.disconnect();
      instance.remove();
      map.current = null;
      tileLayer.current = null;
    };
    // Created once; theme, viewport and markers are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tileLayer.current?.setUrl(TILES[theme]);
  }, [theme]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const c = instance.getCenter();
    const moved =
      Math.abs(c.lat - viewport.center.lat) > 1e-4 ||
      Math.abs(c.lng - viewport.center.lng) > 1e-4 ||
      Math.abs(instance.getZoom() - viewport.zoom) > 0.01;
    if (!moved) return;

    applying.current = true;
    instance.setView([viewport.center.lat, viewport.center.lng], viewport.zoom, {
      animate: true,
      duration: 0.4,
    });
    window.setTimeout(() => {
      applying.current = false;
    }, 500);
  }, [viewport]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    pins.current.forEach((p) => p.remove());
    pins.current = markers.map((m) =>
      L.marker([m.lat, m.lng], { icon: pinIcon(m) })
        .on('click', () => onMarkerClick(m.id))
        .addTo(instance),
    );
  }, [markers, onMarkerClick]);

  return (
    <div className={`relative ${className}`}>
      <div ref={container} className="absolute inset-0" />
      {failure && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-[var(--map)] px-8 text-center">
          <div>
            <p className="text-sm font-bold">Map unavailable</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{failure}</p>
            <button
              onClick={() => setFailure(null)}
              className="mt-4 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-extrabold"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

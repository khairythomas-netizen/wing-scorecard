import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker, MapSurfaceProps } from './provider';
import {
  ATTRIBUTION,
  BASE_TILES,
  MAX_ZOOM,
  USING_MAPTILER,
  tileFilterFor,
  tileTemplateFor,
} from './tiles';

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
 * One layer that picks its service by zoom, rather than two layers fighting
 * over visibility. Leaflet caches tiles per coordinate and zoom, so varying
 * the URL per level is safe.
 */
const ZoomAwareTiles = L.TileLayer.extend({
  getTileUrl(this: L.TileLayer & { _wingzTheme: 'dark' | 'light' }, coords: L.Coords) {
    return L.Util.template(tileTemplateFor(coords.z, this._wingzTheme), {
      ...coords,
      s: '',
      r: '',
    });
  },
});

const OWNER_COLOUR: Record<MapMarker['owner'], string> = {
  mine: 'var(--orange)',
  friends: 'var(--blue)',
  community: 'var(--surface2)',
  wantToTry: 'var(--violet)',
};

/**
 * WingZ's own pin. Drawn as a teardrop with a separate shadow ellipse so it
 * reads as sitting on the map rather than floating over it, and grows when
 * selected so the tapped pin is unmistakable.
 */
function pinIcon(m: MapMarker): L.DivIcon {
  const colour = OWNER_COLOUR[m.owner];
  const text = m.owner === 'community' ? 'var(--text)' : '#fff';
  const scale = m.selected ? 1.15 : 1;
  const size = 40 * scale;

  return L.divIcon({
    className: 'wingz-pin',
    html: `
      <span data-marker style="position:relative;display:block;width:${size}px;height:${size + 8}px;">
        <span style="
          position:absolute;left:50%;bottom:0;transform:translateX(-50%);
          width:${size * 0.42}px;height:${size * 0.16}px;border-radius:50%;
          background:rgba(0,0,0,.28);filter:blur(1.5px);
        "></span>
        <span style="
          position:absolute;top:0;left:0;display:grid;place-items:center;
          width:${size}px;height:${size}px;
          border:2.5px solid #fff;border-radius:50% 50% 50% 12%;
          transform:rotate(-45deg);
          background:${colour};color:${text};
          box-shadow:0 3px 10px rgba(0,0,0,.35);
          font-weight:900;font-size:${11 * scale}px;
        "><span style="transform:rotate(45deg);letter-spacing:-.02em">${m.label}</span></span>
      </span>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
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

    const layer = new (ZoomAwareTiles as unknown as typeof L.TileLayer)(BASE_TILES[theme], {
      attribution: ATTRIBUTION,
      subdomains: USING_MAPTILER ? 'abcd' : '',
      maxZoom: MAX_ZOOM,
      detectRetina: USING_MAPTILER,
    });
    (layer as L.TileLayer & { _wingzTheme: 'dark' | 'light' })._wingzTheme = theme;
    layer.addTo(instance);

    // The street map is a full-colour basemap. In dark mode, past the canvas
    // zoom, invert it so it still reads as part of a dark UI.
    const applyTileFilter = () => {
      const pane = instance.getPane('tilePane');
      if (!pane) return;
      const themeNow = instance.getContainer().dataset.theme === 'dark' ? 'dark' : 'light';
      pane.style.filter = tileFilterFor(themeNow);
    };

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

    instance.getContainer().dataset.theme = theme;
    applyTileFilter();

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
    const layer = tileLayer.current as (L.TileLayer & { _wingzTheme: 'dark' | 'light' }) | null;
    const instance = map.current;
    if (!layer || !instance) return;
    layer._wingzTheme = theme;
    instance.getContainer().dataset.theme = theme;
    layer.setUrl(BASE_TILES[theme], false);
    const pane = instance.getPane('tilePane');
    if (pane) pane.style.filter = tileFilterFor(theme);
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

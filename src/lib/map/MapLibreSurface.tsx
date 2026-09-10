import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, GeolocateControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMarker, MapSurfaceProps } from './provider';

/**
 * The Discover map, rendered by MapLibre GL over OpenFreeMap's vector tiles.
 *
 * This replaces a hand-rolled tile grid. Panning, pinch-zoom, double-tap zoom,
 * rotation and label placement are things a map engine should provide, not
 * something to reimplement — and the hand-rolled version felt nothing like a
 * real map because it only did stepped zoom and simple drags.
 *
 * OpenFreeMap needs no API key or account. If VITE_MAPBOX_TOKEN is set the
 * same component renders Mapbox's styles instead, since MapLibre reads them.
 */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const styleFor = (theme: 'dark' | 'light'): string => {
  if (MAPBOX_TOKEN) {
    const id = theme === 'dark' ? 'dark-v11' : 'streets-v12';
    return `https://api.mapbox.com/styles/v1/mapbox/${id}?access_token=${MAPBOX_TOKEN}`;
  }
  return `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'bright'}`;
};

/** WingZ pin, built as a DOM node so markers keep the app's own design. */
function pinElement(m: MapMarker, onClick: (id: string) => void): HTMLElement {
  const colours: Record<MapMarker['owner'], string> = {
    mine: 'var(--orange)',
    friends: 'var(--blue)',
    community: 'var(--surface2)',
    wantToTry: 'var(--violet)',
  };

  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('data-marker', '');
  el.setAttribute('aria-label', `Map pin ${m.label}`);
  el.style.cssText = `
    width:42px;height:42px;display:grid;place-items:center;cursor:pointer;
    border:2px solid rgba(255,255,255,.92);border-radius:50% 50% 50% 12%;
    transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.4);
    background:${colours[m.owner]};
    color:${m.owner === 'community' ? 'var(--text)' : '#fff'};
    font-weight:900;font-size:11px;padding:0;
  `;
  const label = document.createElement('span');
  label.textContent = m.label;
  label.style.transform = 'rotate(45deg)';
  el.appendChild(label);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return el;
}

export function MapLibreSurface({
  viewport,
  markers,
  theme,
  onMarkerClick,
  onViewportChange,
  className = '',
}: MapSurfaceProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pins = useRef<Marker[]>([]);
  // Moving the map programmatically fires 'moveend' too; without this the
  // parent's viewport state and the map fight each other.
  const applying = useRef(false);
  const onViewport = useRef(onViewportChange);
  onViewport.current = onViewportChange;

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: styleFor(theme),
      center: [viewport.center.lng, viewport.center.lat],
      zoom: viewport.zoom,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(new GeolocateControl({ trackUserLocation: false }), 'top-right');

    // A WebGL map that fails renders as a black rectangle, which looks like
    // the app is broken rather than the map being unavailable. Say so.
    instance.on('error', (e) => {
      const message = e.error?.message ?? 'Map failed to load';
      // Individual tiles fail routinely at the edges of coverage; only a
      // failure to get going at all is worth telling the user about.
      if (/style|source|webgl|context/i.test(message)) setFailure(message);
    });
    instance.on('load', () => setFailure(null));

    const giveUp = window.setTimeout(() => {
      if (!instance.isStyleLoaded()) setFailure('The map is taking too long to load.');
    }, 15000);
    instance.on('load', () => window.clearTimeout(giveUp));

    instance.on('moveend', () => {
      if (applying.current) return;
      const c = instance.getCenter();
      onViewport.current({ center: { lat: c.lat, lng: c.lng }, zoom: instance.getZoom() });
    });

    // MapLibre measures its container once at construction. If the container
    // is still zero-sized then — a lazy chunk arriving before layout settles,
    // a tab becoming visible, an orientation change — it computes an empty
    // viewport and never requests a single tile. Keep telling it the size.
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(container.current);
    // One immediate resize covers the case where layout is already done and
    // the observer's first callback would otherwise be the only trigger.
    requestAnimationFrame(() => instance.resize());

    map.current = instance;
    return () => {
      window.clearTimeout(giveUp);
      ro.disconnect();
      instance.remove();
      map.current = null;
    };
    // Created once. Theme and viewport are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setStyle(styleFor(theme));
  }, [theme]);

  // Follow the parent when it reframes (filters changing, fitting to pins),
  // but never fight a gesture the user is mid-way through.
  useEffect(() => {
    const instance = map.current;
    if (!instance || instance.isMoving()) return;
    const c = instance.getCenter();
    const moved =
      Math.abs(c.lat - viewport.center.lat) > 1e-4 ||
      Math.abs(c.lng - viewport.center.lng) > 1e-4 ||
      Math.abs(instance.getZoom() - viewport.zoom) > 0.01;
    if (!moved) return;

    applying.current = true;
    instance.easeTo({
      center: [viewport.center.lng, viewport.center.lat],
      zoom: viewport.zoom,
      duration: 400,
    });
    window.setTimeout(() => {
      applying.current = false;
    }, 450);
  }, [viewport]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    pins.current.forEach((p) => p.remove());
    pins.current = markers.map((m) =>
      new Marker({ element: pinElement(m, onMarkerClick), anchor: 'bottom' })
        .setLngLat([m.lng, m.lat])
        .addTo(instance),
    );
  }, [markers, onMarkerClick]);

  return (
    <div className={`relative ${className}`}>
      <div ref={container} className="absolute inset-0" />
      {failure && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--map)] px-8 text-center">
          <div>
            <p className="text-sm font-bold">Map unavailable</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{failure}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-extrabold"
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

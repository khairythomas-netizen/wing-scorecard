import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { project, unproject, TILE_SIZE, type MapSurfaceProps } from './provider';

const OWNER_CLASS: Record<string, string> = {
  mine: 'bg-orange text-white',
  friends: 'bg-blue text-white',
  community: 'bg-[var(--surface2)] text-[var(--text)] border-line',
  wantToTry: 'bg-violet text-white',
};

/**
 * Slippy map over OpenStreetMap raster tiles.
 *
 * Real cartography with no API key or token, which is why it is the default.
 * Tiles are plain <img> elements positioned by the same Web Mercator
 * projection the markers use, so pins land exactly on the streets they belong
 * to. Swapping in Mapbox replaces the backdrop while marker data and callbacks
 * stay identical.
 */
export function OsmMapSurface({
  viewport,
  markers,
  theme,
  onMarkerClick,
  onViewportChange,
  className = '',
}: MapSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; center: typeof viewport.center } | null>(null);

  // Measure synchronously before paint. Waiting on ResizeObserver alone leaves
  // the first render at 0x0, which projects every marker off-screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number, h: number) =>
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

    const rect = el.getBoundingClientRect();
    measure(rect.width, rect.height);

    const ro = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tileZoom = Math.round(viewport.zoom);
  const centerPx = project(viewport.center.lat, viewport.center.lng, tileZoom);

  /** Screen position of a coordinate, relative to the container. */
  const toScreen = useCallback(
    (lat: number, lng: number) => {
      const p = project(lat, lng, tileZoom);
      return { x: p.x - centerPx.x + size.w / 2, y: p.y - centerPx.y + size.h / 2 };
    },
    [centerPx.x, centerPx.y, size.w, size.h, tileZoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-marker]')) return;
    drag.current = { x: e.clientX, y: e.clientY, center: viewport.center };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const origin = project(d.center.lat, d.center.lng, tileZoom);
    onViewportChange({
      ...viewport,
      center: unproject(origin.x - (e.clientX - d.x), origin.y - (e.clientY - d.y), tileZoom),
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const zoomBy = (delta: number) =>
    onViewportChange({ ...viewport, zoom: Math.min(18, Math.max(2, viewport.zoom + delta)) });

  // Which tiles cover the viewport at this centre and zoom.
  const zoom = Math.round(viewport.zoom);
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  if (size.w > 0 && size.h > 0) {
    // Re-project at the integer zoom the tiles exist for, so a fractional
    // zoom never smears the grid.
    const c = project(viewport.center.lat, viewport.center.lng, zoom);
    const originX = c.x - size.w / 2;
    const originY = c.y - size.h / 2;
    const first = { x: Math.floor(originX / TILE_SIZE), y: Math.floor(originY / TILE_SIZE) };
    const last = {
      x: Math.floor((originX + size.w) / TILE_SIZE),
      y: Math.floor((originY + size.h) / TILE_SIZE),
    };
    const span = 2 ** zoom;
    for (let x = first.x; x <= last.x; x++) {
      for (let y = first.y; y <= last.y; y++) {
        // Wrap horizontally so panning past the date line keeps rendering;
        // vertically there is nothing beyond the poles.
        if (y < 0 || y >= span) continue;
        const wrappedX = ((x % span) + span) % span;
        tiles.push({
          key: `${zoom}/${x}/${y}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
          left: x * TILE_SIZE - originX,
          top: y * TILE_SIZE - originY,
        });
      }
    }
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden touch-none select-none ${className}`}
      style={{ background: 'var(--map)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Tile layer. Dark mode dims and inverts the lightness so the map sits
          in a charcoal UI without a bright white slab. */}
      <div
        className="absolute inset-0"
        style={
          theme === 'dark'
            ? { filter: 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.95)' }
            : undefined
        }
      >
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            draggable={false}
            // Every tile rendered here already covers the viewport, so lazy
            // loading only delays the map without saving a request.
            loading="eager"
            decoding="async"
            className="pointer-events-none absolute select-none"
            style={{ left: t.left, top: t.top, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
      </div>

      {markers.map((m) => {
        const { x, y } = toScreen(m.lat, m.lng);
        if (x < -60 || y < -60 || x > size.w + 60 || y > size.h + 60) return null;
        return (
          <button
            key={m.id}
            data-marker
            onClick={() => onMarkerClick(m.id)}
            aria-label={`Map pin ${m.label}`}
            className={`absolute grid place-items-center rounded-[50%_50%_50%_12%] border-2 border-white/90 text-[11px] font-black shadow-lg transition-transform ${
              OWNER_CLASS[m.owner]
            } ${m.selected ? 'z-20 scale-125' : 'z-10'}`}
            style={{
              left: x,
              top: y,
              width: 42,
              height: 42,
              transform: 'translate(-50%,-100%) rotate(-45deg)',
            }}
          >
            <span style={{ transform: 'rotate(45deg)' }}>{m.label}</span>
          </button>
        );
      })}

      <div className="absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl border border-line bg-[var(--glass)] backdrop-blur">
        <button onClick={() => zoomBy(1)} className="h-9 w-9 text-lg" aria-label="Zoom in">
          +
        </button>
        <button
          onClick={() => zoomBy(-1)}
          className="h-9 w-9 border-t border-line text-lg"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* OpenStreetMap's licence requires visible attribution. */}
      <div className="absolute bottom-1 right-1 z-30 rounded bg-[var(--glass)] px-1.5 py-0.5 text-[9px] text-muted">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted"
        >
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}

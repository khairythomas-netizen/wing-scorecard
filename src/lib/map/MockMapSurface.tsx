import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { project, unproject, type MapSurfaceProps } from './provider';

const OWNER_CLASS: Record<string, string> = {
  mine: 'bg-orange text-white',
  friends: 'bg-blue text-white',
  community: 'bg-[var(--surface2)] text-[var(--text)] border-line',
  wantToTry: 'bg-violet text-white',
};

/**
 * Development map surface.
 *
 * Deliberately not a decorative picture: markers are positioned by projecting
 * their real lat/lng through Web Mercator, and dragging re-centres the true
 * viewport. Swapping in Mapbox replaces the backdrop and the pan handler while
 * the marker data and callbacks stay identical.
 */
export function MockMapSurface({
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

  const centerPx = project(viewport.center.lat, viewport.center.lng, viewport.zoom);

  /** Screen position of a coordinate, relative to the container. */
  const toScreen = useCallback(
    (lat: number, lng: number) => {
      const p = project(lat, lng, viewport.zoom);
      return { x: p.x - centerPx.x + size.w / 2, y: p.y - centerPx.y + size.h / 2 };
    },
    [centerPx.x, centerPx.y, size.w, size.h, viewport.zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-marker]')) return;
    drag.current = { x: e.clientX, y: e.clientY, center: viewport.center };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const origin = project(d.center.lat, d.center.lng, viewport.zoom);
    onViewportChange({
      ...viewport,
      center: unproject(origin.x - (e.clientX - d.x), origin.y - (e.clientY - d.y), viewport.zoom),
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const zoomBy = (delta: number) =>
    onViewportChange({ ...viewport, zoom: Math.min(18, Math.max(2, viewport.zoom + delta)) });

  const grid = theme === 'dark' ? 'rgba(255,255,255,.045)' : 'rgba(20,26,33,.06)';

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
      {/* Stand-in for tiles: a graticule that scrolls with the viewport, so
          panning reads as real movement rather than a static illustration. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          backgroundPosition: `${-centerPx.x % 64}px ${-centerPx.y % 64}px`,
        }}
      />

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

      <div className="pointer-events-none absolute bottom-2 left-3 z-30 text-[9px] font-semibold uppercase tracking-wider text-muted">
        Mock map · real coordinates
      </div>
    </div>
  );
}

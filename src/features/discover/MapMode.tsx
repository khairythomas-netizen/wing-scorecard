import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { HeatMeter } from '../../components/HeatMeter';
import { ScoreBadge } from '../../components/ScoreBadge';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import { Spinner } from '../../components/States';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { mapProvider, type MapMarker, type MapViewport } from '../../lib/map';
import {
  activeMapFilterCount,
  DEFAULT_MAP_FILTERS,
  FunnelIcon,
  HEAT_BANDS,
  MapFilterPanel,
  type MapFilterState,
} from './MapFilters';
import type { Theme } from '../../hooks/useTheme';

const LEGEND: [string, string, string][] = [
  ['Mine', 'bg-orange', 'mine'],
  ['Friends', 'bg-blue', 'friends'],
  ['Community', 'bg-[var(--surface2)] border border-line', 'community'],
  ['Want to Try', 'bg-violet', 'wantToTry'],
];

export function MapMode({ theme }: { theme: Theme }) {
  const store = useStore();
  const toast = useToast();
  const { Surface } = mapProvider;

  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_MAP_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { owner, band, minScore } = filters;
  const [viewport, setViewport] = useState<MapViewport>({
    center: { lat: 43.6597, lng: -79.4056 },
    zoom: 12,
  });
  // Only reframe automatically before the user takes control of the map.
  const userMoved = useRef(false);
  const framed = useRef(false);

  const heat = HEAT_BANDS[band]!;

  // A filter change is a new question; re-answer it with a fitting view.
  useEffect(() => {
    framed.current = false;
    userMoved.current = false;
  }, [owner, band, minScore]);

  const pinQuery = useQuery([owner, heat.min, heat.max, minScore], (s) =>
    s.discoverMarkers({
      owner,
      minHeat: heat.min,
      maxHeat: heat.max,
      minScore,
      flavourId: null,
    }),
  );
  const pins = pinQuery.data ?? [];

  // A hardcoded starting city hides everything for anyone reviewing elsewhere,
  // so frame the map around whatever pins actually exist on first load.
  useEffect(() => {
    if (userMoved.current || framed.current || pins.length === 0) return;
    framed.current = true;

    const lats = pins.map((p) => p.place.lat);
    const lngs = pins.map((p) => p.place.lng);
    const north = Math.max(...lats);
    const south = Math.min(...lats);
    const east = Math.max(...lngs);
    const west = Math.min(...lngs);

    // Widest span decides the zoom; 360 degrees is one world at zoom 0.
    const span = Math.max(north - south, (east - west) / 2, 0.01);
    const zoom = Math.min(15, Math.max(2, Math.floor(Math.log2(360 / span)) - 1));

    setViewport({ center: { lat: (north + south) / 2, lng: (east + west) / 2 }, zoom });
  }, [pins]);

  const markers: MapMarker[] = useMemo(
    () =>
      pins.map((p) => ({
        id: p.place.id,
        lat: p.place.lat,
        lng: p.place.lng,
        owner: p.owner,
        label: p.label,
        selected: p.place.id === selected,
      })),
    [pins, selected],
  );

  const detailQuery = useQuery([selected], async (s) =>
    selected ? s.placeDetail(selected) : null,
  );
  const detail = detailQuery.data ?? null;

  const activeFilters = activeMapFilterCount(filters);

  return (
    <div>
      <div className="relative mx-3 overflow-hidden rounded-xl3 border border-line shadow-card">
        {/* The map engine is lazy-loaded, so hold its space while it arrives
            rather than collapsing the layout. */}
        <Suspense
          fallback={
            <div className="map-fill grid place-items-center bg-[var(--map)]">
              <Spinner label="Loading map" />
            </div>
          }
        >
          <Surface
            viewport={viewport}
            markers={markers}
            theme={theme}
            onMarkerClick={setSelected}
            onViewportChange={(v) => {
              userMoved.current = true;
              setViewport(v);
            }}
            className="map-fill"
          />
        </Suspense>

        {/* Bottom left, because top left is where Leaflet puts its zoom
            buttons and the two were sitting on top of each other. Hidden
            while a place card is open, which occupies the same corner. */}
        <div
          hidden={Boolean(detail)}
          className="pointer-events-none absolute bottom-2 left-2 z-[600] flex max-w-[calc(100%-5rem)] flex-wrap gap-x-2.5 gap-y-1 rounded-2xl border border-line bg-[var(--glass)] px-2.5 py-1.5 backdrop-blur"
        >
          {LEGEND.map(([label, cls]) => (
            <span key={label} className="flex items-center gap-1 text-[9px] font-bold text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
              {label}
            </span>
          ))}
        </div>

        {/* One control instead of two rows of chips. Tapping the map closes
            the panel, so the filters never sit between you and the pins. */}
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-label="Filters"
          className="absolute right-2 top-2 z-[700] flex items-center gap-1.5 rounded-full border border-line bg-[var(--glass)] px-3 py-2 text-[11px] font-extrabold shadow-card backdrop-blur"
        >
          <FunnelIcon />
          Filters
          {activeFilters > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[9px] font-black text-white">
              {activeFilters}
            </span>
          )}
        </button>

        {filtersOpen && (
          <>
            <button
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
              className="absolute inset-0 z-[650] cursor-default"
            />
            <MapFilterPanel
              value={filters}
              onChange={setFilters}
              onClose={() => setFiltersOpen(false)}
            />
          </>
        )}

        {detail && (
          <div className="animate-rise absolute inset-x-2 bottom-2 z-[600] rounded-xl3 border border-line bg-[var(--glass)] p-3 shadow-card backdrop-blur-xl">
            <div className="flex gap-3">
              {detail.photoUrl ? (
                <img
                  src={sized(detail.photoUrl, IMAGE_WIDTHS.thumb)}
                  alt=""
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-xl2 bg-surface2 object-cover"
                />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl2 bg-surface2 text-2xl">
                  🍗
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{detail.place.displayName}</p>
                <p className="truncate text-[11px] text-muted">
                  {detail.place.city}, {detail.place.region}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  {detail.myReview && (
                    <span className="font-bold">
                      You <span className="text-orange">{detail.myReview.finalScore.toFixed(1)}</span>
                    </span>
                  )}
                  {detail.friendAverage != null && (
                    <span className="font-bold">
                      Friends <span className="text-blue">{detail.friendAverage.toFixed(1)}</span>
                    </span>
                  )}
                  {detail.community && (
                    <span className="text-muted">
                      Community {detail.community.avgFinal.toFixed(1)} ·{' '}
                      {detail.community.reviewCount} reviews
                    </span>
                  )}
                </div>
                {detail.community && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <HeatMeter value={detail.community.avgHeat} size={11} />
                    {detail.topFlavour && (
                      <span className="truncate text-[10px] font-semibold text-muted">
                        Top: {detail.topFlavour.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {detail.myReview && <ScoreBadge score={detail.myReview.finalScore} size="sm" />}
            </div>

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={async () => {
                  const on = await store.toggleWantToTry(detail.place.id, null, null);
                  toast(on ? 'Added to Want to Try' : 'Removed from Want to Try');
                }}
                className={`flex-1 rounded-lg border py-2 text-[11px] font-extrabold ${
                  detail.wantToTry
                    ? 'border-violet bg-violet/15 text-violet'
                    : 'border-line bg-surface text-text'
                }`}
              >
                {detail.wantToTry ? '♥ On your list' : '+ Want to Try'}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-[11px] font-extrabold text-muted"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="px-4 pt-3 text-center text-[11px] text-muted">
        {markers.length} {markers.length === 1 ? 'place' : 'places'} match these filters.
      </p>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Chip, ChipRow } from '../../components/Chip';
import { HeatMeter } from '../../components/HeatMeter';
import { ScoreBadge } from '../../components/ScoreBadge';
import { useStore, useStoreSnapshot } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { mapProvider, type MapMarker, type MapViewport } from '../../lib/map';
import type { DiscoverFilters } from '../../lib/db/store';
import type { Theme } from '../../hooks/useTheme';

const OWNERS: { id: DiscoverFilters['owner']; label: string }[] = [
  { id: 'mine+friends', label: 'Mine + Friends' },
  { id: 'mine', label: 'Mine' },
  { id: 'friends', label: 'Friends' },
  { id: 'everyone', label: 'Everyone' },
  { id: 'wantToTry', label: 'Want to Try' },
];

const HEAT_BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Any heat', min: 1, max: 5 },
  { label: '🌶️ 1–2', min: 1, max: 2 },
  { label: '🌶️ 3–5', min: 3, max: 5 },
  { label: '🌶️ 4+', min: 4, max: 5 },
];

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

  const [owner, setOwner] = useState<DiscoverFilters['owner']>('mine+friends');
  const [band, setBand] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({
    center: { lat: 43.6597, lng: -79.4056 },
    zoom: 12,
  });

  const heat = HEAT_BANDS[band]!;

  const pins = useStoreSnapshot((s) =>
    s.discoverMarkers({
      owner,
      minHeat: heat.min,
      maxHeat: heat.max,
      minScore,
      flavourId: null,
    }),
  );

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

  const detail = useMemo(() => {
    if (!selected) return null;
    const place = store.getPlace(selected);
    if (!place) return null;
    const reviews = store.reviewsForPlace(selected);
    const mine = reviews.find((r) => r.authorId === store.currentUserId());
    const friendIds = new Set(store.followingIds());
    const friends = reviews.filter((r) => friendIds.has(r.authorId));
    const agg = store.aggregate(selected);

    // Which flavour this restaurant is actually known for.
    const counts = new Map<string, number>();
    reviews.forEach((r) => counts.set(r.flavourId, (counts.get(r.flavourId) ?? 0) + 1));
    const topFlavourId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      place,
      mine,
      friends,
      agg,
      topFlavour: topFlavourId ? store.getFlavour(topFlavourId) : undefined,
      photo: reviews[0]?.photos[0]?.url,
      wantToTry: store.isWantToTry(selected),
    };
  }, [selected, store, pins]);

  return (
    <div>
      <ChipRow>
        {OWNERS.map((o) => (
          <Chip key={o.id} active={owner === o.id} onClick={() => setOwner(o.id)}>
            {o.label}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow>
        {HEAT_BANDS.map((b, i) => (
          <Chip key={b.label} active={band === i} onClick={() => setBand(i)}>
            {b.label}
          </Chip>
        ))}
        {[0, 8, 9].map((s) => (
          <Chip key={s} active={minScore === s} onClick={() => setMinScore(s)}>
            {s === 0 ? 'Any score' : `${s}+`}
          </Chip>
        ))}
      </ChipRow>

      <div className="relative mx-3 overflow-hidden rounded-xl3 border border-line">
        <Surface
          viewport={viewport}
          markers={markers}
          theme={theme}
          onMarkerClick={setSelected}
          onViewportChange={setViewport}
          className="h-[58vh] min-h-[400px]"
        />

        <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-xl border border-line bg-[var(--glass)] px-3 py-2 backdrop-blur">
          {LEGEND.map(([label, cls]) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] font-semibold">
              <span className={`h-2 w-2 rounded-full ${cls}`} />
              {label}
            </div>
          ))}
        </div>

        {detail && (
          <div className="animate-rise absolute inset-x-2 bottom-2 z-40 rounded-xl2 border border-line bg-[var(--glass)] p-3 backdrop-blur-xl">
            <div className="flex gap-3">
              {detail.photo && (
                <img src={detail.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{detail.place.displayName}</p>
                <p className="truncate text-[11px] text-muted">
                  {detail.place.city}, {detail.place.region}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  {detail.mine && (
                    <span className="font-bold">
                      You <span className="text-orange">{detail.mine.finalScore.toFixed(1)}</span>
                    </span>
                  )}
                  {detail.friends.length > 0 && (
                    <span className="font-bold">
                      Friends{' '}
                      <span className="text-blue">
                        {(
                          detail.friends.reduce((a, r) => a + r.finalScore, 0) /
                          detail.friends.length
                        ).toFixed(1)}
                      </span>
                    </span>
                  )}
                  {detail.agg && (
                    <span className="text-muted">
                      Community {detail.agg.avgFinal.toFixed(1)} · {detail.agg.reviewCount} reviews
                    </span>
                  )}
                </div>
                {detail.agg && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <HeatMeter value={detail.agg.avgHeat} size={11} />
                    {detail.topFlavour && (
                      <span className="truncate text-[10px] font-semibold text-muted">
                        Top: {detail.topFlavour.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {detail.mine && <ScoreBadge score={detail.mine.finalScore} size="sm" />}
            </div>

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => {
                  const on = store.toggleWantToTry(detail.place.id, null, null);
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

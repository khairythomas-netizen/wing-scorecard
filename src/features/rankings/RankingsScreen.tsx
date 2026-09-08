import { useState } from 'react';
import { Chip, ChipRow } from '../../components/Chip';
import { HeatMeter } from '../../components/HeatMeter';
import { ReviewBreakdown } from '../../components/ReviewBreakdown';
import { Sheet } from '../../components/Sheet';
import { useStoreSnapshot } from '../../hooks/useStore';
import { formatScore } from '../../lib/scoring';
import type { RankingFilters } from '../../lib/db/store';
import type { FeedItem } from '../../lib/types';

const SCOPES: { id: RankingFilters['scope']; label: string }[] = [
  { id: 'mine', label: 'My Rankings' },
  { id: 'friends', label: 'Friends' },
  { id: 'global', label: 'Global' },
];

/** The structured scores are what make these filters possible at all. */
const SORTS: { id: NonNullable<RankingFilters['sortBy']>; label: string }[] = [
  { id: 'final', label: 'Best overall' },
  { id: 'cook', label: 'Best cook' },
  { id: 'flavour', label: 'Best flavour' },
  { id: 'value', label: 'Best value' },
  { id: 'sauce', label: 'Best sauce' },
];

const HEAT_BANDS = [
  { label: 'Any heat', min: 1, max: 5 },
  { label: 'Low spice', min: 1, max: 2 },
  { label: '🌶️ 3–5', min: 3, max: 5 },
  { label: '🌶️ 4+', min: 4, max: 5 },
];

export function RankingsScreen({ userId, title }: { userId?: string; title?: string }) {
  const [scope, setScope] = useState<RankingFilters['scope']>('mine');
  const [sortBy, setSortBy] = useState<NonNullable<RankingFilters['sortBy']>>('final');
  const [band, setBand] = useState(0);
  const [city, setCity] = useState<string | null>(null);
  const [open, setOpen] = useState<FeedItem | null>(null);

  const heat = HEAT_BANDS[band]!;

  const rows = useStoreSnapshot((s) => {
    const all = s.rankings({
      scope: userId ? 'global' : scope,
      minHeat: heat.min,
      maxHeat: heat.max,
      city,
      sortBy,
    });
    return userId ? all.filter((r) => r.review.authorId === userId) : all;
  });

  const cities = useStoreSnapshot((s) => [...new Set(s.listPlaces().map((p) => p.city))].sort());

  return (
    <div className="pb-4">
      {!userId && (
        <header className="px-4 pb-3 pt-4">
          <h1 className="text-[28px] font-black leading-none tracking-tight">Rankings</h1>
          <p className="mt-1.5 text-xs text-muted">Every wing you have eaten, in order.</p>
        </header>
      )}
      {title && <h2 className="px-4 pb-2 pt-3 text-sm font-extrabold">{title}</h2>}

      {!userId && (
        <ChipRow>
          {SCOPES.map((s) => (
            <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      )}

      <ChipRow>
        {SORTS.map((s) => (
          <Chip key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)}>
            {s.label}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow>
        {HEAT_BANDS.map((b, i) => (
          <Chip key={b.label} active={band === i} onClick={() => setBand(i)}>
            {b.label}
          </Chip>
        ))}
        <Chip active={city === null} onClick={() => setCity(null)}>
          All cities
        </Chip>
        {cities.map((c) => (
          <Chip key={c} active={city === c} onClick={() => setCity(c)}>
            {c}
          </Chip>
        ))}
      </ChipRow>

      {rows.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted">
          No wings match these filters yet.
        </p>
      ) : (
        rows.map((item, i) => (
          <button
            key={item.review.id}
            onClick={() => setOpen(item)}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left"
          >
            <span className="w-6 shrink-0 text-center text-xl font-black tabular-nums text-muted">
              {i + 1}
            </span>
            <img
              src={item.review.photos[0]?.url}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold">
                {item.place.displayName}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {item.flavour.name} · {item.place.city}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <HeatMeter value={item.review.heat} size={11} showValue={false} />
                {sortBy !== 'final' && (
                  <span className="text-[10px] font-bold text-muted">
                    {SORTS.find((s) => s.id === sortBy)!.label.replace('Best ', '')}{' '}
                    {item.review.scores[sortBy].toFixed(1)}
                  </span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-lg font-black tabular-nums">
              {formatScore(item.review.finalScore)}
            </span>
          </button>
        ))
      )}

      <Sheet open={open != null} onClose={() => setOpen(null)} title={open?.place.displayName}>
        {open && <ReviewBreakdown review={open.review} />}
      </Sheet>
    </div>
  );
}

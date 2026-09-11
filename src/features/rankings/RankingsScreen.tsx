import { useState } from 'react';
import { HeatMeter } from '../../components/HeatMeter';
import { ReviewBreakdown } from '../../components/ReviewBreakdown';
import { Sheet } from '../../components/Sheet';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { useQuery } from '../../hooks/useStore';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import { ScoreBadge } from '../../components/ScoreBadge';
import type { FeedItem } from '../../lib/types';
import {
  DEFAULT_FILTERS,
  FilterSheet,
  HEAT_BANDS,
  SORTS,
  activeCount,
  type RankingFilterState,
} from './FilterSheet';

export function RankingsScreen({ userId, title }: { userId?: string; title?: string }) {
  const [filters, setFilters] = useState<RankingFilterState>(DEFAULT_FILTERS);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<FeedItem | null>(null);

  const heat = HEAT_BANDS[filters.band]!;
  const hideScope = Boolean(userId);

  const rowQuery = useQuery(
    [userId, filters.scope, filters.band, filters.city, filters.sortBy],
    (s) =>
      s.rankings({
        scope: userId ? 'global' : filters.scope,
        authorId: userId ?? null,
        minHeat: heat.min,
        maxHeat: heat.max,
        city: filters.city,
        sortBy: filters.sortBy,
      }),
  );
  const cityQuery = useQuery([], (s) => s.listCities());

  const rows = rowQuery.data;
  const count = activeCount(filters, hideScope);
  const sortLabel = SORTS.find((s) => s.id === filters.sortBy)!.label;

  return (
    <div className="pb-4">
      {!userId && (
        <header className="px-4 pb-2 pt-4">
          <h1 className="text-[28px] font-black leading-none tracking-tight">Rankings</h1>
        </header>
      )}
      {title && <h2 className="px-4 pb-1 pt-3 text-sm font-extrabold">{title}</h2>}

      {/* One compact row: what you are looking at, and a way to change it. */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3">
        <p className="min-w-0 truncate text-[12px] text-muted">
          {sortLabel}
          {filters.city && ' · filtered'}
          {rows && ` · ${rows.length} ${rows.length === 1 ? 'wing' : 'wings'}`}
        </p>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold transition-colors ${
            count > 0 ? 'border-transparent bg-orange text-white' : 'border-line bg-surface text-text'
          }`}
        >
          Filters
          {count > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-white/25 px-1 text-[10px]">
              {count}
            </span>
          )}
          <span className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        value={filters}
        onChange={setFilters}
        cities={cityQuery.data ?? []}
        hideScope={hideScope}
      />

      {rowQuery.error ? (
        <ErrorState error={rowQuery.error} onRetry={rowQuery.refetch} />
      ) : rows === undefined ? (
        <Spinner label="Ranking wings" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No wings match these filters"
          detail={count > 0 ? 'Try clearing a filter.' : 'Publish a review to start your ranking.'}
        />
      ) : (
        rows.map((item, i) => (
          <button
            key={item.review.id}
            onClick={() => setDetail(item)}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left"
          >
            <span className="w-6 shrink-0 text-center text-xl font-black tabular-nums text-muted">
              {i + 1}
            </span>
            <img
              src={sized(item.review.photos[0]?.url, IMAGE_WIDTHS.thumb)}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl bg-surface2 object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold">
                {item.place.displayName}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {[item.flavour.name, item.place.city].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <HeatMeter value={item.review.heat} size={11} showValue={false} />
                {filters.sortBy !== 'final' && (
                  <span className="text-[10px] font-bold text-muted">
                    {sortLabel.replace('Best ', '')} {item.review.scores[filters.sortBy].toFixed(1)}
                  </span>
                )}
              </span>
            </span>
            <span className="shrink-0">
              <ScoreBadge score={item.review.finalScore} size="sm" />
            </span>
          </button>
        ))
      )}

      <Sheet open={detail != null} onClose={() => setDetail(null)} title={detail?.place.displayName}>
        {detail && <ReviewBreakdown review={detail.review} />}
      </Sheet>
    </div>
  );
}

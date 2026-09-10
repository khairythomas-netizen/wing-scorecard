import { useEffect, useMemo, useState } from 'react';
import { CloseIcon } from '../../components/Icons';
import type { City } from '../../lib/cities';
import type { RankingFilters } from '../../lib/db/store';

export interface RankingFilterState {
  scope: RankingFilters['scope'];
  sortBy: NonNullable<RankingFilters['sortBy']>;
  band: number;
  city: string | null;
}

export const HEAT_BANDS = [
  { label: 'Any heat', min: 1, max: 5 },
  { label: 'Mild', min: 1, max: 2 },
  { label: 'Medium', min: 3, max: 3 },
  { label: 'Hot', min: 4, max: 5 },
] as const;

export const SORTS = [
  { id: 'final', label: 'Best overall' },
  { id: 'cook', label: 'Best cook' },
  { id: 'flavour', label: 'Best flavour' },
  { id: 'value', label: 'Best value' },
  { id: 'sauce', label: 'Best sauce' },
] as const;

export const SCOPES = [
  { id: 'mine', label: 'Mine' },
  { id: 'friends', label: 'Friends' },
  { id: 'global', label: 'Everyone' },
] as const;

export const DEFAULT_FILTERS: RankingFilterState = {
  scope: 'mine',
  sortBy: 'final',
  band: 0,
  city: null,
};

/** How many choices differ from the default, for the badge on the button. */
export function activeCount(f: RankingFilterState, hideScope: boolean): number {
  let n = 0;
  if (!hideScope && f.scope !== DEFAULT_FILTERS.scope) n += 1;
  if (f.sortBy !== DEFAULT_FILTERS.sortBy) n += 1;
  if (f.band !== DEFAULT_FILTERS.band) n += 1;
  if (f.city) n += 1;
  return n;
}

/**
 * Rankings filters, collapsed by default.
 *
 * They previously occupied three scrolling chip rows above the list, so the
 * rankings — the actual point of the page — started below the fold. Everything
 * now lives behind one button that reports how many filters are active.
 */
export function FilterSheet({
  open,
  onClose,
  value,
  onChange,
  cities,
  hideScope,
}: {
  open: boolean;
  onClose: () => void;
  value: RankingFilterState;
  onChange: (next: RankingFilterState) => void;
  cities: City[];
  hideScope: boolean;
}) {
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    if (!open) setCitySearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shownCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const list = q ? cities.filter((c) => c.label.toLowerCase().includes(q)) : cities;
    // A short list needs no search box and no truncation.
    return q ? list.slice(0, 40) : list.slice(0, 12);
  }, [cities, citySearch]);

  const set = <K extends keyof RankingFilterState>(key: K, v: RankingFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const count = activeCount(value, hideScope);

  return (
    <div
      className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
      aria-hidden={!open}
    >
      <div className="min-h-0">
        <div className="mx-4 mb-3 rounded-xl2 border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">Filters</p>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  onClick={() => onChange({ ...DEFAULT_FILTERS, scope: value.scope })}
                  className="text-[11px] font-extrabold text-orange"
                >
                  Reset
                </button>
              )}
              <button onClick={onClose} aria-label="Close filters" className="text-muted">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!hideScope && (
            <Group label="Whose">
              {SCOPES.map((s) => (
                <Pill key={s.id} on={value.scope === s.id} onClick={() => set('scope', s.id)}>
                  {s.label}
                </Pill>
              ))}
            </Group>
          )}

          <Group label="Rank by">
            {SORTS.map((s) => (
              <Pill key={s.id} on={value.sortBy === s.id} onClick={() => set('sortBy', s.id)}>
                {s.label}
              </Pill>
            ))}
          </Group>

          <Group label="Heat">
            {HEAT_BANDS.map((b, i) => (
              <Pill key={b.label} on={value.band === i} onClick={() => set('band', i)}>
                {b.label}
              </Pill>
            ))}
          </Group>

          <Group label="City">
            <Pill on={value.city === null} onClick={() => set('city', null)}>
              Anywhere
            </Pill>
            {shownCities.map((c) => (
              <Pill key={c.key} on={value.city === c.key} onClick={() => set('city', c.key)}>
                {c.label}
                <span className="ml-1 opacity-60">{c.count}</span>
              </Pill>
            ))}
          </Group>

          {cities.length > 12 && (
            <input
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder={`Search ${cities.length} cities`}
              className="mt-1 w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-[12px] outline-none focus:border-orange"
            />
          )}
          {cities.length === 0 && (
            <p className="text-[11px] text-muted">No cities with reviews yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted opacity-70">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
        on ? 'border-transparent bg-text text-bg' : 'border-line bg-surface2 text-muted'
      }`}
    >
      {children}
    </button>
  );
}

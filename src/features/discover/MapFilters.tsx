import type { DiscoverFilters } from '../../lib/db/store';

export const OWNERS: { id: DiscoverFilters['owner']; label: string }[] = [
  { id: 'mine+friends', label: 'Mine + Friends' },
  { id: 'mine', label: 'Mine' },
  { id: 'friends', label: 'Friends' },
  { id: 'everyone', label: 'Everyone' },
  { id: 'wantToTry', label: 'Want to Try' },
];

export const HEAT_BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Any heat', min: 1, max: 5 },
  { label: '🌶️ 1–2', min: 1, max: 2 },
  { label: '🌶️ 3–5', min: 3, max: 5 },
  { label: '🌶️ 4+', min: 4, max: 5 },
];

export const SCORES = [0, 8, 9];

export const DEFAULT_OWNER: DiscoverFilters['owner'] = 'mine+friends';

export interface MapFilterState {
  owner: DiscoverFilters['owner'];
  band: number;
  minScore: number;
}

export const DEFAULT_MAP_FILTERS: MapFilterState = {
  owner: DEFAULT_OWNER,
  band: 0,
  minScore: 0,
};

/** How many filters differ from the defaults, for the badge on the button. */
export function activeMapFilterCount(f: MapFilterState): number {
  return (
    (f.owner === DEFAULT_OWNER ? 0 : 1) + (f.band === 0 ? 0 : 1) + (f.minScore === 0 ? 0 : 1)
  );
}

export function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${
        active ? 'bg-text text-bg' : 'border border-line bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The filter panel, floating over the map rather than stacked above it. Every
 * change applies straight away, so the map redraws underneath while the panel
 * is still open and you can see what a filter did before closing it.
 */
export function MapFilterPanel({
  value,
  onChange,
  onClose,
}: {
  value: MapFilterState;
  onChange: (next: MapFilterState) => void;
  onClose: () => void;
}) {
  const count = activeMapFilterCount(value);

  return (
    <div className="animate-rise absolute right-2 top-12 z-[700] w-[min(19rem,calc(100%-1rem))] rounded-xl3 border border-line bg-[var(--glass)] p-3 shadow-card backdrop-blur-xl">
      <Group label="Whose">
        {OWNERS.map((o) => (
          <Pill key={o.id} active={value.owner === o.id} onClick={() => onChange({ ...value, owner: o.id })}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <Group label="Heat">
        {HEAT_BANDS.map((b, i) => (
          <Pill key={b.label} active={value.band === i} onClick={() => onChange({ ...value, band: i })}>
            {b.label}
          </Pill>
        ))}
      </Group>

      <Group label="Score">
        {SCORES.map((s) => (
          <Pill key={s} active={value.minScore === s} onClick={() => onChange({ ...value, minScore: s })}>
            {s === 0 ? 'Any score' : `${s}+`}
          </Pill>
        ))}
      </Group>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <button
          onClick={() => onChange(DEFAULT_MAP_FILTERS)}
          disabled={count === 0}
          className="text-[11px] font-bold text-muted disabled:opacity-40"
        >
          Reset
        </button>
        <button onClick={onClose} className="text-[11px] font-black text-orange">
          Done
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { PinIcon } from '../../components/Icons';
import { placesProvider, type PlaceSuggestion } from '../../lib/places';
import type { Place } from '../../lib/types';

/**
 * Restaurant is never free text: picking a suggestion resolves to a full Place
 * with an external id, address and coordinates, so the review can appear on a
 * map and roll up by city without any later backfill.
 */
export function RestaurantPicker({
  value,
  onChange,
}: {
  value: Place | null;
  onChange: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (value || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const results = await placesProvider.autocomplete(query);
      // Ignore a response that lost the race to a newer keystroke.
      if (id !== seq.current) return;
      setSuggestions(results);
      setLoading(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  const pick = async (s: PlaceSuggestion) => {
    const place = await placesProvider.details(s.externalId);
    if (!place) return;
    onChange(place);
    setOpen(false);
    setQuery('');
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl2 border border-line bg-surface p-3">
        <PinIcon className="h-5 w-5 shrink-0 text-orange" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{value.displayName}</p>
          <p className="truncate text-[11px] text-muted">{value.formattedAddress}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold text-muted"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search for a restaurant…"
        className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-orange"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl2 border border-line bg-surface shadow-card">
          {loading && suggestions.length === 0 && (
            <p className="px-3.5 py-3 text-[12px] text-muted">Searching…</p>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="px-3.5 py-3 text-[12px] text-muted">
              No match. Try a shorter search.
            </p>
          )}
          {suggestions.map((s) => (
            <button
              key={s.externalId}
              type="button"
              onClick={() => void pick(s)}
              className="flex w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-surface2"
            >
              <PinIcon className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{s.primaryText}</span>
                <span className="block truncate text-[11px] text-muted">{s.secondaryText}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

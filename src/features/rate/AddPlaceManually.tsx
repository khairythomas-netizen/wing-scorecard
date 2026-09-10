import { useEffect, useRef, useState } from 'react';
import { PinIcon } from '../../components/Icons';
import { lastKnownLocation } from '../../lib/location';
import { placesProvider } from '../../lib/places';
import { normalizeName, type GeocodedAddress } from '../../lib/places/provider';
import type { Place } from '../../lib/types';

/**
 * Adding a restaurant the map data has never heard of.
 *
 * The address is chosen from geocoder results rather than typed freely. That
 * is what guarantees the new restaurant lands on the map: a picked candidate
 * already carries coordinates and a parsed city, so there is no later step
 * that can fail or be skipped, and the city filter groups it correctly from
 * the moment it exists.
 */
export function AddPlaceManually({
  initialName,
  onAdd,
  onCancel,
}: {
  initialName: string;
  onAdd: (place: Place) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodedAddress[]>([]);
  const [chosen, setChosen] = useState<GeocodedAddress | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (chosen || query.trim().length < 4) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const hits = await placesProvider.searchAddresses(
          query,
          lastKnownLocation() ?? undefined,
        );
        if (id !== seq.current) return;
        setResults(hits);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, chosen]);

  const submit = () => {
    if (!name.trim()) {
      setError('Give the place a name.');
      return;
    }
    if (!chosen) {
      setError('Pick the address from the list so it lands on the map.');
      return;
    }
    onAdd({
      id: `manual:${Date.now().toString(36)}`,
      externalId: `manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      provider: 'manual',
      displayName: name.trim(),
      normalizedName: normalizeName(name),
      formattedAddress: chosen.formatted,
      lat: chosen.lat,
      lng: chosen.lng,
      city: chosen.city,
      region: chosen.region,
      country: chosen.country,
    });
  };

  const input =
    'w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-orange';

  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <p className="text-[11px] font-bold text-muted">Add a place we do not have</p>

      <div className="mt-2 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Restaurant name"
          className={input}
          autoFocus
        />

        {chosen ? (
          <div className="flex items-center gap-2.5 rounded-xl2 border border-line bg-surface2 p-3">
            <PinIcon className="h-5 w-5 shrink-0 text-orange" />
            <p className="min-w-0 flex-1 truncate text-[12px]">{chosen.formatted}</p>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setQuery('');
              }}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-muted"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              placeholder="Search the street address"
              className={input}
            />
            {query.trim().length >= 4 && (
              <div className="mt-1 overflow-hidden rounded-xl2 border border-line bg-surface">
                {searching && results.length === 0 && (
                  <p className="px-3.5 py-2.5 text-[12px] text-muted">Searching addresses…</p>
                )}
                {!searching && results.length === 0 && (
                  <p className="px-3.5 py-2.5 text-[12px] text-muted">
                    No address found. Include the street number and city.
                  </p>
                )}
                {results.map((r) => (
                  <button
                    key={`${r.lat},${r.lng},${r.formatted}`}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setChosen(r);
                      setError(null);
                    }}
                    className="flex w-full items-start gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-0"
                  >
                    <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 text-[12px] leading-snug">{r.formatted}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-[12px] font-semibold text-danger">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!chosen || !name.trim()}
            className="flex-1 rounded-xl bg-gradient-to-br from-orange to-gold py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40"
          >
            Add restaurant
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line bg-surface2 px-4 py-2.5 text-[12px] font-extrabold text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

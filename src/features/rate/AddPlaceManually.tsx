import { useState } from 'react';
import { placesProvider } from '../../lib/places';
import { normalizeName } from '../../lib/places/provider';
import type { Place } from '../../lib/types';

/**
 * Adding a restaurant the map data has never heard of.
 *
 * New and independent places are routinely missing from OpenStreetMap — and
 * from Google too. A wing app runs into that constantly, so being told "no
 * match" has to be the start of a path rather than a dead end. The address is
 * geocoded so a hand-added place still lands correctly on the map and rolls
 * up by city like any other.
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
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the place a name.');
      return;
    }
    if (address.trim().length < 5) {
      setError('Enter a street address so it lands on the map.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hit = await placesProvider.geocodeAddress(address);
      if (!hit) {
        setError('Could not find that address. Try including the city.');
        return;
      }
      // Derive city/region/country from the geocoder's formatted address.
      const parts = hit.formatted.split(',').map((p) => p.trim());
      const country = parts.at(-1) ?? '';
      const region = parts.length >= 3 ? (parts.at(-3) ?? '') : '';
      const city = parts.length >= 5 ? (parts.at(-5) ?? '') : (parts.at(-4) ?? '');

      onAdd({
        id: `manual:${Date.now().toString(36)}`,
        externalId: `manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        provider: 'manual',
        displayName: name.trim(),
        normalizedName: normalizeName(name),
        formattedAddress: address.trim(),
        lat: hit.lat,
        lng: hit.lng,
        city,
        region,
        country,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that place.');
    } finally {
      setBusy(false);
    }
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
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="1750 St Clair Ave W, Toronto"
          className={input}
        />
        {error && <p className="text-[12px] font-semibold text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex-1 rounded-xl bg-gradient-to-br from-orange to-gold py-2.5 text-[12px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? 'Locating…' : 'Add restaurant'}
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

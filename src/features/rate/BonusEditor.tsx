import { CloseIcon } from '../../components/Icons';
import {
  MAX_BONUS_ROWS,
  MAX_BONUS_TOTAL,
  bonusOptionsForRow,
  bonusTotal,
  type BonusEntry,
} from '../../lib/scoring';

const newRow = (): BonusEntry => ({
  id: `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  reason: '',
  amount: 0,
});

/**
 * The original multi-reason bonus system, kept intact.
 *
 * Up to five separate reasons, each in 0.1 steps, combined never above +0.5.
 * A single generic "bonus" slider would lose the reasons, which are the part
 * worth reading back later ("free wings", "incredible homemade ranch").
 * Each row only offers amounts that still fit under the cap, so the total can
 * never be pushed over it in the first place.
 */
export function BonusEditor({
  bonuses,
  onChange,
}: {
  bonuses: BonusEntry[];
  onChange: (bonuses: BonusEntry[]) => void;
}) {
  const total = bonusTotal(bonuses);
  const atRowLimit = bonuses.length >= MAX_BONUS_ROWS;
  const atValueLimit = total >= MAX_BONUS_TOTAL;

  const update = (id: string, patch: Partial<BonusEntry>) =>
    onChange(bonuses.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const remove = (id: string) => {
    const next = bonuses.filter((b) => b.id !== id);
    // Keep one blank row available rather than leaving an empty panel.
    onChange(next.length ? next : [newRow()]);
  };

  return (
    <div className="rounded-xl2 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">Miscellaneous bonus</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            Up to {MAX_BONUS_ROWS} reasons. Combined maximum +{MAX_BONUS_TOTAL.toFixed(1)}.
          </p>
        </div>
        <span className="shrink-0 text-base font-black tabular-nums text-orange">
          +{total.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {bonuses.map((b) => {
          const options = bonusOptionsForRow(bonuses, b.id);
          return (
            <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_84px_36px] gap-2">
              <input
                value={b.reason}
                onChange={(e) => update(b.id, { reason: e.target.value })}
                placeholder="Bonus reason"
                aria-label="Bonus reason"
                className="min-w-0 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[13px] outline-none placeholder:text-muted focus:border-orange"
              />
              <select
                value={b.amount}
                onChange={(e) => update(b.id, { amount: Number(e.target.value) })}
                aria-label="Bonus amount"
                className="rounded-xl border border-line bg-surface2 px-2 py-2.5 text-[13px] font-bold tabular-nums outline-none focus:border-orange"
              >
                {options.map((v) => (
                  <option key={v} value={v}>
                    +{v.toFixed(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(b.id)}
                aria-label="Remove bonus"
                className="grid place-items-center rounded-xl border border-line bg-surface2 text-muted"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={atRowLimit || atValueLimit}
        onClick={() => onChange([...bonuses, newRow()])}
        className="mt-3 w-full rounded-xl border border-line bg-surface2 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
      >
        + Add bonus
      </button>

      {(atRowLimit || atValueLimit) && (
        <p className="mt-2 text-center text-[10px] font-semibold text-muted">
          {atValueLimit
            ? `Bonus is at the +${MAX_BONUS_TOTAL.toFixed(1)} maximum.`
            : `That is all ${MAX_BONUS_ROWS} bonus rows.`}
        </p>
      )}
    </div>
  );
}

export { newRow as newBonusRow };

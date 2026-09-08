const LABELS = ['Barely warm', 'Mild', 'Solid kick', 'Hot', 'Punishing'];

/**
 * Every review carries a 1-5 heat rating, and it deliberately contributes
 * nothing to the score. It is filterable metadata, not a judgement of quality.
 */
export function HeatPicker({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4 | 5 | null;
  onChange: (heat: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">
            Spiciness <span className="text-orange">*</span>
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            Descriptive only — this never affects the score.
          </p>
        </div>
        <span className="shrink-0 text-sm font-black tabular-nums">
          {value ? `${value} / 5` : '—'}
        </span>
      </div>

      <div className="mt-3 flex gap-1.5">
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const on = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} pepper${n > 1 ? 's' : ''} — ${LABELS[n - 1]}`}
              aria-pressed={on}
              className={`grid h-11 flex-1 place-items-center rounded-xl border text-lg transition-all ${
                on
                  ? 'border-orange bg-orange/10 opacity-100'
                  : 'border-line bg-surface2 opacity-45 grayscale'
              }`}
            >
              🌶️
            </button>
          );
        })}
      </div>

      <p className="mt-2 h-4 text-center text-[11px] font-semibold text-muted">
        {value ? LABELS[value - 1] : 'Pick a heat level'}
      </p>
    </div>
  );
}

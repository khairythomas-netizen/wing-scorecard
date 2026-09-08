/** A plain 0-to-max component slider. Cook is deliberately not one of these. */
export function MetricSlider({
  label,
  hint,
  value,
  max,
  onChange,
  rounded,
}: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  rounded?: 'bottom' | 'none';
}) {
  return (
    <div
      className={`border-x border-b border-line bg-surface p-4 ${
        rounded === 'bottom' ? 'rounded-b-xl2' : ''
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-extrabold">{label}</span>
          {hint && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {hint}
            </span>
          )}
        </div>
        <span className="text-sm font-black tabular-nums">
          {value.toFixed(1)}{' '}
          <span className="text-[11px] font-bold text-muted">/ {max}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="metric-range mt-3.5"
      />
    </div>
  );
}

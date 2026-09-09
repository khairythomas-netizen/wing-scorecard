import {
  COOK_SLIDER_CENTER,
  COOK_SLIDER_MAX,
  COOK_SLIDER_MIN,
  cookScore,
  cookSide,
} from '../../lib/scoring';

const SIDE_LABEL = {
  raw: 'Leaning underdone',
  perfect: 'Perfect',
  burnt: 'Leaning overdone',
} as const;

/**
 * Cook is the one special control, and it carries 3.0 of the 10.
 *
 * It is a single symmetric axis: raw at the left, perfect in the middle, burnt
 * at the right, scoring 0 -> 3 -> 0. Doneness, crispiness, juiciness and
 * tenderness all live inside this one judgement rather than being split apart.
 * The slider position is kept alongside the score because 2.0 undercooked and
 * 2.0 overcooked are very different wings.
 */
export function CookSlider({
  position,
  onChange,
}: {
  position: number;
  onChange: (position: number) => void;
}) {
  const score = cookScore(position);
  const side = cookSide(position);

  return (
    <div className="rounded-t-xl2 border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-extrabold">Cook</span>
          <span className="ml-1.5 text-[10.5px] font-medium text-muted opacity-80">
            doneness, crisp and juiciness
          </span>
        </div>
        <span className="text-sm font-black tabular-nums">
          {score.toFixed(1)} <span className="text-[11px] font-bold text-muted">/ 3</span>
        </span>
      </div>

      <input
        type="range"
        min={COOK_SLIDER_MIN}
        max={COOK_SLIDER_MAX}
        step={1}
        value={position}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Cook: raw at the left, perfect in the middle, burnt at the right"
        aria-valuetext={`${score.toFixed(1)} of 3, ${SIDE_LABEL[side]}`}
        className="metric-range cook-range mt-4"
      />

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted">Raw · 0</span>
        <button
          type="button"
          onClick={() => onChange(COOK_SLIDER_CENTER)}
          className={`rounded-full border px-3 py-1 text-[10px] font-extrabold transition-colors ${
            side === 'perfect'
              ? 'border-green bg-green/15 text-green'
              : 'border-line bg-surface2 text-text'
          }`}
        >
          Perfect · 3
        </button>
        <span className="text-[10px] font-semibold text-muted">Burnt · 0</span>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold text-muted">{SIDE_LABEL[side]}</p>
    </div>
  );
}

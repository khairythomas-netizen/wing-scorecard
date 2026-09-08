/**
 * The WingZ scoring engine.
 *
 * Ported verbatim from the original prototype's inline script. The numbers here
 * are product canon — do not "simplify" them:
 *
 *   Core        9.0  (cook 3 + flavour 2 + sauce 1 + value 1 + size .5
 *                     + eye .5 + sides .5 + ratio .2 + drink .3)
 *   Experience  1.0  (towelette .2 + napkins .2 + sauce options .2 + atmosphere .4)
 *   Base       10.0
 *   Bonus      +0.5  max, across up to 5 separate reasons
 *
 * A final score may therefore reach 10.5, and is still displayed over 10.
 * Extraordinary wings are allowed to beat a perfect 10.
 */

export const COOK_SLIDER_MIN = 0;
export const COOK_SLIDER_MAX = 60;
export const COOK_SLIDER_CENTER = 30;
/** Positions within this distance of centre snap to an exact 3.0. */
export const COOK_SNAP_RADIUS = 2;

export const MAX_BONUS_TOTAL = 0.5;
export const MAX_BONUS_ROWS = 5;
export const BONUS_STEP = 0.1;

/** Every base-score component and the maximum it can contribute. */
export const CORE_WEIGHTS = {
  cook: 3,
  flavour: 2,
  sauce: 1,
  value: 1,
  size: 0.5,
  eye: 0.5,
  sides: 0.5,
  ratio: 0.2,
  drink: 0.3,
} as const;

export const EXPERIENCE_WEIGHTS = {
  towelette: 0.2,
  napkins: 0.2,
  sauceOptions: 0.2,
  atmosphere: 0.4,
} as const;

export type CoreKey = keyof typeof CORE_WEIGHTS;
export type ExperienceKey = keyof typeof EXPERIENCE_WEIGHTS;

export const CORE_MAX = 9.0;
export const EXPERIENCE_MAX = 1.0;
export const BASE_MAX = 10.0;

export interface BonusEntry {
  id: string;
  reason: string;
  /** 0 to 0.5 in 0.1 steps. */
  amount: number;
}

export interface ScoreInput {
  /** Raw slider position 0-60. 30 is perfect. Both extremes score 0. */
  cookPosition: number;
  flavour: number;
  sauce: number;
  value: number;
  size: number;
  eye: number;
  sides: number;
  ratio: number;
  drink: number;
  towelette: boolean;
  napkins: boolean;
  sauceOptions: number;
  atmosphere: number;
  bonuses: BonusEntry[];
}

export interface ScoreBreakdown {
  cook: number;
  core: number;
  experience: number;
  base: number;
  bonus: number;
  final: number;
  components: Record<CoreKey | ExperienceKey, number>;
}

/** Round to one decimal without float dust (0.1 + 0.2 style). */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Snap a raw cook slider position to its effective position.
 * Anything within COOK_SNAP_RADIUS of centre becomes exactly centre, so a
 * perfect 3.0 is easy to land on with a thumb.
 */
export function snapCookPosition(position: number): number {
  const p = clamp(position, COOK_SLIDER_MIN, COOK_SLIDER_MAX);
  return Math.abs(p - COOK_SLIDER_CENTER) <= COOK_SNAP_RADIUS ? COOK_SLIDER_CENTER : p;
}

/**
 * Cook is a symmetric 0 -> 3 -> 0 curve: raw at the left, perfect in the
 * middle, burnt at the right. The same score exists on both sides, which is
 * why the slider position is stored alongside the score.
 */
export function cookScore(position: number): number {
  const p = snapCookPosition(position);
  return round1(Math.max(0, 3 - Math.abs(p - COOK_SLIDER_CENTER) / 10));
}

/** Which side of perfect a cook position sits on. */
export function cookSide(position: number): 'raw' | 'perfect' | 'burnt' {
  const p = snapCookPosition(position);
  if (p === COOK_SLIDER_CENTER) return 'perfect';
  return p < COOK_SLIDER_CENTER ? 'raw' : 'burnt';
}

/**
 * Total the bonus rows, capped at +0.5 no matter what the individual rows say.
 */
export function bonusTotal(bonuses: BonusEntry[]): number {
  const sum = bonuses.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  return round1(Math.min(MAX_BONUS_TOTAL, Math.max(0, sum)));
}

/**
 * The largest amount a given row may hold without pushing the combined total
 * past +0.5. Used to clamp a row the moment it is edited.
 */
export function maxAllowedForRow(bonuses: BonusEntry[], rowId: string): number {
  const others = bonuses
    .filter((b) => b.id !== rowId)
    .reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  return round1(clamp(MAX_BONUS_TOTAL - others, 0, MAX_BONUS_TOTAL));
}

/** The selectable bonus amounts for a row, given what the other rows hold. */
export function bonusOptionsForRow(bonuses: BonusEntry[], rowId: string): number[] {
  const max = maxAllowedForRow(bonuses, rowId);
  const options: number[] = [];
  for (let v = 0; v <= MAX_BONUS_TOTAL + 1e-9; v += BONUS_STEP) {
    const rounded = round1(v);
    if (rounded <= max + 1e-9) options.push(rounded);
  }
  return options;
}

export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const cook = cookScore(input.cookPosition);

  const components = {
    cook,
    flavour: clamp(input.flavour, 0, CORE_WEIGHTS.flavour),
    sauce: clamp(input.sauce, 0, CORE_WEIGHTS.sauce),
    value: clamp(input.value, 0, CORE_WEIGHTS.value),
    size: clamp(input.size, 0, CORE_WEIGHTS.size),
    eye: clamp(input.eye, 0, CORE_WEIGHTS.eye),
    sides: clamp(input.sides, 0, CORE_WEIGHTS.sides),
    ratio: clamp(input.ratio, 0, CORE_WEIGHTS.ratio),
    drink: clamp(input.drink, 0, CORE_WEIGHTS.drink),
    towelette: input.towelette ? EXPERIENCE_WEIGHTS.towelette : 0,
    napkins: input.napkins ? EXPERIENCE_WEIGHTS.napkins : 0,
    sauceOptions: clamp(input.sauceOptions, 0, EXPERIENCE_WEIGHTS.sauceOptions),
    atmosphere: clamp(input.atmosphere, 0, EXPERIENCE_WEIGHTS.atmosphere),
  } satisfies Record<CoreKey | ExperienceKey, number>;

  const core = round1(
    (Object.keys(CORE_WEIGHTS) as CoreKey[]).reduce((acc, k) => acc + components[k], 0),
  );
  const experience = round1(
    (Object.keys(EXPERIENCE_WEIGHTS) as ExperienceKey[]).reduce((acc, k) => acc + components[k], 0),
  );
  const base = round1(core + experience);
  const bonus = bonusTotal(input.bonuses);
  const final = round1(base + bonus);

  return { cook, core, experience, base, bonus, final, components };
}

/** Always displayed over 10, even when the final score exceeds it. */
export function formatScore(final: number): string {
  return final.toFixed(1);
}

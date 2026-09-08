import { BreakdownRows } from '../features/rate/RateScreen';
import { CORE_MAX, EXPERIENCE_MAX, round1, type BonusEntry } from '../lib/scoring';
import type { Review } from '../lib/types';

/**
 * Renders a stored review's breakdown. Reads the persisted sub-scores rather
 * than recomputing them, so an old review always shows what was actually
 * recorded even if the form changes later.
 */
export function ReviewBreakdown({ review }: { review: Review }) {
  const c = review.scores;
  const core = round1(
    c.cook + c.flavour + c.sauce + c.value + c.size + c.eye + c.sides + c.ratio + c.drink,
  );
  const experience = round1(c.towelette + c.napkins + c.sauceOptions + c.atmosphere);

  const bonuses: BonusEntry[] = review.bonuses;

  return (
    <BreakdownRows
      result={{
        cook: c.cook,
        core: Math.min(core, CORE_MAX),
        experience: Math.min(experience, EXPERIENCE_MAX),
        base: review.baseScore,
        bonus: review.bonusScore,
        final: review.finalScore,
        components: {
          cook: c.cook,
          flavour: c.flavour,
          sauce: c.sauce,
          value: c.value,
          size: c.size,
          eye: c.eye,
          sides: c.sides,
          ratio: c.ratio,
          drink: c.drink,
          towelette: c.towelette,
          napkins: c.napkins,
          sauceOptions: c.sauceOptions,
          atmosphere: c.atmosphere,
        },
      }}
      bonuses={bonuses}
    />
  );
}

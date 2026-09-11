import { describe, expect, it } from 'vitest';
import { contrastWithWhite, luminance, scoreGradient, scoreRgb } from './scoreColor';

describe('score colour ramp', () => {
  it('runs red at the bottom and green at the top', () => {
    const low = scoreRgb(5);
    const high = scoreRgb(10);
    expect(low[0]).toBeGreaterThan(low[1]); // red channel dominates
    expect(high[1]).toBeGreaterThan(high[0]); // green channel dominates
  });

  it('gets greener as the score rises, with no steps backwards', () => {
    let previous = -Infinity;
    for (let s = 5; s <= 10.5; s += 0.25) {
      const [r, g] = scoreRgb(s);
      const greenness = g - r;
      expect(greenness).toBeGreaterThanOrEqual(previous - 0.001);
      previous = greenness;
    }
  });

  it('keeps white text readable at every score', () => {
    // The amber middle is where this usually fails: rotating hue through
    // yellow produces a colour far too light to put white on.
    for (let s = 0; s <= 11; s += 0.1) {
      expect(contrastWithWhite(scoreRgb(s))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('clamps outside the anchored range instead of running off the ramp', () => {
    expect(scoreRgb(-3)).toEqual(scoreRgb(5));
    expect(scoreRgb(99)).toEqual(scoreRgb(10.5));
  });

  it('treats a 10.5 as the best score there is, not an error', () => {
    // The bonus can push past 10 and that must stay the greenest thing shown.
    expect(luminance(scoreRgb(10.5))).toBeLessThan(luminance(scoreRgb(7)));
    expect(scoreRgb(10.5)[1]).toBeGreaterThan(scoreRgb(10.5)[0]);
  });

  it('produces a usable CSS gradient', () => {
    expect(scoreGradient(8)).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/);
  });
});

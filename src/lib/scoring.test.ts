import { describe, it, expect } from 'vitest';
import {
  BASE_MAX,
  CORE_MAX,
  CORE_WEIGHTS,
  EXPERIENCE_MAX,
  EXPERIENCE_WEIGHTS,
  MAX_BONUS_TOTAL,
  bonusOptionsForRow,
  bonusTotal,
  calculateScore,
  cookScore,
  cookSide,
  maxAllowedForRow,
  snapCookPosition,
} from './scoring';

const bonus = (id: string, amount: number) => ({ id, reason: '', amount });

const perfectInput = {
  cookPosition: 30,
  flavour: CORE_WEIGHTS.flavour,
  sauce: CORE_WEIGHTS.sauce,
  value: CORE_WEIGHTS.value,
  size: CORE_WEIGHTS.size,
  eye: CORE_WEIGHTS.eye,
  sides: CORE_WEIGHTS.sides,
  ratio: CORE_WEIGHTS.ratio,
  drink: CORE_WEIGHTS.drink,
  towelette: true,
  napkins: true,
  sauceOptions: EXPERIENCE_WEIGHTS.sauceOptions,
  atmosphere: EXPERIENCE_WEIGHTS.atmosphere,
  bonuses: [],
};

const zeroInput = {
  cookPosition: 0,
  flavour: 0,
  sauce: 0,
  value: 0,
  size: 0,
  eye: 0,
  sides: 0,
  ratio: 0,
  drink: 0,
  towelette: false,
  napkins: false,
  sauceOptions: 0,
  atmosphere: 0,
  bonuses: [],
};

describe('weights are product canon', () => {
  it('core totals 9.0', () => {
    expect(Object.values(CORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(CORE_MAX, 10);
  });
  it('experience totals 1.0', () => {
    expect(Object.values(EXPERIENCE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(
      EXPERIENCE_MAX,
      10,
    );
  });
  it('base totals 10.0', () => {
    expect(CORE_MAX + EXPERIENCE_MAX).toBeCloseTo(BASE_MAX, 10);
  });
});

describe('cook curve', () => {
  it('is 3.0 at the centre', () => expect(cookScore(30)).toBe(3));
  it('is 0 at the raw extreme', () => expect(cookScore(0)).toBe(0));
  it('is 0 at the burnt extreme', () => expect(cookScore(60)).toBe(0));

  it('is symmetric around the centre', () => {
    for (let d = 3; d <= 30; d++) {
      expect(cookScore(30 - d)).toBeCloseTo(cookScore(30 + d), 10);
    }
  });

  it('snaps to an exact 3.0 near the centre', () => {
    for (const p of [28, 29, 30, 31, 32]) {
      expect(snapCookPosition(p)).toBe(30);
      expect(cookScore(p)).toBe(3);
    }
    expect(snapCookPosition(27)).toBe(27);
  });

  it('distinguishes undercooked from overcooked at the same score', () => {
    expect(cookScore(15)).toBe(cookScore(45));
    expect(cookSide(15)).toBe('raw');
    expect(cookSide(45)).toBe('burnt');
    expect(cookSide(30)).toBe('perfect');
  });

  it('clamps positions outside the slider range', () => {
    expect(cookScore(-10)).toBe(0);
    expect(cookScore(999)).toBe(0);
  });
});

describe('bonus', () => {
  it('sums rows', () => {
    expect(bonusTotal([bonus('a', 0.2), bonus('b', 0.2), bonus('c', 0.1)])).toBe(0.5);
  });

  it('never exceeds +0.5 even if rows do', () => {
    expect(bonusTotal([bonus('a', 0.5), bonus('b', 0.5), bonus('c', 0.5)])).toBe(MAX_BONUS_TOTAL);
  });

  it('avoids float dust', () => {
    expect(bonusTotal([bonus('a', 0.1), bonus('b', 0.2)])).toBe(0.3);
  });

  it('reports the headroom left for a given row', () => {
    const rows = [bonus('a', 0.2), bonus('b', 0.2), bonus('c', 0.1)];
    expect(maxAllowedForRow(rows, 'c')).toBe(0.1);
    expect(maxAllowedForRow(rows, 'a')).toBe(0.2);
    expect(maxAllowedForRow([bonus('a', 0)], 'a')).toBe(0.5);
  });

  it('only offers amounts that fit under the cap', () => {
    const rows = [bonus('a', 0.3), bonus('b', 0)];
    expect(bonusOptionsForRow(rows, 'b')).toEqual([0, 0.1, 0.2]);
    expect(bonusOptionsForRow([bonus('a', 0)], 'a')).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });
});

describe('calculateScore', () => {
  it('gives a perfect card exactly 10.0 with no bonus', () => {
    const r = calculateScore(perfectInput);
    expect(r.core).toBe(9);
    expect(r.experience).toBe(1);
    expect(r.base).toBe(10);
    expect(r.bonus).toBe(0);
    expect(r.final).toBe(10);
  });

  it('lets an extraordinary card reach 10.5 and does not normalise it back', () => {
    const r = calculateScore({
      ...perfectInput,
      bonuses: [bonus('a', 0.2), bonus('b', 0.2), bonus('c', 0.1)],
    });
    expect(r.final).toBe(10.5);
  });

  it('caps a run-away bonus at 10.5', () => {
    const r = calculateScore({
      ...perfectInput,
      bonuses: [bonus('a', 0.5), bonus('b', 0.5)],
    });
    expect(r.final).toBe(10.5);
  });

  it('floors at 0', () => {
    const r = calculateScore(zeroInput);
    expect(r.base).toBe(0);
    expect(r.final).toBe(0);
  });

  it('clamps components that exceed their weight', () => {
    const r = calculateScore({ ...perfectInput, flavour: 99, ratio: 99 });
    expect(r.components.flavour).toBe(CORE_WEIGHTS.flavour);
    expect(r.components.ratio).toBe(CORE_WEIGHTS.ratio);
    expect(r.base).toBe(10);
  });

  it('retains every sub-score, not just the total', () => {
    const r = calculateScore({ ...perfectInput, cookPosition: 20, flavour: 1.4 });
    expect(r.components.cook).toBe(2);
    expect(r.components.flavour).toBe(1.4);
    expect(r.components.towelette).toBe(0.2);
    expect(Object.keys(r.components)).toHaveLength(13);
  });

  it('treats the binary experience controls as all-or-nothing', () => {
    const off = calculateScore({ ...perfectInput, towelette: false, napkins: false });
    expect(off.experience).toBe(0.6);
    expect(off.base).toBe(9.6);
  });
});

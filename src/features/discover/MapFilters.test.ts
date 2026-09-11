import { describe, expect, it } from 'vitest';
import {
  activeMapFilterCount,
  DEFAULT_MAP_FILTERS,
  HEAT_BANDS,
  OWNERS,
  SCORES,
} from './MapFilters';

describe('map filter badge', () => {
  it('shows nothing when everything is at its default', () => {
    expect(activeMapFilterCount(DEFAULT_MAP_FILTERS)).toBe(0);
  });

  it('counts each group that has moved off its default', () => {
    expect(activeMapFilterCount({ ...DEFAULT_MAP_FILTERS, owner: 'everyone' })).toBe(1);
    expect(activeMapFilterCount({ ...DEFAULT_MAP_FILTERS, band: 2 })).toBe(1);
    expect(activeMapFilterCount({ ...DEFAULT_MAP_FILTERS, minScore: 9 })).toBe(1);
    expect(activeMapFilterCount({ owner: 'friends', band: 3, minScore: 8 })).toBe(3);
  });

  it('treats the widest option in each group as no filter at all', () => {
    // "Any heat" and "Any score" narrow nothing, so they must not light up
    // the badge and imply the map is hiding pins.
    expect(HEAT_BANDS[0]).toMatchObject({ min: 1, max: 5 });
    expect(SCORES[0]).toBe(0);
    expect(activeMapFilterCount({ ...DEFAULT_MAP_FILTERS, band: 0, minScore: 0 })).toBe(0);
  });

  it('offers every scope the map supports', () => {
    expect(OWNERS.map((o) => o.id)).toEqual([
      'mine+friends',
      'mine',
      'friends',
      'everyone',
      'wantToTry',
    ]);
  });
});

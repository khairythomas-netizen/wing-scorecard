import { describe, expect, it } from 'vitest';
import { DEFAULT_TAB, isTabId } from './BottomNav';

describe('tab identity', () => {
  it('lands a cold start on Rate', () => {
    expect(DEFAULT_TAB).toBe('rate');
  });

  it('accepts every real tab', () => {
    for (const tab of ['feed', 'discover', 'rate', 'rankings', 'profile']) {
      expect(isTabId(tab)).toBe(true);
    }
  });

  it('rejects anything else, so a stale stored value cannot break the app', () => {
    // This guards the value handed across a refresh through session storage:
    // a renamed tab would otherwise leave someone on a blank screen.
    for (const junk of ['', 'settings', null, undefined, 42, {}]) {
      expect(isTabId(junk)).toBe(false);
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { endGuest, isGuest, markSeedFollowDone, needsSeedFollow, startGuest } from './guest';

// These tests run in Node, which has no localStorage. The module is written to
// survive its absence, so a stub is needed to exercise the path that matters.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

describe('guest browsing', () => {
  beforeEach(() => localStorage.clear());

  it('is off until someone chooses it', () => {
    expect(isGuest()).toBe(false);
  });

  it('remembers the choice across a reload', () => {
    startGuest();
    expect(isGuest()).toBe(true);
  });

  it('ends when an account takes over', () => {
    startGuest();
    endGuest();
    expect(isGuest()).toBe(false);
  });
});

describe('house account seeding', () => {
  beforeEach(() => localStorage.clear());

  it('is needed once per person', () => {
    expect(needsSeedFollow('u1')).toBe(true);
    markSeedFollowDone('u1');
    expect(needsSeedFollow('u1')).toBe(false);
  });

  it('never asks again, so unfollowing sticks', () => {
    // Re-following someone who deliberately unfollowed would be obnoxious.
    markSeedFollowDone('u1');
    expect(needsSeedFollow('u1')).toBe(false);
    expect(needsSeedFollow('u1')).toBe(false);
  });

  it('tracks each person separately on a shared device', () => {
    markSeedFollowDone('u1');
    expect(needsSeedFollow('u2')).toBe(true);
  });
});

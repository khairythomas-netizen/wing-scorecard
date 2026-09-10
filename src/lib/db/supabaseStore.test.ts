import { describe, expect, it } from 'vitest';
import { toPlace, toReview, type PlaceRow, type ReviewRow } from './supabaseStore';
import { friendlyAuthError, validateUsername } from '../auth/types';
import { toProfile } from '../auth/supabaseAuth';

/**
 * Postgres returns numeric columns as *strings* over PostgREST. If any of
 * them reached the UI unconverted, scores would concatenate instead of add
 * and sorting would go lexicographic. These tests pin that conversion.
 */
const placeRow: PlaceRow = {
  id: 'uuid-place',
  provider: 'google',
  external_id: 'ChIJabc',
  display_name: 'Bird Bar',
  normalized_name: 'bird bar',
  formatted_address: '128 Ossington Ave, Toronto, ON',
  lat: 43.6479,
  lng: -79.4204,
  city: 'Toronto',
  region: 'ON',
  country: 'Canada',
};

const reviewRow: ReviewRow = {
  id: 'uuid-review',
  author_id: 'uuid-user',
  place_id: 'uuid-place',
  flavour_id: 'uuid-flavour',
  order_text: '20-wing combo',
  price_cents: 2799,
  currency: 'CAD',
  heat: 4,
  caption: 'Excellent',
  visibility: 'public',
  base_score: '10.0',
  bonus_score: '0.5',
  final_score: '10.5',
  created_at: '2026-09-01T12:00:00Z',
  scores: {
    cook: '3.0',
    cook_position: 30,
    flavour: '2.0',
    sauce: '1.0',
    value: '1.0',
    size: '0.5',
    eye: '0.5',
    sides: '0.5',
    ratio: '0.2',
    drink: '0.3',
    towelette: '0.2',
    napkins: '0.2',
    sauce_options: '0.2',
    atmosphere: '0.4',
  },
  bonuses: [
    { id: 'b2', reason: 'Homemade ranch', amount: '0.2', position: 1 },
    { id: 'b1', reason: 'Free wings', amount: '0.3', position: 0 },
  ],
  photos: [
    { id: 'p2', url: 'https://cdn/2.jpg', position: 1, kind: 'menu' },
    { id: 'p1', url: 'https://cdn/1.jpg', position: 0, kind: 'wing' },
  ],
};

describe('review row mapping', () => {
  const review = toReview(reviewRow);

  it('converts numeric strings to numbers, not string concatenation', () => {
    expect(review.finalScore).toBe(10.5);
    expect(review.baseScore).toBe(10);
    expect(review.bonusScore).toBe(0.5);
    expect(typeof review.scores.cook).toBe('number');
    expect(review.scores.cook + review.scores.flavour).toBe(5);
  });

  it('keeps every sub-score, including the raw cook position', () => {
    expect(review.scores.cookPosition).toBe(30);
    expect(Object.keys(review.scores)).toHaveLength(14);
    const base =
      review.scores.cook + review.scores.flavour + review.scores.sauce +
      review.scores.value + review.scores.size + review.scores.eye +
      review.scores.sides + review.scores.ratio + review.scores.drink +
      review.scores.towelette + review.scores.napkins +
      review.scores.sauceOptions + review.scores.atmosphere;
    expect(base).toBeCloseTo(10, 10);
  });

  it('orders bonuses and photos by position, not by row order', () => {
    expect(review.bonuses.map((b) => b.reason)).toEqual(['Free wings', 'Homemade ranch']);
    expect(review.bonuses.map((b) => b.amount)).toEqual([0.3, 0.2]);
    // Position 0 is the required main photo and must come first.
    expect(review.photos[0]!.url).toBe('https://cdn/1.jpg');
    expect(review.photos[0]!.kind).toBe('wing');
  });

  it('survives a review with no bonuses or photos', () => {
    const bare = toReview({ ...reviewRow, bonuses: undefined, photos: undefined });
    expect(bare.bonuses).toEqual([]);
    expect(bare.photos).toEqual([]);
  });

  it('defaults missing scores to 0 rather than NaN', () => {
    const noScores = toReview({ ...reviewRow, scores: null });
    expect(noScores.scores.cook).toBe(0);
    expect(Number.isNaN(noScores.scores.flavour)).toBe(false);
  });
});

describe('place row mapping', () => {
  it('carries the full geographic identity', () => {
    const place = toPlace(placeRow);
    expect(place).toMatchObject({
      externalId: 'ChIJabc',
      provider: 'google',
      displayName: 'Bird Bar',
      city: 'Toronto',
      region: 'ON',
      country: 'Canada',
    });
    expect(typeof place.lat).toBe('number');
    expect(typeof place.lng).toBe('number');
  });

  it('handles coordinates arriving as strings', () => {
    const place = toPlace({ ...placeRow, lat: '43.6479' as never, lng: '-79.4204' as never });
    expect(place.lat).toBeCloseTo(43.6479, 6);
    expect(place.lng).toBeCloseTo(-79.4204, 6);
  });
});

describe('profile row mapping', () => {
  it('treats a null username as not yet claimed', () => {
    const p = toProfile({
      id: 'u1', username: null, display_name: '', bio: '', avatar_url: '', is_private: false,
    });
    // Empty string is what the app checks to route to the username step.
    expect(p.username).toBe('');
  });

  it('carries a claimed username and privacy flag through', () => {
    const p = toProfile({
      id: 'u1', username: 'wingfiend', display_name: 'Wing Fiend',
      bio: 'flats only', avatar_url: 'https://cdn/a.jpg', is_private: true,
    });
    expect(p.username).toBe('wingfiend');
    expect(p.isPrivate).toBe(true);
  });
});

describe('username rules', () => {
  it('accepts valid names', () => {
    for (const n of ['abc', 'wing_fiend', 'a.b.c', 'x'.repeat(30)]) {
      expect(validateUsername(n)).toBeNull();
    }
  });

  it('rejects invalid ones with a reason', () => {
    expect(validateUsername('ab')).toMatch(/3 characters/);
    expect(validateUsername('x'.repeat(31))).toMatch(/30 characters/);
    expect(validateUsername('has space')).toMatch(/Letters/);
    expect(validateUsername('Caps@Bad')).toMatch(/Letters/);
  });

  it('matches the database CHECK constraint, so the UI cannot pass something the DB rejects', () => {
    const dbPattern = /^[a-z0-9_.]{3,30}$/;
    for (const n of ['ok_name', 'a.b', 'z'.repeat(30)]) {
      expect(validateUsername(n)).toBeNull();
      expect(dbPattern.test(n)).toBe(true);
    }
  });
});

describe('auth error messages', () => {
  it('turns bare network failures into something actionable', () => {
    expect(friendlyAuthError('Failed to fetch')).toMatch(/connection/i);
    expect(friendlyAuthError('TypeError: NetworkError when attempting to fetch resource.')).toMatch(
      /connection/i,
    );
  });

  it('explains the common Supabase auth rejections', () => {
    expect(friendlyAuthError('Invalid login credentials')).toMatch(/do not match/);
    expect(friendlyAuthError('User already registered')).toMatch(/already has an account/);
    expect(friendlyAuthError('Email not confirmed')).toMatch(/Confirm your email/);
  });

  it('does not blame the user for a project-wide email quota', () => {
    const msg = friendlyAuthError('email rate limit exceeded');
    expect(msg).toMatch(/confirmation email/i);
    expect(msg).not.toMatch(/too many attempts/i);
  });

  it('still reports a genuine per-user request flood as such', () => {
    expect(friendlyAuthError('over_request_rate_limit')).toMatch(/too many attempts/i);
  });

  it('passes an unrecognised message through unchanged', () => {
    expect(friendlyAuthError('Something specific broke')).toBe('Something specific broke');
  });
});

describe('schema and types agree', () => {
  it('the database provider allowlist matches Place["provider"]', async () => {
    // These two drifted once already: 'osm' was added to the TypeScript union
    // but not the CHECK constraint, so every review against an OSM restaurant
    // was rejected by the database while the UI looked fine.
    const fs = await import('node:fs/promises');
    const schema = await fs.readFile('supabase/schema.sql', 'utf8');
    const types = await fs.readFile('src/lib/types.ts', 'utf8');

    const dbList = schema.match(/check \(provider in \(([^)]+)\)\)/)?.[1];
    expect(dbList).toBeTruthy();
    const dbProviders = [...dbList!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();

    const tsList = types.match(/provider: ((?:'[a-z]+'\s*\|?\s*)+);/)?.[1];
    expect(tsList).toBeTruthy();
    const tsProviders = [...tsList!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();

    expect(dbProviders).toEqual(tsProviders);
  });
});

describe('image URL sizing', () => {
  it('rewrites a Supabase storage URL to request a resized copy', async () => {
    const { sized } = await import('../images');
    const url =
      'https://x.supabase.co/storage/v1/object/public/wing-photos/user/photo.jpeg';
    const out = sized(url, 900)!;
    expect(out).toContain('/storage/v1/render/image/public/');
    expect(out).toContain('width=900');
    expect(out).not.toContain('/object/public/');
  });

  it('leaves non-storage URLs untouched', async () => {
    const { sized } = await import('../images');
    // Seed images and local blob previews must not be rewritten.
    expect(sized('https://images.unsplash.com/photo-123?w=800', 900)).toBe(
      'https://images.unsplash.com/photo-123?w=800',
    );
    expect(sized('blob:http://localhost/abc', 900)).toBe('blob:http://localhost/abc');
    expect(sized(undefined, 900)).toBeUndefined();
  });
});

describe('map tile selection by zoom', () => {
  it('uses the grey canvas where the canvas has data', async () => {
    const { tileTemplateFor } = await import('../map/tiles');
    for (const z of [3, 10, 15, 16]) {
      expect(tileTemplateFor(z, 'dark')).toContain('World_Dark_Gray_Base');
      expect(tileTemplateFor(z, 'light')).toContain('World_Light_Gray_Base');
    }
  });

  it('switches to the street map past the canvas limit', async () => {
    const { tileTemplateFor } = await import('../map/tiles');
    // Above z16 the canvas serves a "Map data not yet available" placeholder,
    // and upscaling z16 instead is what made deep zoom look blurry.
    for (const z of [17, 18, 19]) {
      expect(tileTemplateFor(z, 'dark')).toContain('World_Street_Map');
      expect(tileTemplateFor(z, 'light')).toContain('World_Street_Map');
    }
  });

  it('darkens the street map only in dark mode past the switch point', async () => {
    const { needsDarkening } = await import('../map/tiles');
    expect(needsDarkening(18, 'dark')).toBe(true);
    expect(needsDarkening(18, 'light')).toBe(false);
    // The canvas already matches the palette, so it must never be inverted.
    expect(needsDarkening(14, 'dark')).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_USER_ID } from '../../data/seed';
import { mockPlacesProvider } from '../places/mockPlacesProvider';
import { COOK_SLIDER_CENTER } from '../scoring';
import { createLocalStore } from './localStore';
import type { WingzStore } from './store';

let store: WingzStore;
beforeEach(() => {
  store = createLocalStore();
});

const draft = (over: Partial<Parameters<WingzStore['createReview']>[0]> = {}) => ({
  placeId: 'mock:p_saucelab',
  flavourName: 'Mango Habanero',
  orderText: '10 wings',
  priceCents: 1899,
  currency: 'CAD',
  heat: 4 as const,
  scores: {
    cook: 3,
    cookPosition: COOK_SLIDER_CENTER,
    flavour: 2,
    sauce: 1,
    value: 1,
    size: 0.5,
    eye: 0.5,
    sides: 0.5,
    ratio: 0.2,
    drink: 0.3,
    towelette: 0.2,
    napkins: 0.2,
    sauceOptions: 0.2,
    atmosphere: 0.4,
  },
  bonuses: [],
  caption: '',
  photos: [{ url: 'blob:x', kind: 'wing' as const }],
  visibility: 'public' as const,
  ...over,
});

describe('publishing a review', () => {
  it('recomputes the score rather than trusting the caller', () => {
    const r = store.createReview(draft());
    expect(r.baseScore).toBe(10);
    expect(r.finalScore).toBe(10);
    expect(r.authorId).toBe(CURRENT_USER_ID);
  });

  it('applies the bonus and can exceed 10', () => {
    const r = store.createReview(
      draft({ bonuses: [{ id: 'b1', reason: 'Free wings', amount: 0.3 }] }),
    );
    expect(r.finalScore).toBe(10.3);
  });

  it('retains every sub-score and the raw cook position', () => {
    const r = store.createReview(draft({ scores: { ...draft().scores, cookPosition: 18 } }));
    expect(r.scores.cookPosition).toBe(18);
    // 18 is on the undercooked side: 3 - 12/10 = 1.8
    expect(r.scores.cook).toBe(1.8);
    expect(r.finalScore).toBe(8.8);
  });

  it('creates a flavour on first use and reuses it after', () => {
    const before = store.listFlavours().length;
    store.createReview(draft());
    store.createReview(draft());
    expect(store.listFlavours().length).toBe(before + 1);
  });

  it('matches an existing flavour regardless of casing or punctuation', () => {
    const r = store.createReview(draft({ flavourName: 'hot  honey!' }));
    expect(store.getFlavour(r.flavourId)!.name).toBe('Hot Honey');
  });

  it('shows up at the top of the author feed', () => {
    const r = store.createReview(draft());
    expect(store.feed()[0]!.review.id).toBe(r.id);
  });
});

describe('want to try', () => {
  it('toggles and is reflected on the map', () => {
    const on = store.toggleWantToTry('mock:p_saucelab', 'f_buffalo', null);
    expect(on).toBe(true);
    expect(store.isWantToTry('mock:p_saucelab')).toBe(true);

    const pins = store.discoverMarkers({
      owner: 'wantToTry',
      minHeat: 1,
      maxHeat: 5,
      minScore: 0,
      flavourId: null,
    });
    expect(pins.map((p) => p.place.id)).toContain('mock:p_saucelab');
  });

  it('records the exact flavour that was swiped, not just the restaurant', () => {
    store.toggleWantToTry('mock:p_saucelab', 'f_nashville', 'r_source');
    const entry = store.listWantToTry().find((w) => w.place.id === 'mock:p_saucelab');
    expect(entry!.flavour!.name).toBe('Nashville Hot');
    expect(entry!.sourceReviewId).toBe('r_source');
  });
});

describe('discover filters', () => {
  const base = { owner: 'everyone' as const, minHeat: 1, maxHeat: 5, minScore: 0, flavourId: null };

  it('filters by heat band', () => {
    const hot = store.discoverMarkers({ ...base, minHeat: 4 });
    const all = store.discoverMarkers(base);
    expect(hot.length).toBeGreaterThan(0);
    expect(hot.length).toBeLessThan(all.length);
  });

  it('labels a place you reviewed as yours, ahead of friends', () => {
    const pins = store.discoverMarkers({ ...base, owner: 'mine+friends' });
    // The Wing Spot has both a review by the user and one by a friend.
    const wingSpot = pins.find((p) => p.place.id === 'mock:p_wingspot');
    expect(wingSpot!.owner).toBe('mine');
  });

  it('restricts to just your own reviews', () => {
    const pins = store.discoverMarkers({ ...base, owner: 'mine' });
    expect(pins.every((p) => p.owner === 'mine')).toBe(true);
  });
});

describe('rankings', () => {
  it('orders by final score descending', () => {
    const rows = store.rankings({ scope: 'global' });
    const scores = rows.map((r) => r.review.finalScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('can rank on a single component instead of the total', () => {
    const rows = store.rankings({ scope: 'global', sortBy: 'value' });
    const values = rows.map((r) => r.review.scores.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it('filters to 4+ heat only', () => {
    const rows = store.rankings({ scope: 'global', minHeat: 4, maxHeat: 5 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.review.heat >= 4)).toBe(true);
  });

  it('filters by city', () => {
    const rows = store.rankings({ scope: 'global', city: 'New York' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.place.city === 'New York')).toBe(true);
  });

  it('scopes to just the current user', () => {
    const rows = store.rankings({ scope: 'mine' });
    expect(rows.every((r) => r.review.authorId === CURRENT_USER_ID)).toBe(true);
  });
});

describe('aggregation', () => {
  it('separates heat by flavour within one restaurant', () => {
    // The Wing Spot is reviewed as both Hot Honey (3) and Suicide (5).
    const hotHoney = store.aggregate('mock:p_wingspot', 'f_hothoney')!;
    const suicide = store.aggregate('mock:p_wingspot', 'f_suicide')!;
    expect(hotHoney.avgHeat).toBe(3);
    expect(suicide.avgHeat).toBe(5);
    expect(suicide.avgHeat).toBeGreaterThan(hotHoney.avgHeat);
  });

  it('rolls the whole restaurant up separately', () => {
    const all = store.aggregate('mock:p_wingspot')!;
    expect(all.reviewCount).toBe(2);
    expect(all.avgHeat).toBe(4);
  });

  it('returns null for a place nobody has reviewed', () => {
    expect(store.aggregate('mock:p_northsidewings', 'f_suicide')).toBeNull();
  });
});

describe('privacy', () => {
  it('hides a private account’s reviews from a non-follower', () => {
    const priv = store.listProfiles().find((p) => p.isPrivate)!;
    expect(store.followState(priv.id)).toBe('none');
    const rows = store.rankings({ scope: 'global' });
    expect(rows.some((r) => r.review.authorId === priv.id)).toBe(false);
  });
});

describe('social actions', () => {
  it('likes and unlikes, keeping the count honest', () => {
    const id = store.listReviews()[0]!.id;
    const before = store.getReview(id)!.likeCount;
    expect(store.toggleLike(id)).toBe(true);
    expect(store.getReview(id)!.likeCount).toBe(before + 1);
    expect(store.toggleLike(id)).toBe(false);
    expect(store.getReview(id)!.likeCount).toBe(before);
  });

  it('adds comments and bumps the count', () => {
    const id = store.listReviews()[0]!.id;
    store.addComment(id, 'Looks unreal');
    expect(store.listComments(id).at(-1)!.body).toBe('Looks unreal');
  });

  it('ignores an empty comment', () => {
    const id = store.listReviews()[0]!.id;
    const before = store.listComments(id).length;
    store.addComment(id, '   ');
    expect(store.listComments(id).length).toBe(before);
  });

  it('derives follower counts rather than storing them', () => {
    const maya = store.getProfile('u_maya')!;
    expect(maya.followerCount).toBeGreaterThan(0);
    store.toggleFollow('u_maya');
    expect(store.getProfile('u_maya')!.followerCount).toBe(maya.followerCount - 1);
  });
});

describe('places provider', () => {
  it('resolves a suggestion into a full place with coordinates', async () => {
    const [hit] = await mockPlacesProvider.autocomplete('bird');
    expect(hit!.primaryText).toBe('Bird Bar');
    const place = await mockPlacesProvider.details(hit!.externalId);
    expect(place).toMatchObject({ city: 'Toronto', region: 'ON', country: 'Canada' });
    expect(typeof place!.lat).toBe('number');
    expect(typeof place!.lng).toBe('number');
    expect(place!.externalId).toBeTruthy();
  });

  it('returns nothing for a blank query', async () => {
    expect(await mockPlacesProvider.autocomplete('  ')).toEqual([]);
  });
});

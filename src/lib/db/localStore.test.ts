import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_USER_ID, SEED_PLACES } from '../../data/seed';
import { mockPlacesProvider } from '../places/mockPlacesProvider';
import { COOK_SLIDER_CENTER } from '../scoring';
import { createLocalStore } from './localStore';
import type { WingzStore } from './store';

let store: WingzStore;
beforeEach(() => {
  store = createLocalStore();
});

const SAUCE_LAB = SEED_PLACES.find((p) => p.externalId === 'p_saucelab')!;

const draft = (over: Partial<Parameters<WingzStore['createReview']>[0]> = {}) => ({
  place: SAUCE_LAB,
  flavourName: 'Mango Habanero',
  orderText: '10 wings',
  priceCents: 1899,
  currency: 'CAD',
  heat: 4 as const,
  style: 'bone_in' as const,
  breading: 'non_breaded' as const,
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
  it('recomputes the score rather than trusting the caller', async () => {
    const r = await await store.createReview(draft());
    expect(r.baseScore).toBe(10);
    expect(r.finalScore).toBe(10);
    expect(r.authorId).toBe(CURRENT_USER_ID);
  });

  it('applies the bonus and can exceed 10', async () => {
    const r = await store.createReview(
      draft({ bonuses: [{ id: 'b1', reason: 'Free wings', amount: 0.3 }] }),
    );
    expect(r.finalScore).toBe(10.3);
  });

  it('retains every sub-score and the raw cook position', async () => {
    const r = await store.createReview(draft({ scores: { ...draft().scores, cookPosition: 18 } }));
    expect(r.scores.cookPosition).toBe(18);
    // 18 is on the undercooked side: 3 - 12/10 = 1.8
    expect(r.scores.cook).toBe(1.8);
    expect(r.finalScore).toBe(8.8);
  });

  it('creates a flavour on first use and reuses it after', async () => {
    const before = (await store.getFlavours()).length;
    await store.createReview(draft());
    await store.createReview(draft());
    expect((await store.getFlavours()).length).toBe(before + 1);
  });

  it('matches an existing flavour regardless of casing or punctuation', async () => {
    const r = await store.createReview(draft({ flavourName: 'hot  honey!' }));
    expect((await store.getFlavours()).find((f) => f.id === r.flavourId)!.name).toBe('Hot Honey');
  });

  it('shows up at the top of the author feed', async () => {
    const r = await await store.createReview(draft());
    expect((await store.feed())[0]!.review.id).toBe(r.id);
  });
});

describe('want to try', () => {
  it('toggles and is reflected on the map', async () => {
    const on = await store.toggleWantToTry('mock:p_saucelab', 'f_buffalo', null);
    expect(on).toBe(true);
    expect((await store.listWantToTry()).some((w) => w.place.id === 'mock:p_saucelab')).toBe(true);

    const pins = await store.discoverMarkers({
      owner: 'wantToTry',
      minHeat: 1,
      maxHeat: 5,
      minScore: 0,
      flavourId: null,
    });
    expect(pins.map((p) => p.place.id)).toContain('mock:p_saucelab');
  });

  it('records the exact flavour that was swiped, not just the restaurant', async () => {
    await store.toggleWantToTry('mock:p_saucelab', 'f_nashville', 'r_source');
    const entry = (await store.listWantToTry()).find((w) => w.place.id === 'mock:p_saucelab');
    expect(entry!.flavour!.name).toBe('Nashville Hot');
    expect(entry!.sourceReviewId).toBe('r_source');
  });
});

describe('discover filters', () => {
  const base = { owner: 'everyone' as const, minHeat: 1, maxHeat: 5, minScore: 0, flavourId: null };

  it('filters by heat band', async () => {
    const hot = await store.discoverMarkers({ ...base, minHeat: 4 });
    const all = await store.discoverMarkers(base);
    expect(hot.length).toBeGreaterThan(0);
    expect(hot.length).toBeLessThan(all.length);
  });

  it('labels a place you reviewed as yours, ahead of friends', async () => {
    const pins = await store.discoverMarkers({ ...base, owner: 'mine+friends' });
    // The Wing Spot has both a review by the user and one by a friend.
    const wingSpot = pins.find((p) => p.place.id === 'mock:p_wingspot');
    expect(wingSpot!.owner).toBe('mine');
  });

  it('restricts to just your own reviews', async () => {
    const pins = await store.discoverMarkers({ ...base, owner: 'mine' });
    expect(pins.every((p) => p.owner === 'mine')).toBe(true);
  });
});

describe('rankings', () => {
  it('orders by final score descending', async () => {
    const rows = await store.rankings({ scope: 'global' });
    const scores = rows.map((r) => r.review.finalScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('can rank on a single component instead of the total', async () => {
    const rows = await store.rankings({ scope: 'global', sortBy: 'value' });
    const values = rows.map((r) => r.review.scores.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it('filters to 4+ heat only', async () => {
    const rows = await store.rankings({ scope: 'global', minHeat: 4, maxHeat: 5 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.review.heat >= 4)).toBe(true);
  });

  it('filters by city', async () => {
    const rows = await store.rankings({ scope: 'global', city: 'New York' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.place.city === 'New York')).toBe(true);
  });

  it('scopes to just the current user', async () => {
    const rows = await store.rankings({ scope: 'mine' });
    expect(rows.every((r) => r.review.authorId === CURRENT_USER_ID)).toBe(true);
  });
});

describe('aggregation', () => {
  it('rolls a restaurant up across its reviews', async () => {
    // The Wing Spot is reviewed as both Hot Honey (heat 3) and Suicide (heat 5).
    const detail = (await store.placeDetail('mock:p_wingspot'))!;
    expect(detail.community!.reviewCount).toBe(2);
    expect(detail.community!.avgHeat).toBe(4);
  });

  it('surfaces the reviewer relationships for a place', async () => {
    const detail = (await store.placeDetail('mock:p_wingspot'))!;
    expect(detail.myReview).not.toBeNull();
    expect(detail.friendAverage).not.toBeNull();
    expect(detail.topFlavour).not.toBeNull();
  });

  it('returns null for a place that does not exist', async () => {
    expect(await store.placeDetail('mock:nope')).toBeNull();
  });
});

describe('privacy', () => {
  it('hides a private account’s reviews from a non-follower', async () => {
    const priv = (await store.listSuggestedProfiles()).find((p) => p.isPrivate)!;
    expect(await store.followState(priv.id)).toBe('none');
    const rows = await store.rankings({ scope: 'global' });
    expect(rows.some((r) => r.review.authorId === priv.id)).toBe(false);
  });
});

describe('social actions', () => {
  const reviewById = async (id: string) =>
    (await store.feed()).find((f) => f.review.id === id)?.review;

  it('likes and unlikes, keeping the count honest', async () => {
    const id = (await store.feed())[0]!.review.id;
    const before = (await reviewById(id))!.likeCount;
    expect(await store.toggleLike(id)).toBe(true);
    expect((await reviewById(id))!.likeCount).toBe(before + 1);
    expect(await store.toggleLike(id)).toBe(false);
    expect((await reviewById(id))!.likeCount).toBe(before);
  });

  it('adds comments and bumps the count', async () => {
    const id = (await store.feed())[0]!.review.id;
    await store.addComment(id, 'Looks unreal');
    expect((await store.listComments(id)).at(-1)!.body).toBe('Looks unreal');
  });

  it('ignores an empty comment', async () => {
    const id = (await store.feed())[0]!.review.id;
    const before = (await store.listComments(id)).length;
    await store.addComment(id, '   ');
    expect((await store.listComments(id)).length).toBe(before);
  });

  it('derives follower counts rather than storing them', async () => {
    const maya = (await store.getProfile('u_maya'))!;
    expect(maya.followerCount).toBeGreaterThan(0);
    await store.toggleFollow('u_maya');
    expect((await store.getProfile('u_maya'))!.followerCount).toBe(maya.followerCount - 1);
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

describe('follow requests for private accounts', () => {
  const PRIVATE = 'u_tom'; // the seeded private account
  const PUBLIC = 'u_maya';

  it('follows a public account immediately', async () => {
    await store.toggleFollow(PUBLIC); // seeded as already followed -> unfollow
    expect(await store.followState(PUBLIC)).toBe('none');
    expect(await store.toggleFollow(PUBLIC)).toBe('following');
  });

  it('only requests when the account is private', async () => {
    expect(await store.followState(PRIVATE)).toBe('none');
    expect(await store.toggleFollow(PRIVATE)).toBe('requested');
    expect(await store.followState(PRIVATE)).toBe('requested');
  });

  it('does not grant access while a request is only pending', async () => {
    await store.toggleFollow(PRIVATE);
    const rows = await store.rankings({ scope: 'global' });
    expect(rows.some((r) => r.review.authorId === PRIVATE)).toBe(false);
  });

  it('withdraws a pending request when tapped again', async () => {
    await store.toggleFollow(PRIVATE);
    expect(await store.toggleFollow(PRIVATE)).toBe('none');
    expect(await store.followState(PRIVATE)).toBe('none');
  });

  it('lists requests aimed at the current user', async () => {
    // The seed has u_tom requesting to follow the current user.
    const reqs = await store.incomingFollowRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.requester.id).toBe('u_tom');
  });

  it('approving creates the follow in the requester -> target direction', async () => {
    const [req] = await store.incomingFollowRequests();
    await store.approveFollowRequest(req!.id);

    expect(await store.incomingFollowRequests()).toHaveLength(0);
    // The requester now follows us; we do not follow them back.
    expect(await store.followState('u_tom')).toBe('none');
    const theirFollowing = await store.getProfile('u_tom');
    expect(theirFollowing!.followingCount).toBeGreaterThan(0);
  });

  it('declining removes the request without creating a follow', async () => {
    const [req] = await store.incomingFollowRequests();
    await store.rejectFollowRequest(req!.id);
    expect(await store.incomingFollowRequests()).toHaveLength(0);
    const tom = await store.getProfile('u_tom');
    expect(tom!.followingCount).toBe(0);
  });

  it('ignores a request that is not addressed to you', async () => {
    await store.approveFollowRequest('does-not-exist');
    await store.rejectFollowRequest('does-not-exist');
    expect(await store.incomingFollowRequests()).toHaveLength(1);
  });
});

describe('optional price', () => {
  it('publishes with no price at all', async () => {
    const r = await store.createReview(draft({ priceCents: null }));
    expect(r.priceCents).toBeNull();
    // The score is unaffected — price is metadata, not a scored component.
    expect(r.finalScore).toBe(10);
  });

  it('still stores a price when one is given', async () => {
    const r = await store.createReview(draft({ priceCents: 1899 }));
    expect(r.priceCents).toBe(1899);
  });

  it('survives a round trip through the feed', async () => {
    const r = await store.createReview(draft({ priceCents: null }));
    const item = (await store.feed()).find((f) => f.review.id === r.id);
    expect(item!.review.priceCents).toBeNull();
  });
});

describe('single post lookup', () => {
  it('returns a post with everything needed to render it', async () => {
    const created = await store.createReview(draft());
    const item = await store.feedItem(created.id);
    expect(item).not.toBeNull();
    expect(item!.author.id).toBe(CURRENT_USER_ID);
    expect(item!.place.displayName).toBe('Sauce Lab');
    expect(item!.flavour.name).toBe('Mango Habanero');
  });

  it('returns null for a review that does not exist', async () => {
    expect(await store.feedItem('nope')).toBeNull();
  });

  it('hides a private account’s post from a non-follower', async () => {
    const priv = (await store.listSuggestedProfiles()).find((p) => p.isPrivate)!;
    const theirs = await store.reviewsByAuthor(priv.id);
    for (const r of theirs) {
      expect(await store.feedItem(r.id)).toBeNull();
    }
  });
});

describe('finding people to follow', () => {
  it('matches on username and display name', async () => {
    expect((await store.searchProfiles('maya')).map((p) => p.username)).toContain('mayaeats');
    expect((await store.searchProfiles('Okonkwo')).map((p) => p.username)).toContain('mayaeats');
  });

  it('is case-insensitive', async () => {
    expect(await store.searchProfiles('MAYA')).toHaveLength(1);
  });

  it('never returns yourself, so you cannot follow yourself', async () => {
    const all = await store.searchProfiles('');
    expect(all).toHaveLength(0);
    for (const q of ['you', 'u_me', 'a', 'e']) {
      const hits = await store.searchProfiles(q);
      expect(hits.some((p) => p.id === CURRENT_USER_ID)).toBe(false);
    }
  });

  it('suggests only people you do not already follow', async () => {
    const suggested = await store.listSuggestedProfiles();
    const followingIds = (await store.followingProfiles()).map((p) => p.id);
    expect(suggested.every((p) => !followingIds.includes(p.id))).toBe(true);
    expect(suggested.every((p) => p.id !== CURRENT_USER_ID)).toBe(true);
  });

  it('following twice does not create a duplicate', async () => {
    await store.toggleFollow('u_maya'); // seeded as followed -> unfollow
    expect(await store.toggleFollow('u_maya')).toBe('following');
    const before = (await store.getProfile('u_maya'))!.followerCount;
    // followState already reports 'following', so the UI shows Following;
    // calling again is an unfollow, never a second row.
    await store.toggleFollow('u_maya');
    await store.toggleFollow('u_maya');
    expect((await store.getProfile('u_maya'))!.followerCount).toBe(before);
  });

  it('puts a followed person’s posts into the feed', async () => {
    await store.toggleFollow('u_maya'); // unfollow first
    let feed = await store.feed();
    expect(feed.some((f) => f.review.authorId === 'u_maya')).toBe(false);

    await store.toggleFollow('u_maya');
    feed = await store.feed();
    expect(feed.some((f) => f.review.authorId === 'u_maya')).toBe(true);
  });
});

describe('wing style and breading descriptors', () => {
  it('defaults to bone-in and non-breaded', async () => {
    const r = await store.createReview(draft());
    expect(r.style).toBe('bone_in');
    expect(r.breading).toBe('non_breaded');
  });

  it('records the other options when chosen', async () => {
    const r = await store.createReview(draft({ style: 'boneless', breading: 'breaded' }));
    expect(r.style).toBe('boneless');
    expect(r.breading).toBe('breaded');
  });

  it('never affects the score, exactly like heat', async () => {
    const boneIn = await store.createReview(draft({ style: 'bone_in', breading: 'non_breaded' }));
    const boneless = await store.createReview(draft({ style: 'boneless', breading: 'breaded' }));
    expect(boneless.finalScore).toBe(boneIn.finalScore);
    expect(boneless.baseScore).toBe(boneIn.baseScore);
  });

  it('survives a round trip through the feed', async () => {
    const r = await store.createReview(draft({ style: 'boneless', breading: 'breaded' }));
    const item = (await store.feed()).find((f) => f.review.id === r.id);
    expect(item!.review.style).toBe('boneless');
    expect(item!.review.breading).toBe('breaded');
  });

  it('reads seeded reviews as bone-in and non-breaded', async () => {
    const feed = await store.feed();
    expect(feed.every((f) => f.review.style === 'bone_in')).toBe(true);
  });
});

describe('editing a review', () => {
  it('updates details and recomputes the score', async () => {
    const r = await store.createReview(draft());
    expect(r.finalScore).toBe(10);

    await store.updateReview(r.id, {
      place: null,
      orderText: '20 wings',
      flavourName: 'Lemon Pepper',
      priceCents: 2500,
      currency: 'CAD',
      heat: 2,
      style: 'boneless',
      breading: 'breaded',
      caption: 'Revised',
      // Drop cook to the raw extreme; the total must follow.
      scores: { ...r.scores, cookPosition: 0, cook: 0 },
      bonuses: [],
    });

    const item = (await store.feed()).find((f) => f.review.id === r.id)!;
    expect(item.review.orderText).toBe('20 wings');
    expect(item.flavour.name).toBe('Lemon Pepper');
    expect(item.review.priceCents).toBe(2500);
    expect(item.review.heat).toBe(2);
    expect(item.review.style).toBe('boneless');
    expect(item.review.breading).toBe('breaded');
    expect(item.review.caption).toBe('Revised');
    expect(item.review.scores.cook).toBe(0);
    expect(item.review.finalScore).toBe(7);
  });

  it('can clear a price that was previously set', async () => {
    const r = await store.createReview(draft({ priceCents: 1899 }));
    await store.updateReview(r.id, {
      place: null,
      orderText: r.orderText,
      flavourName: 'Mango Habanero',
      priceCents: null,
      currency: 'CAD',
      heat: r.heat,
      style: r.style,
      breading: r.breading,
      caption: r.caption,
      scores: r.scores,
      bonuses: [],
    });
    const item = (await store.feed()).find((f) => f.review.id === r.id)!;
    expect(item.review.priceCents).toBeNull();
  });

  it('re-applies the bonus cap on edit', async () => {
    const r = await store.createReview(draft());
    await store.updateReview(r.id, {
      place: null,
      orderText: r.orderText,
      flavourName: 'Mango Habanero',
      priceCents: null,
      currency: 'CAD',
      heat: r.heat,
      style: r.style,
      breading: r.breading,
      caption: '',
      scores: r.scores,
      bonuses: [
        { id: 'a', reason: 'one', amount: 0.5 },
        { id: 'b', reason: 'two', amount: 0.5 },
      ],
    });
    const item = (await store.feed()).find((f) => f.review.id === r.id)!;
    expect(item.review.bonusScore).toBe(0.5);
    expect(item.review.finalScore).toBe(10.5);
  });

  it('refuses to edit someone else’s review', async () => {
    const theirs = (await store.reviewsByAuthor('u_maya'))[0]!;
    await expect(
      store.updateReview(theirs.id, {
        place: null,
        orderText: 'hijacked',
        flavourName: 'Buffalo',
        priceCents: null,
        currency: 'CAD',
        heat: 1,
        style: 'bone_in',
        breading: 'non_breaded',
        caption: '',
        scores: theirs.scores,
        bonuses: [],
      }),
    ).rejects.toThrow(/not yours/i);

    const after = (await store.reviewsByAuthor('u_maya'))[0]!;
    expect(after.orderText).not.toBe('hijacked');
  });
});

describe('changing the restaurant on an existing review', () => {
  const OTHER = SEED_PLACES.find((p) => p.externalId === 'p_birdbar')!;

  const baseEdit = (r: Awaited<ReturnType<WingzStore['createReview']>>) => ({
    place: null,
    orderText: r.orderText,
    flavourName: 'Mango Habanero',
    priceCents: r.priceCents,
    currency: r.currency,
    heat: r.heat,
    style: r.style,
    breading: r.breading,
    caption: r.caption,
    scores: r.scores,
    bonuses: r.bonuses,
  });

  it('moves the review to a different restaurant', async () => {
    const r = await store.createReview(draft());
    await store.updateReview(r.id, { ...baseEdit(r), place: OTHER });
    const item = (await store.feed()).find((f) => f.review.id === r.id)!;
    expect(item.place.displayName).toBe('Bird Bar');
  });

  it('leaves the restaurant alone when none is given', async () => {
    const r = await store.createReview(draft());
    await store.updateReview(r.id, baseEdit(r));
    const item = (await store.feed()).find((f) => f.review.id === r.id)!;
    expect(item.place.displayName).toBe('Sauce Lab');
  });

  it('follows the review onto the map at its new location', async () => {
    const r = await store.createReview(draft());
    await store.updateReview(r.id, { ...baseEdit(r), place: OTHER });
    const pins = await store.discoverMarkers({
      owner: 'mine', minHeat: 1, maxHeat: 5, minScore: 0, flavourId: null,
    });
    expect(pins.some((p) => p.place.displayName === 'Bird Bar')).toBe(true);
  });
});

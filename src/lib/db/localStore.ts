import {
  CURRENT_USER_ID,
  SEED_FLAVOURS,
  SEED_PHOTOS,
  SEED_PLACES,
  SEED_PROFILES,
} from '../../data/seed';
import { normalizeName } from '../places/provider';
import { calculateScore, round1, type BonusEntry } from '../scoring';
import type {
  Aggregate,
  Comment,
  FeedItem,
  Follow,
  FollowState,
  ID,
  Place,
  Profile,
  Review,
  WantToTryEntry,
  WingFlavour,
} from '../types';
import type { WingzStore } from './store';

const KEY = 'wingz:db:v1';

interface DbShape {
  profiles: Profile[];
  places: Place[];
  flavours: WingFlavour[];
  reviews: Review[];
  follows: Follow[];
  comments: Comment[];
  likes: { userId: ID; reviewId: ID }[];
  saves: { userId: ID; reviewId: ID }[];
  wantToTry: WantToTryEntry[];
}

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/* ------------------------------------------------------------ seed reviews */

interface SeedSpec {
  author: ID;
  place: string;
  flavour: string;
  order: string;
  price: number;
  heat: 1 | 2 | 3 | 4 | 5;
  cookPosition: number;
  photo: number;
  caption: string;
  days: number;
  bonuses?: [string, number][];
  tweak?: Partial<Record<'flavour' | 'sauce' | 'value' | 'size' | 'eye' | 'sides' | 'ratio' | 'drink' | 'sauceOptions' | 'atmosphere', number>>;
  towelette?: boolean;
  napkins?: boolean;
}

const SEED_REVIEWS: SeedSpec[] = [
  { author: 'u_me', place: 'p_wingspot', flavour: 'Hot Honey', order: '20-wing combo', price: 2799, heat: 3, cookPosition: 30, photo: 0, caption: 'The bar. Crispy without being dry, and the honey actually tastes like honey.', days: 2, bonuses: [['House ranch is homemade', 0.2]], tweak: { flavour: 1.9, sauce: 0.9, value: 0.8, size: 0.5, eye: 0.5, sides: 0.4, ratio: 0.2, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.3 }, towelette: true, napkins: true },
  { author: 'u_maya', place: 'p_birdbar', flavour: 'Nashville Hot', order: '10 wings + fries', price: 1900, heat: 4, cookPosition: 32, photo: 1, caption: 'Genuinely painful in the best way. Bring milk.', days: 3, tweak: { flavour: 1.8, sauce: 0.8, value: 0.8, size: 0.4, eye: 0.5, sides: 0.4, ratio: 0.1, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.4 }, towelette: true, napkins: true },
  { author: 'u_deshawn', place: 'p_cluck', flavour: 'Lemon Pepper', order: '15 wings, extra dry', price: 2250, heat: 1, cookPosition: 27, photo: 2, caption: 'Dry rub done properly. Not a sauce person, fight me.', days: 5, tweak: { flavour: 1.6, sauce: 0.6, value: 0.7, size: 0.4, eye: 0.4, sides: 0.3, ratio: 0.2, drink: 0.2, sauceOptions: 0.1, atmosphere: 0.3 }, napkins: true },
  { author: 'u_priya', place: 'p_hotcoop', flavour: 'Suicide', order: 'Suicide 10-piece challenge', price: 2400, heat: 5, cookPosition: 30, photo: 3, caption: 'Five peppers is generous. I could not feel my face for an hour. 10/10 would suffer again.', days: 1, bonuses: [['Free t-shirt for finishing', 0.2], ['Great wing special Tuesdays', 0.1]], tweak: { flavour: 1.9, sauce: 0.9, value: 0.9, size: 0.5, eye: 0.5, sides: 0.4, ratio: 0.2, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.4 }, towelette: true, napkins: true },
  { author: 'u_maya', place: 'p_saucelab', flavour: 'Korean Soy Garlic', order: 'Boneless combo', price: 2100, heat: 2, cookPosition: 35, photo: 4, caption: 'Sticky, garlicky, slightly over-fried. Still very good.', days: 6, tweak: { flavour: 1.7, sauce: 0.9, value: 0.7, size: 0.3, eye: 0.4, sides: 0.3, ratio: 0.1, drink: 0.2, sauceOptions: 0.2, atmosphere: 0.3 }, napkins: true },
  { author: 'u_me', place: 'p_drumflat', flavour: 'Buffalo', order: '10 wings, all flats', price: 1650, heat: 2, cookPosition: 30, photo: 5, caption: 'Classic buffalo, no notes. All-flats option is worth the upcharge.', days: 9, bonuses: [['All-flats option exists', 0.2]], tweak: { flavour: 1.7, sauce: 0.9, value: 0.9, size: 0.4, eye: 0.4, sides: 0.3, ratio: 0.2, drink: 0.2, sauceOptions: 0.2, atmosphere: 0.2 }, towelette: true, napkins: true },
  { author: 'u_deshawn', place: 'p_smokehouse', flavour: 'Smoky BBQ', order: 'Wing platter for two', price: 3600, heat: 2, cookPosition: 24, photo: 6, caption: 'Smoked then fried. Slightly undercooked on two of them but the flavour is unreal.', days: 11, tweak: { flavour: 1.9, sauce: 0.8, value: 0.6, size: 0.5, eye: 0.5, sides: 0.5, ratio: 0.1, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.4 }, towelette: true, napkins: true },
  { author: 'u_priya', place: 'p_wingspot', flavour: 'Suicide', order: '10 wings suicide', price: 2200, heat: 5, cookPosition: 30, photo: 7, caption: 'Same shop, completely different heat league to their hot honey.', days: 4, tweak: { flavour: 1.8, sauce: 0.9, value: 0.8, size: 0.4, eye: 0.4, sides: 0.4, ratio: 0.2, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.3 }, towelette: true, napkins: true },
  { author: 'u_maya', place: 'p_northsidewings', flavour: 'Honey Garlic', order: '20 wings mixed', price: 2500, heat: 1, cookPosition: 38, photo: 0, caption: 'Overcooked. Sauce carried it.', days: 14, tweak: { flavour: 1.4, sauce: 0.7, value: 0.6, size: 0.3, eye: 0.3, sides: 0.2, ratio: 0.1, drink: 0.2, sauceOptions: 0.1, atmosphere: 0.2 }, napkins: true },
  { author: 'u_deshawn', place: 'p_brooklynbones', flavour: 'Buffalo', order: '12 wings + celery', price: 2100, heat: 3, cookPosition: 30, photo: 1, caption: 'New York buffalo standard. Toronto has some catching up to do.', days: 20, tweak: { flavour: 1.8, sauce: 1, value: 0.8, size: 0.4, eye: 0.4, sides: 0.4, ratio: 0.2, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.4 }, towelette: true, napkins: true },
  { author: 'u_priya', place: 'p_harlemhot', flavour: 'Jerk', order: 'Jerk wings, 8-piece', price: 1800, heat: 4, cookPosition: 31, photo: 2, caption: 'Proper scotch bonnet heat. Charred edges, juicy inside.', days: 25, tweak: { flavour: 2, sauce: 0.9, value: 0.9, size: 0.4, eye: 0.5, sides: 0.3, ratio: 0.1, drink: 0.2, sauceOptions: 0.2, atmosphere: 0.3 }, napkins: true },
  { author: 'u_me', place: 'p_hotcoop', flavour: 'Nashville Hot', order: 'Nashville 10-piece', price: 2000, heat: 4, cookPosition: 29, photo: 3, caption: 'Right on the edge of too hot to enjoy. I enjoyed it.', days: 16, tweak: { flavour: 1.8, sauce: 0.8, value: 0.8, size: 0.4, eye: 0.4, sides: 0.3, ratio: 0.2, drink: 0.3, sauceOptions: 0.2, atmosphere: 0.3 }, towelette: true, napkins: true },
];

function buildSeedReview(spec: SeedSpec, flavours: WingFlavour[]): Review {
  const t = spec.tweak ?? {};
  const bonuses: BonusEntry[] = (spec.bonuses ?? []).map(([reason, amount], i) => ({
    id: `b_seed_${spec.place}_${i}`,
    reason,
    amount,
  }));
  const input = {
    cookPosition: spec.cookPosition,
    flavour: t.flavour ?? 1.5,
    sauce: t.sauce ?? 0.7,
    value: t.value ?? 0.7,
    size: t.size ?? 0.3,
    eye: t.eye ?? 0.4,
    sides: t.sides ?? 0.3,
    ratio: t.ratio ?? 0.1,
    drink: t.drink ?? 0.2,
    towelette: spec.towelette ?? false,
    napkins: spec.napkins ?? false,
    sauceOptions: t.sauceOptions ?? 0.1,
    atmosphere: t.atmosphere ?? 0.2,
    bonuses,
  };
  const result = calculateScore(input);
  const flavour = flavours.find((f) => f.normalizedName === normalizeName(spec.flavour))!;

  return {
    id: `r_${spec.place}_${flavour.id}_${spec.author}`,
    authorId: spec.author,
    placeId: `mock:${spec.place}`,
    flavourId: flavour.id,
    orderText: spec.order,
    priceCents: spec.price,
    currency: 'CAD',
    heat: spec.heat,
    scores: { ...result.components, cookPosition: spec.cookPosition },
    bonuses,
    baseScore: result.base,
    bonusScore: result.bonus,
    finalScore: result.final,
    caption: spec.caption,
    photos: [
      {
        id: `ph_${spec.place}_${spec.author}`,
        url: SEED_PHOTOS[spec.photo % SEED_PHOTOS.length]!,
        position: 0,
        kind: 'wing',
      },
      {
        id: `ph2_${spec.place}_${spec.author}`,
        url: SEED_PHOTOS[(spec.photo + 3) % SEED_PHOTOS.length]!,
        position: 1,
        kind: 'wing',
      },
    ],
    visibility: 'public',
    createdAt: daysAgo(spec.days),
    likeCount: 3 + ((spec.photo * 7 + spec.days) % 42),
    commentCount: (spec.photo + spec.days) % 5,
  };
}

function seedDb(): DbShape {
  const flavours = [...SEED_FLAVOURS];
  const reviews = SEED_REVIEWS.map((s) => buildSeedReview(s, flavours));
  const follows: Follow[] = ['u_maya', 'u_deshawn', 'u_priya'].map((id) => ({
    followerId: CURRENT_USER_ID,
    followeeId: id,
    createdAt: daysAgo(40),
  }));
  // A few inbound follows so the profile counts are not all zero.
  follows.push(
    ...['u_maya', 'u_deshawn', 'u_priya', 'u_tom'].map((id) => ({
      followerId: id,
      followeeId: CURRENT_USER_ID,
      createdAt: daysAgo(45),
    })),
  );

  return {
    profiles: SEED_PROFILES.map((p) => ({ ...p })),
    places: SEED_PLACES.map((p) => ({ ...p })),
    flavours,
    reviews,
    follows,
    comments: [
      { id: 'c1', reviewId: reviews[0]!.id, authorId: 'u_maya', body: 'Adding this to my list immediately.', createdAt: daysAgo(1) },
      { id: 'c2', reviewId: reviews[3]!.id, authorId: 'u_deshawn', body: 'Five peppers is not a flex, it is a warning.', createdAt: daysAgo(1) },
    ],
    likes: [{ userId: CURRENT_USER_ID, reviewId: reviews[1]!.id }],
    saves: [],
    wantToTry: [
      {
        id: 'w1',
        userId: CURRENT_USER_ID,
        placeId: 'mock:p_brooklynbones',
        flavourId: 'f_buffalo',
        sourceReviewId: null,
        createdAt: daysAgo(3),
      },
    ],
  };
}

/* ------------------------------------------------------------------- store */

export function createLocalStore(): WingzStore {
  let db: DbShape = load();
  const listeners = new Set<() => void>();

  function load(): DbShape {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DbShape;
    } catch {
      /* fall through to a fresh seed */
    }
    return seedDb();
  }

  function commit() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* quota or private mode — stay in memory */
    }
    listeners.forEach((l) => l());
  }

  const me = () => CURRENT_USER_ID;
  const profileOf = (id: ID) => db.profiles.find((p) => p.id === id);
  const placeOf = (id: ID) => db.places.find((p) => p.id === id);
  const flavourOf = (id: ID) => db.flavours.find((f) => f.id === id);

  const followingIds = () =>
    db.follows.filter((f) => f.followerId === me()).map((f) => f.followeeId);

  function hydrate(review: Review): FeedItem {
    return {
      review,
      author: profileOf(review.authorId)!,
      place: placeOf(review.placeId)!,
      flavour: flavourOf(review.flavourId)!,
      likedByMe: db.likes.some((l) => l.userId === me() && l.reviewId === review.id),
      savedByMe: db.saves.some((s) => s.userId === me() && s.reviewId === review.id),
      wantToTry: db.wantToTry.some((w) => w.userId === me() && w.placeId === review.placeId),
    };
  }

  const byNewest = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt);

  /** Reviews the current user is allowed to see, respecting private accounts. */
  function visibleReviews(): Review[] {
    const following = new Set(followingIds());
    return db.reviews.filter((r) => {
      if (r.authorId === me()) return true;
      const author = profileOf(r.authorId);
      if (author?.isPrivate) return following.has(r.authorId);
      return true;
    });
  }

  function computeAggregate(placeId: ID, flavourId: ID | null): Aggregate | null {
    const rows = db.reviews.filter(
      (r) => r.placeId === placeId && (flavourId == null || r.flavourId === flavourId),
    );
    if (!rows.length) return null;
    const avg = (pick: (r: Review) => number) =>
      round1(rows.reduce((a, r) => a + pick(r), 0) / rows.length);
    return {
      placeId,
      flavourId,
      reviewCount: rows.length,
      avgFinal: avg((r) => r.finalScore),
      avgHeat: avg((r) => r.heat),
      avgCook: avg((r) => r.scores.cook),
      avgFlavour: avg((r) => r.scores.flavour),
      avgSauce: avg((r) => r.scores.sauce),
      avgValue: avg((r) => r.scores.value),
      avgSize: avg((r) => r.scores.size),
      avgEye: avg((r) => r.scores.eye),
      avgSides: avg((r) => r.scores.sides),
      avgDrink: avg((r) => r.scores.drink),
    };
  }

  return {
    currentUserId: me,

    getProfile(id) {
      const p = profileOf(id);
      if (!p) return undefined;
      // Counts are derived, never hand-maintained.
      return {
        ...p,
        followerCount: db.follows.filter((f) => f.followeeId === id).length,
        followingCount: db.follows.filter((f) => f.followerId === id).length,
        reviewCount: db.reviews.filter((r) => r.authorId === id).length,
      };
    },
    listProfiles: () => db.profiles.map((p) => ({ ...p })),
    updateProfile(id, patch) {
      const p = profileOf(id);
      if (!p) return;
      Object.assign(p, patch);
      commit();
    },

    followState(targetId) {
      if (db.follows.some((f) => f.followerId === me() && f.followeeId === targetId))
        return 'following';
      return 'none';
    },
    toggleFollow(targetId) {
      const i = db.follows.findIndex((f) => f.followerId === me() && f.followeeId === targetId);
      let next: FollowState;
      if (i >= 0) {
        db.follows.splice(i, 1);
        next = 'none';
      } else {
        db.follows.push({ followerId: me(), followeeId: targetId, createdAt: new Date().toISOString() });
        // A private account would enter 'requested' here once auth is real.
        next = profileOf(targetId)?.isPrivate ? 'requested' : 'following';
      }
      commit();
      return next;
    },
    followingIds,

    getPlace: placeOf,
    upsertPlace(place) {
      const existing = placeOf(place.id);
      if (existing) return existing;
      db.places.push(place);
      commit();
      return place;
    },
    listPlaces: () => db.places,

    getFlavour: flavourOf,
    listFlavours: () => db.flavours,
    resolveFlavour(name) {
      const n = normalizeName(name);
      const found = db.flavours.find((f) => f.normalizedName === n);
      if (found) return found;
      const created: WingFlavour = { id: uid('f'), name: name.trim(), normalizedName: n };
      db.flavours.push(created);
      commit();
      return created;
    },

    createReview(draft) {
      const result = calculateScore({
        cookPosition: draft.scores.cookPosition,
        flavour: draft.scores.flavour,
        sauce: draft.scores.sauce,
        value: draft.scores.value,
        size: draft.scores.size,
        eye: draft.scores.eye,
        sides: draft.scores.sides,
        ratio: draft.scores.ratio,
        drink: draft.scores.drink,
        towelette: draft.scores.towelette > 0,
        napkins: draft.scores.napkins > 0,
        sauceOptions: draft.scores.sauceOptions,
        atmosphere: draft.scores.atmosphere,
        bonuses: draft.bonuses,
      });
      const flavour = this.resolveFlavour(draft.flavourName);
      const review: Review = {
        id: uid('r'),
        authorId: me(),
        placeId: draft.placeId,
        flavourId: flavour.id,
        orderText: draft.orderText,
        priceCents: draft.priceCents,
        currency: draft.currency,
        heat: draft.heat,
        scores: { ...result.components, cookPosition: draft.scores.cookPosition },
        bonuses: draft.bonuses,
        baseScore: result.base,
        bonusScore: result.bonus,
        finalScore: result.final,
        caption: draft.caption,
        photos: draft.photos.map((p, i) => ({
          id: uid('ph'),
          url: p.url,
          position: i,
          kind: p.kind,
        })),
        visibility: draft.visibility,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
      };
      db.reviews.unshift(review);
      commit();
      return review;
    },

    getReview: (id) => db.reviews.find((r) => r.id === id),
    listReviews: () => [...db.reviews].sort(byNewest),
    reviewsByAuthor: (id) => db.reviews.filter((r) => r.authorId === id).sort(byNewest),
    reviewsForPlace: (id) => db.reviews.filter((r) => r.placeId === id).sort(byNewest),

    feed() {
      const following = new Set([...followingIds(), me()]);
      return db.reviews
        .filter((r) => following.has(r.authorId))
        .sort(byNewest)
        .map(hydrate);
    },

    publicPosts() {
      return visibleReviews()
        .filter((r) => r.visibility === 'public' && r.authorId !== me())
        .sort(byNewest)
        .map(hydrate);
    },

    hydrate,

    toggleLike(reviewId) {
      const i = db.likes.findIndex((l) => l.userId === me() && l.reviewId === reviewId);
      const review = db.reviews.find((r) => r.id === reviewId);
      if (!review) return false;
      let liked: boolean;
      if (i >= 0) {
        db.likes.splice(i, 1);
        review.likeCount = Math.max(0, review.likeCount - 1);
        liked = false;
      } else {
        db.likes.push({ userId: me(), reviewId });
        review.likeCount += 1;
        liked = true;
      }
      commit();
      return liked;
    },

    toggleSave(reviewId) {
      const i = db.saves.findIndex((s) => s.userId === me() && s.reviewId === reviewId);
      let saved: boolean;
      if (i >= 0) {
        db.saves.splice(i, 1);
        saved = false;
      } else {
        db.saves.push({ userId: me(), reviewId });
        saved = true;
      }
      commit();
      return saved;
    },

    listComments(reviewId) {
      return db.comments
        .filter((c) => c.reviewId === reviewId)
        .map((c) => ({ ...c, author: profileOf(c.authorId)! }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    addComment(reviewId, body) {
      const review = db.reviews.find((r) => r.id === reviewId);
      if (!review || !body.trim()) return;
      db.comments.push({
        id: uid('c'),
        reviewId,
        authorId: me(),
        body: body.trim(),
        createdAt: new Date().toISOString(),
      });
      review.commentCount += 1;
      commit();
    },

    toggleWantToTry(placeId, flavourId, sourceReviewId) {
      const i = db.wantToTry.findIndex((w) => w.userId === me() && w.placeId === placeId);
      let on: boolean;
      if (i >= 0) {
        db.wantToTry.splice(i, 1);
        on = false;
      } else {
        db.wantToTry.push({
          id: uid('w'),
          userId: me(),
          placeId,
          flavourId,
          sourceReviewId,
          createdAt: new Date().toISOString(),
        });
        on = true;
      }
      commit();
      return on;
    },

    isWantToTry: (placeId) => db.wantToTry.some((w) => w.userId === me() && w.placeId === placeId),

    listWantToTry() {
      return db.wantToTry
        .filter((w) => w.userId === me())
        .map((w) => ({
          ...w,
          place: placeOf(w.placeId)!,
          flavour: w.flavourId ? (flavourOf(w.flavourId) ?? null) : null,
        }))
        .filter((w) => w.place);
    },

    rankings(filters) {
      const following = new Set(followingIds());
      let rows = visibleReviews();

      if (filters.scope === 'mine') rows = rows.filter((r) => r.authorId === me());
      else if (filters.scope === 'friends') rows = rows.filter((r) => following.has(r.authorId));

      if (filters.minHeat != null) rows = rows.filter((r) => r.heat >= filters.minHeat!);
      if (filters.maxHeat != null) rows = rows.filter((r) => r.heat <= filters.maxHeat!);
      if (filters.minScore != null) rows = rows.filter((r) => r.finalScore >= filters.minScore!);
      if (filters.flavourId) rows = rows.filter((r) => r.flavourId === filters.flavourId);
      if (filters.city) {
        rows = rows.filter((r) => placeOf(r.placeId)?.city === filters.city);
      }

      const key = filters.sortBy ?? 'final';
      const pick = (r: Review) => (key === 'final' ? r.finalScore : r.scores[key]);
      return rows.sort((a, b) => pick(b) - pick(a) || byNewest(a, b)).map(hydrate);
    },

    discoverMarkers(filters) {
      const following = new Set(followingIds());
      const out: { place: Place; owner: 'mine' | 'friends' | 'community' | 'wantToTry'; label: string }[] = [];

      if (filters.owner === 'wantToTry') {
        for (const w of this.listWantToTry()) {
          out.push({ place: w.place, owner: 'wantToTry', label: '♥' });
        }
        return out;
      }

      // One marker per restaurant, owned by the closest relationship that
      // reviewed it: mine beats friends beats community.
      const byPlace = new Map<ID, Review[]>();
      for (const r of visibleReviews()) {
        if (r.heat < filters.minHeat || r.heat > filters.maxHeat) continue;
        if (r.finalScore < filters.minScore) continue;
        if (filters.flavourId && r.flavourId !== filters.flavourId) continue;

        const mine = r.authorId === me();
        const friend = following.has(r.authorId);
        if (filters.owner === 'mine' && !mine) continue;
        if (filters.owner === 'friends' && !friend) continue;
        if (filters.owner === 'mine+friends' && !mine && !friend) continue;

        byPlace.set(r.placeId, [...(byPlace.get(r.placeId) ?? []), r]);
      }

      for (const [placeId, rows] of byPlace) {
        const place = placeOf(placeId);
        if (!place) continue;
        const mine = rows.find((r) => r.authorId === me());
        const friend = rows.find((r) => following.has(r.authorId));
        const chosen = mine ?? friend ?? rows[0]!;
        out.push({
          place,
          owner: mine ? 'mine' : friend ? 'friends' : 'community',
          label: chosen.finalScore.toFixed(1),
        });
      }
      return out;
    },

    aggregate: (placeId, flavourId = null) => computeAggregate(placeId, flavourId),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

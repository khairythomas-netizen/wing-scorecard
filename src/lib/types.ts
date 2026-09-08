import type { BonusEntry, CoreKey, ExperienceKey } from './scoring';

export type ID = string;
export type ISODate = string;

/* ------------------------------------------------------------------ places */

/**
 * A real-world place, normalised so a restaurant is never just a string.
 * Every field here is populated by a PlacesProvider (mock today, Google
 * Places tomorrow) so switching providers is an adapter change, not a redesign.
 */
export interface Place {
  id: ID;
  /** The provider's own identifier, e.g. a Google Places place_id. */
  externalId: string;
  provider: 'mock' | 'google' | 'mapbox';
  /** What the user sees, e.g. "Bird Bar". */
  displayName: string;
  /** Lowercased, punctuation-stripped, for dedupe and matching. */
  normalizedName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  city: string;
  /** State or province. */
  region: string;
  country: string;
}

/* ------------------------------------------------------------- users/social */

export interface Profile {
  id: ID;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  reviewCount: number;
}

export type FollowState = 'none' | 'requested' | 'following';

export interface Follow {
  followerId: ID;
  followeeId: ID;
  createdAt: ISODate;
}

export interface FollowRequest {
  id: ID;
  requesterId: ID;
  targetId: ID;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: ISODate;
}

/* --------------------------------------------------------------- wing data */

/**
 * A sauce/flavour is its own entity because heat and scores aggregate on
 * restaurant + flavour, never on the restaurant alone. One shop's Buffalo,
 * Hot Honey and Suicide are three different things.
 */
export interface WingFlavour {
  id: ID;
  name: string;
  normalizedName: string;
}

export interface ReviewPhoto {
  id: ID;
  url: string;
  /** Position 0 is the required main photo. */
  position: number;
  kind: 'wing' | 'menu' | 'bill' | 'sauce' | 'sides' | 'interior' | 'other';
}

/** Every sub-score is retained, not just the total. */
export type ReviewScores = Record<CoreKey | ExperienceKey, number> & {
  /** Raw 0-60 slider position, so raw-vs-burnt survives a round trip. */
  cookPosition: number;
};

export interface Review {
  id: ID;
  authorId: ID;
  placeId: ID;
  flavourId: ID;
  /** Free text: "20-wing combo", "boneless combo + fries". */
  orderText: string;
  /** Structured, in cents, so value maths and currency stay honest. */
  priceCents: number;
  currency: string;
  /** Whole 1-5 peppers. Descriptive only — never affects the score. */
  heat: 1 | 2 | 3 | 4 | 5;
  scores: ReviewScores;
  bonuses: BonusEntry[];
  /** Denormalised from scores + bonuses at write time for cheap sorting. */
  baseScore: number;
  bonusScore: number;
  finalScore: number;
  caption: string;
  photos: ReviewPhoto[];
  visibility: 'public' | 'followers';
  createdAt: ISODate;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: ID;
  reviewId: ID;
  authorId: ID;
  body: string;
  createdAt: ISODate;
}

export interface WantToTryEntry {
  id: ID;
  userId: ID;
  placeId: ID;
  /** Optional: the specific flavour that caught their eye while swiping. */
  flavourId: ID | null;
  sourceReviewId: ID | null;
  createdAt: ISODate;
}

/* ------------------------------------------------------------- aggregation */

/**
 * Rolled-up community numbers. Computed per restaurant, and per
 * restaurant + flavour, so heat filters stay clean.
 */
export interface Aggregate {
  placeId: ID;
  flavourId: ID | null;
  reviewCount: number;
  avgFinal: number;
  avgHeat: number;
  avgCook: number;
  avgFlavour: number;
  avgSauce: number;
  avgValue: number;
  avgSize: number;
  avgEye: number;
  avgSides: number;
  avgDrink: number;
}

/* ------------------------------------------------------- view-model helpers */

/** A review joined with everything the UI needs to render it in one pass. */
export interface FeedItem {
  review: Review;
  author: Profile;
  place: Place;
  flavour: WingFlavour;
  likedByMe: boolean;
  savedByMe: boolean;
  wantToTry: boolean;
}

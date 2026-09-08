import type {
  Aggregate,
  Comment,
  FeedItem,
  FollowState,
  ID,
  Place,
  Profile,
  Review,
  WantToTryEntry,
  WingFlavour,
} from '../types';

export interface DraftReview {
  placeId: ID;
  flavourName: string;
  orderText: string;
  priceCents: number;
  currency: string;
  heat: 1 | 2 | 3 | 4 | 5;
  scores: Review['scores'];
  bonuses: Review['bonuses'];
  caption: string;
  photos: { url: string; kind: Review['photos'][number]['kind'] }[];
  visibility: Review['visibility'];
}

export interface RankingFilters {
  scope: 'mine' | 'friends' | 'global';
  minHeat?: number;
  maxHeat?: number;
  minScore?: number;
  flavourId?: ID | null;
  city?: string | null;
  /** Which component to rank on. 'final' is the default overall ranking. */
  sortBy?: 'final' | 'cook' | 'flavour' | 'value' | 'sauce';
}

export interface DiscoverFilters {
  owner: 'mine+friends' | 'mine' | 'friends' | 'everyone' | 'wantToTry';
  minHeat: number;
  maxHeat: number;
  minScore: number;
  flavourId: ID | null;
}

/**
 * Everything the UI needs from persistence. The local implementation backs
 * development; the Supabase implementation drops in behind the same interface
 * once auth is switched on.
 */
export interface WingzStore {
  currentUserId(): ID;

  getProfile(id: ID): Profile | undefined;
  listProfiles(): Profile[];
  updateProfile(id: ID, patch: Partial<Profile>): void;

  followState(targetId: ID): FollowState;
  toggleFollow(targetId: ID): FollowState;
  /** Ids the current user follows (approved only). */
  followingIds(): ID[];

  getPlace(id: ID): Place | undefined;
  upsertPlace(place: Place): Place;
  listPlaces(): Place[];

  getFlavour(id: ID): WingFlavour | undefined;
  listFlavours(): WingFlavour[];
  /** Find by name or create — flavours are shared vocabulary across users. */
  resolveFlavour(name: string): WingFlavour;

  createReview(draft: DraftReview): Review;
  getReview(id: ID): Review | undefined;
  listReviews(): Review[];
  reviewsByAuthor(id: ID): Review[];
  reviewsForPlace(id: ID): Review[];

  /** Posts from people the current user follows, newest first. */
  feed(): FeedItem[];
  /** Public posts from everyone, for Discover surfaces. */
  publicPosts(): FeedItem[];
  hydrate(review: Review): FeedItem;

  toggleLike(reviewId: ID): boolean;
  toggleSave(reviewId: ID): boolean;
  listComments(reviewId: ID): (Comment & { author: Profile })[];
  addComment(reviewId: ID, body: string): void;

  toggleWantToTry(placeId: ID, flavourId: ID | null, sourceReviewId: ID | null): boolean;
  isWantToTry(placeId: ID): boolean;
  listWantToTry(): (WantToTryEntry & { place: Place; flavour: WingFlavour | null })[];

  rankings(filters: RankingFilters): FeedItem[];
  discoverMarkers(filters: DiscoverFilters): {
    place: Place;
    owner: 'mine' | 'friends' | 'community' | 'wantToTry';
    label: string;
  }[];

  /** Community rollups. `flavourId` null aggregates the whole restaurant. */
  aggregate(placeId: ID, flavourId?: ID | null): Aggregate | null;

  subscribe(listener: () => void): () => void;
}

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

/** A pending request to follow a private account, with who is asking. */
export interface PendingFollowRequest {
  id: ID;
  requester: Profile;
  createdAt: string;
}

/** A photo on its way into a review. `file` is absent for already-hosted URLs. */
export interface DraftPhoto {
  url: string;
  file?: File | null;
  kind: Review['photos'][number]['kind'];
}

export interface DraftReview {
  /** The resolved place. Stores persist it if they have not seen it before. */
  place: Place;
  flavourName: string;
  orderText: string;
  priceCents: number | null;
  currency: string;
  heat: 1 | 2 | 3 | 4 | 5;
  style: Review['style'];
  breading: Review['breading'];
  scores: Review['scores'];
  bonuses: Review['bonuses'];
  caption: string;
  photos: DraftPhoto[];
  visibility: Review['visibility'];
}

/** The fields a review's author may change after posting. */
export interface ReviewEdit {
  /** A different restaurant, or null to leave it as it is. */
  place: Place | null;
  orderText: string;
  flavourName: string;
  priceCents: number | null;
  currency: string;
  heat: 1 | 2 | 3 | 4 | 5;
  style: Review['style'];
  breading: Review['breading'];
  caption: string;
  scores: Review['scores'];
  bonuses: Review['bonuses'];
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
  /** Restrict to one author, for a profile's ranked list. */
  authorId?: ID | null;
}

export interface DiscoverFilters {
  owner: 'mine+friends' | 'mine' | 'friends' | 'everyone' | 'wantToTry';
  minHeat: number;
  maxHeat: number;
  minScore: number;
  flavourId: ID | null;
}

export interface DiscoverMarker {
  place: Place;
  owner: 'mine' | 'friends' | 'community' | 'wantToTry';
  label: string;
}

export interface PlaceDetail {
  place: Place;
  myReview: Review | null;
  friendAverage: number | null;
  community: Aggregate | null;
  topFlavour: WingFlavour | null;
  photoUrl: string | null;
  wantToTry: boolean;
}

/**
 * Everything the UI needs from persistence.
 *
 * Async throughout, because the Supabase implementation is: keeping the
 * interface honest here means the local implementation and the hosted one are
 * genuinely interchangeable, rather than the screens quietly depending on
 * synchronous reads that only ever worked in memory.
 */
export interface WingzStore {
  readonly name: 'local' | 'supabase';

  /** The signed-in user, or null. Synchronous because render paths need it. */
  currentUserId(): ID | null;
  setCurrentUserId(id: ID | null): void;

  getProfile(id: ID): Promise<Profile | null>;
  listSuggestedProfiles(): Promise<Profile[]>;
  /** Username search for finding people to follow. */
  searchProfiles(query: string): Promise<Profile[]>;

  followState(targetId: ID): Promise<FollowState>;
  /** Follow, unfollow, request, or withdraw a request, depending on state. */
  toggleFollow(targetId: ID): Promise<FollowState>;
  followingProfiles(): Promise<Profile[]>;

  /** Requests waiting on the current user's approval. */
  incomingFollowRequests(): Promise<PendingFollowRequest[]>;
  approveFollowRequest(requestId: ID): Promise<void>;
  rejectFollowRequest(requestId: ID): Promise<void>;

  getFlavours(): Promise<WingFlavour[]>;
  listCities(): Promise<string[]>;

  createReview(draft: DraftReview): Promise<Review>;
  /** Author-only. Photos and restaurant are not editable. */
  updateReview(reviewId: ID, edit: ReviewEdit): Promise<void>;
  reviewsByAuthor(id: ID): Promise<Review[]>;
  /** One post with everything needed to render it, or null if not visible. */
  feedItem(reviewId: ID): Promise<FeedItem | null>;

  /** Posts from people the current user follows, newest first. */
  feed(): Promise<FeedItem[]>;
  /** Public posts from other people, for swipe discovery. */
  publicPosts(): Promise<FeedItem[]>;

  toggleLike(reviewId: ID): Promise<boolean>;
  toggleSave(reviewId: ID): Promise<boolean>;
  listComments(reviewId: ID): Promise<(Comment & { author: Profile })[]>;
  addComment(reviewId: ID, body: string): Promise<void>;

  toggleWantToTry(placeId: ID, flavourId: ID | null, sourceReviewId: ID | null): Promise<boolean>;
  listWantToTry(): Promise<(WantToTryEntry & { place: Place; flavour: WingFlavour | null })[]>;

  rankings(filters: RankingFilters): Promise<FeedItem[]>;
  discoverMarkers(filters: DiscoverFilters): Promise<DiscoverMarker[]>;
  placeDetail(placeId: ID): Promise<PlaceDetail | null>;

  /** Fires after any write, so open queries can refetch. */
  subscribe(listener: () => void): () => void;
}

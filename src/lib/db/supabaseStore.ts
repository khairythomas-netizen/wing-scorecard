import type { SupabaseClient } from '@supabase/supabase-js';
import { toProfile } from '../auth/supabaseAuth';
import { normalizeName } from '../places/provider';
import { calculateScore, round1 } from '../scoring';
import { PHOTO_BUCKET } from '../supabase/client';
import type {
  Aggregate,
  Comment,
  FeedItem,
  ID,
  Place,
  Profile,
  Review,
  WingFlavour,
} from '../types';
import type { DraftPhoto, PendingFollowRequest, WingzStore } from './store';

/* --------------------------------------------------------------- row types */

export interface PlaceRow {
  id: string;
  provider: string;
  external_id: string;
  display_name: string;
  normalized_name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
}

export interface ReviewRow {
  id: string;
  author_id: string;
  place_id: string;
  flavour_id: string;
  order_text: string;
  price_cents: number | null;
  currency: string;
  heat: number;
  caption: string;
  visibility: string;
  base_score: string | number;
  bonus_score: string | number;
  final_score: string | number;
  created_at: string;
  author?: Record<string, unknown> | null;
  place?: PlaceRow | null;
  flavour?: { id: string; name: string; normalized_name: string } | null;
  scores?: Record<string, string | number> | null;
  bonuses?: { id: string; reason: string; amount: string | number; position: number }[];
  photos?: { id: string; url: string; position: number; kind: string }[];
}

const REVIEW_SELECT = `
  id, author_id, place_id, flavour_id, order_text, price_cents, currency,
  heat, caption, visibility, base_score, bonus_score, final_score, created_at,
  author:profiles!reviews_author_id_fkey(id, username, display_name, bio, avatar_url, is_private),
  place:places(*),
  flavour:wing_flavours(id, name, normalized_name),
  scores:review_scores(*),
  bonuses:review_bonuses(id, reason, amount, position),
  photos:review_photos(id, url, position, kind)
`;

/** Postgres numerics arrive as strings; never let one reach the score maths. */
const num = (v: string | number | null | undefined): number => Number(v ?? 0);

export function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    externalId: row.external_id,
    provider: row.provider as Place['provider'],
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    formattedAddress: row.formatted_address ?? '',
    lat: num(row.lat),
    lng: num(row.lng),
    city: row.city ?? '',
    region: row.region ?? '',
    country: row.country ?? '',
  };
}

function toFlavour(row: { id: string; name: string; normalized_name: string }): WingFlavour {
  return { id: row.id, name: row.name, normalizedName: row.normalized_name };
}

export function toReview(row: ReviewRow): Review {
  const s = row.scores ?? {};
  return {
    id: row.id,
    authorId: row.author_id,
    placeId: row.place_id,
    flavourId: row.flavour_id,
    orderText: row.order_text,
    priceCents: row.price_cents ?? null,
    currency: row.currency,
    heat: row.heat as Review['heat'],
    scores: {
      cook: num(s.cook),
      cookPosition: num(s.cook_position),
      flavour: num(s.flavour),
      sauce: num(s.sauce),
      value: num(s.value),
      size: num(s.size),
      eye: num(s.eye),
      sides: num(s.sides),
      ratio: num(s.ratio),
      drink: num(s.drink),
      towelette: num(s.towelette),
      napkins: num(s.napkins),
      sauceOptions: num(s.sauce_options),
      atmosphere: num(s.atmosphere),
    },
    bonuses: (row.bonuses ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ id: b.id, reason: b.reason, amount: num(b.amount) })),
    baseScore: num(row.base_score),
    bonusScore: num(row.bonus_score),
    finalScore: num(row.final_score),
    caption: row.caption ?? '',
    photos: (row.photos ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        url: p.url,
        position: p.position,
        kind: p.kind as Review['photos'][number]['kind'],
      })),
    visibility: row.visibility as Review['visibility'],
    createdAt: row.created_at,
    likeCount: 0,
    commentCount: 0,
  };
}

/* ------------------------------------------------------------------- store */

export function createSupabaseStore(client: SupabaseClient): WingzStore {
  const listeners = new Set<() => void>();
  let currentUser: ID | null = null;

  const notify = () => listeners.forEach((l) => l());
  const me = () => currentUser;

  const fail = (context: string, error: { message: string } | null) => {
    if (error) throw new Error(`${context}: ${error.message}`);
  };

  /** Ids the current user follows. Small enough to fetch per query. */
  async function followingIds(): Promise<ID[]> {
    const uid = me();
    if (!uid) return [];
    const { data } = await client.from('follows').select('followee_id').eq('follower_id', uid);
    return (data ?? []).map((r) => r.followee_id as ID);
  }

  /**
   * Counts are derived rather than denormalised, so they cannot drift.
   * PostgREST head-count queries return only a number, not the rows.
   */
  async function profileCounts(id: ID): Promise<Partial<Profile>> {
    const [followers, following, reviews] = await Promise.all([
      client.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
      client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      client.from('reviews').select('*', { count: 'exact', head: true }).eq('author_id', id),
    ]);
    return {
      followerCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      reviewCount: reviews.count ?? 0,
    };
  }

  /**
   * Attach the viewer-specific and counted fields that cannot come from the
   * review select itself: like/save/want-to-try membership and engagement
   * counts, all fetched in one round trip per collection rather than per row.
   */
  async function hydrateAll(rows: ReviewRow[]): Promise<FeedItem[]> {
    if (!rows.length) return [];
    const uid = me();
    const ids = rows.map((r) => r.id);
    const placeIds = [...new Set(rows.map((r) => r.place_id))];

    const [likeRows, commentRows, myLikes, mySaves, myWant] = await Promise.all([
      client.from('likes').select('review_id').in('review_id', ids),
      client.from('comments').select('review_id').in('review_id', ids),
      uid
        ? client.from('likes').select('review_id').eq('user_id', uid).in('review_id', ids)
        : Promise.resolve({ data: [] }),
      uid
        ? client.from('saved_posts').select('review_id').eq('user_id', uid).in('review_id', ids)
        : Promise.resolve({ data: [] }),
      uid
        ? client.from('want_to_try').select('place_id').eq('user_id', uid).in('place_id', placeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tally = (data: { review_id: string }[] | null) => {
      const m = new Map<string, number>();
      (data ?? []).forEach((r) => m.set(r.review_id, (m.get(r.review_id) ?? 0) + 1));
      return m;
    };
    const likeCounts = tally(likeRows.data as { review_id: string }[] | null);
    const commentCounts = tally(commentRows.data as { review_id: string }[] | null);
    const likedSet = new Set((myLikes.data ?? []).map((r) => (r as { review_id: string }).review_id));
    const savedSet = new Set((mySaves.data ?? []).map((r) => (r as { review_id: string }).review_id));
    const wantSet = new Set((myWant.data ?? []).map((r) => (r as { place_id: string }).place_id));

    return rows
      .filter((row) => row.author && row.place && row.flavour)
      .map((row) => {
        const review = toReview(row);
        review.likeCount = likeCounts.get(row.id) ?? 0;
        review.commentCount = commentCounts.get(row.id) ?? 0;
        return {
          review,
          author: toProfile(row.author as never),
          place: toPlace(row.place!),
          flavour: toFlavour(row.flavour!),
          likedByMe: likedSet.has(row.id),
          savedByMe: savedSet.has(row.id),
          wantToTry: wantSet.has(row.place_id),
        };
      });
  }

  /** Upload a picked file and return its public URL. */
  async function uploadPhoto(photo: DraftPhoto, index: number): Promise<string> {
    if (!photo.file) return photo.url;
    const uid = me();
    if (!uid) throw new Error('Not signed in');

    const ext = (photo.file.name.split('.').pop() ?? 'jpg').toLowerCase();
    // The folder must be the uploader's id: the storage policy checks it.
    const path = `${uid}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, photo.file, { contentType: photo.file.type, upsert: false });
    fail('Photo upload', error);

    return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return {
    name: 'supabase',
    currentUserId: () => currentUser,
    setCurrentUserId(id) {
      if (currentUser === id) return;
      currentUser = id;
      notify();
    },

    async getProfile(id) {
      const { data } = await client
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, is_private')
        .eq('id', id)
        .maybeSingle();
      if (!data) return null;
      return toProfile(data as never, await profileCounts(id));
    },

    async listSuggestedProfiles() {
      const uid = me();
      const following = new Set(await followingIds());
      const { data } = await client
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, is_private')
        .not('username', 'is', null)
        .limit(30);
      return (data ?? [])
        .filter((p) => (p as { id: string }).id !== uid && !following.has((p as { id: string }).id))
        .map((p) => toProfile(p as never));
    },

    async searchProfiles(query) {
      const q = query.trim();
      if (!q) return [];
      const uid = me();
      const escaped = q.replace(/[%_,()]/g, '');
      if (!escaped) return [];
      const { data } = await client
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, is_private')
        .not('username', 'is', null)
        .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
        .limit(20);
      return (data ?? [])
        .filter((p) => (p as { id: string }).id !== uid)
        .map((p) => toProfile(p as never));
    },

    async followState(targetId) {
      const uid = me();
      if (!uid) return 'none';
      const { count } = await client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', uid)
        .eq('followee_id', targetId);
      if (count) return 'following';

      const { data: req } = await client
        .from('follow_requests')
        .select('status')
        .eq('requester_id', uid)
        .eq('target_id', targetId)
        .maybeSingle();
      return req && (req as { status: string }).status === 'pending' ? 'requested' : 'none';
    },

    async toggleFollow(targetId) {
      const uid = me();
      if (!uid) return 'none';

      const state = await this.followState(targetId);
      if (state === 'following') {
        fail('Unfollow', (await client.from('follows').delete().eq('follower_id', uid).eq('followee_id', targetId)).error);
        notify();
        return 'none';
      }
      if (state === 'requested') {
        await client.from('follow_requests').delete().eq('requester_id', uid).eq('target_id', targetId);
        notify();
        return 'none';
      }

      const { data: target } = await client
        .from('profiles')
        .select('is_private')
        .eq('id', targetId)
        .maybeSingle();

      // Private accounts get a request; public ones are followed immediately.
      if (target && (target as { is_private: boolean }).is_private) {
        fail('Follow request', (await client.from('follow_requests').insert({ requester_id: uid, target_id: targetId })).error);
        notify();
        return 'requested';
      }
      fail('Follow', (await client.from('follows').insert({ follower_id: uid, followee_id: targetId })).error);
      notify();
      return 'following';
    },

    async incomingFollowRequests() {
      const uid = me();
      if (!uid) return [];
      const { data } = await client
        .from('follow_requests')
        .select('id, created_at, requester:profiles!follow_requests_requester_id_fkey(id, username, display_name, bio, avatar_url, is_private)')
        .eq('target_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return (data ?? [])
        .map((r) => {
          const row = r as unknown as {
            id: string; created_at: string; requester: Record<string, unknown> | null;
          };
          if (!row.requester) return null;
          return {
            id: row.id,
            requester: toProfile(row.requester as never),
            createdAt: row.created_at,
          } satisfies PendingFollowRequest;
        })
        .filter((r): r is PendingFollowRequest => r != null);
    },

    async approveFollowRequest(requestId) {
      fail('Approve request', (await client.rpc('approve_follow_request', { p_request_id: requestId })).error);
      notify();
    },

    async rejectFollowRequest(requestId) {
      fail('Decline request', (await client.rpc('reject_follow_request', { p_request_id: requestId })).error);
      notify();
    },

    async followingProfiles() {
      const ids = await followingIds();
      if (!ids.length) return [];
      const { data } = await client
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, is_private')
        .in('id', ids);
      return (data ?? []).map((p) => toProfile(p as never));
    },

    async getFlavours() {
      const { data } = await client.from('wing_flavours').select('id, name, normalized_name').order('name');
      return (data ?? []).map((f) => toFlavour(f as never));
    },

    async listCities() {
      const { data } = await client.from('places').select('city').not('city', 'eq', '');
      return [...new Set((data ?? []).map((p) => (p as { city: string }).city))].sort();
    },

    async createReview(draft) {
      const uid = me();
      if (!uid) throw new Error('Not signed in');

      // The score is recomputed here rather than trusted from the client, so a
      // stored final_score always matches its own components.
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

      const { data: placeId, error: placeError } = await client.rpc('resolve_place', {
        p_provider: draft.place.provider,
        p_external_id: draft.place.externalId,
        p_display_name: draft.place.displayName,
        p_normalized_name: draft.place.normalizedName,
        p_address: draft.place.formattedAddress,
        p_lat: draft.place.lat,
        p_lng: draft.place.lng,
        p_city: draft.place.city,
        p_region: draft.place.region,
        p_country: draft.place.country,
      });
      fail('Save restaurant', placeError);

      const { data: flavourId, error: flavourError } = await client.rpc('resolve_flavour', {
        p_name: draft.flavourName,
        p_normalized: normalizeName(draft.flavourName),
      });
      fail('Save flavour', flavourError);

      const urls = await Promise.all(draft.photos.map((p, i) => uploadPhoto(p, i)));

      const { data: reviewId, error } = await client.rpc('publish_review', {
        p_place_id: placeId,
        p_flavour_id: flavourId,
        p_order_text: draft.orderText,
        p_price_cents: draft.priceCents,
        p_currency: draft.currency,
        p_heat: draft.heat,
        p_caption: draft.caption,
        p_visibility: draft.visibility,
        p_base: result.base,
        p_bonus: result.bonus,
        p_final: result.final,
        p_scores: { ...result.components, cookPosition: draft.scores.cookPosition },
        p_bonuses: draft.bonuses.filter((b) => b.amount > 0).map((b) => ({ reason: b.reason, amount: b.amount })),
        p_photos: draft.photos.map((p, i) => ({ url: urls[i], kind: p.kind })),
      });
      fail('Publish review', error);

      notify();
      return {
        id: reviewId as string,
        authorId: uid,
        placeId: placeId as string,
        flavourId: flavourId as string,
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
        photos: urls.map((url, i) => ({
          id: `${reviewId}-${i}`,
          url: url!,
          position: i,
          kind: draft.photos[i]!.kind,
        })),
        visibility: draft.visibility,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
      };
    },

    async reviewsByAuthor(id) {
      const { data } = await client
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('author_id', id)
        .order('created_at', { ascending: false });
      return (data ?? []).map((r) => toReview(r as never));
    },

    async feedItem(reviewId) {
      // RLS decides visibility, so an unreadable post simply returns no row.
      const { data } = await client.from('reviews').select(REVIEW_SELECT).eq('id', reviewId).limit(1);
      const items = await hydrateAll((data ?? []) as never);
      return items[0] ?? null;
    },

    async feed() {
      const uid = me();
      if (!uid) return [];
      const ids = [...(await followingIds()), uid];
      const { data, error } = await client
        .from('reviews')
        .select(REVIEW_SELECT)
        .in('author_id', ids)
        .order('created_at', { ascending: false })
        .limit(60);
      fail('Load feed', error);
      return hydrateAll((data ?? []) as never);
    },

    async publicPosts() {
      const uid = me();
      const query = client
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(60);
      if (uid) query.neq('author_id', uid);
      const { data } = await query;
      return hydrateAll((data ?? []) as never);
    },

    async toggleLike(reviewId) {
      const uid = me();
      if (!uid) return false;
      const { count } = await client
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('review_id', reviewId);

      if (count) {
        await client.from('likes').delete().eq('user_id', uid).eq('review_id', reviewId);
        notify();
        return false;
      }
      await client.from('likes').insert({ user_id: uid, review_id: reviewId });
      notify();
      return true;
    },

    async toggleSave(reviewId) {
      const uid = me();
      if (!uid) return false;
      const { count } = await client
        .from('saved_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('review_id', reviewId);

      if (count) {
        await client.from('saved_posts').delete().eq('user_id', uid).eq('review_id', reviewId);
        notify();
        return false;
      }
      await client.from('saved_posts').insert({ user_id: uid, review_id: reviewId });
      notify();
      return true;
    },

    async listComments(reviewId) {
      const { data } = await client
        .from('comments')
        .select('id, review_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(id, username, display_name, bio, avatar_url, is_private)')
        .eq('review_id', reviewId)
        .order('created_at');
      return (data ?? []).map((c) => {
        const row = c as unknown as {
          id: string; review_id: string; author_id: string; body: string;
          created_at: string; author: Record<string, unknown>;
        };
        return {
          id: row.id,
          reviewId: row.review_id,
          authorId: row.author_id,
          body: row.body,
          createdAt: row.created_at,
          author: toProfile(row.author as never),
        } satisfies Comment & { author: Profile };
      });
    },

    async addComment(reviewId, body) {
      const uid = me();
      if (!uid || !body.trim()) return;
      fail('Add comment', (await client.from('comments').insert({ review_id: reviewId, author_id: uid, body: body.trim() })).error);
      notify();
    },

    async toggleWantToTry(placeId, flavourId, sourceReviewId) {
      const uid = me();
      if (!uid) return false;
      const { data: existing } = await client
        .from('want_to_try')
        .select('id')
        .eq('user_id', uid)
        .eq('place_id', placeId)
        .limit(1);

      if (existing?.length) {
        await client.from('want_to_try').delete().eq('user_id', uid).eq('place_id', placeId);
        notify();
        return false;
      }
      await client.from('want_to_try').insert({
        user_id: uid,
        place_id: placeId,
        flavour_id: flavourId,
        source_review_id: sourceReviewId,
      });
      notify();
      return true;
    },

    async listWantToTry() {
      const uid = me();
      if (!uid) return [];
      const { data } = await client
        .from('want_to_try')
        .select('id, user_id, place_id, flavour_id, source_review_id, created_at, place:places(*), flavour:wing_flavours(id, name, normalized_name)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      return (data ?? [])
        .map((w) => {
          const row = w as unknown as {
            id: string; user_id: string; place_id: string; flavour_id: string | null;
            source_review_id: string | null; created_at: string;
            place: PlaceRow | null; flavour: { id: string; name: string; normalized_name: string } | null;
          };
          if (!row.place) return null;
          return {
            id: row.id,
            userId: row.user_id,
            placeId: row.place_id,
            flavourId: row.flavour_id,
            sourceReviewId: row.source_review_id,
            createdAt: row.created_at,
            place: toPlace(row.place),
            flavour: row.flavour ? toFlavour(row.flavour) : null,
          };
        })
        .filter((w): w is NonNullable<typeof w> => w != null);
    },

    async rankings(filters) {
      const uid = me();
      const following = await followingIds();

      let query = client.from('reviews').select(REVIEW_SELECT);
      if (filters.scope === 'mine' && uid) query = query.eq('author_id', uid);
      else if (filters.scope === 'friends') query = query.in('author_id', following.length ? following : ['-']);
      if (filters.authorId) query = query.eq('author_id', filters.authorId);
      if (filters.minHeat != null) query = query.gte('heat', filters.minHeat);
      if (filters.maxHeat != null) query = query.lte('heat', filters.maxHeat);
      if (filters.minScore != null) query = query.gte('final_score', filters.minScore);
      if (filters.flavourId) query = query.eq('flavour_id', filters.flavourId);

      const { data } = await query.order('final_score', { ascending: false }).limit(200);
      let items = await hydrateAll((data ?? []) as never);

      // City lives on the joined place, and component sorts read a column on
      // review_scores, so both are applied after the fetch.
      if (filters.city) items = items.filter((i) => i.place.city === filters.city);
      const key = filters.sortBy ?? 'final';
      if (key !== 'final') {
        items.sort((a, b) => b.review.scores[key] - a.review.scores[key]);
      }
      return items;
    },

    async discoverMarkers(filters) {
      const uid = me();
      const following = new Set(await followingIds());

      if (filters.owner === 'wantToTry') {
        return (await this.listWantToTry()).map((w) => ({
          place: w.place,
          owner: 'wantToTry' as const,
          label: '♥',
        }));
      }

      let query = client
        .from('reviews')
        .select('id, author_id, place_id, final_score, heat, flavour_id, place:places(*)')
        .gte('heat', filters.minHeat)
        .lte('heat', filters.maxHeat)
        .gte('final_score', filters.minScore);
      if (filters.flavourId) query = query.eq('flavour_id', filters.flavourId);
      if (filters.owner === 'mine' && uid) query = query.eq('author_id', uid);
      else if (filters.owner === 'friends') {
        query = query.in('author_id', following.size ? [...following] : ['-']);
      } else if (filters.owner === 'mine+friends') {
        const ids = [...following, ...(uid ? [uid] : [])];
        query = query.in('author_id', ids.length ? ids : ['-']);
      }

      const { data } = await query.limit(500);
      const byPlace = new Map<ID, { place: Place; mine: number | null; friend: number | null; any: number }>();

      for (const raw of data ?? []) {
        const row = raw as unknown as {
          author_id: string; place_id: string; final_score: string | number; place: PlaceRow | null;
        };
        if (!row.place) continue;
        const score = num(row.final_score);
        const entry = byPlace.get(row.place_id) ?? {
          place: toPlace(row.place),
          mine: null,
          friend: null,
          any: score,
        };
        if (row.author_id === uid) entry.mine = score;
        else if (following.has(row.author_id)) entry.friend = entry.friend ?? score;
        byPlace.set(row.place_id, entry);
      }

      return [...byPlace.values()].map((e) => ({
        place: e.place,
        owner: e.mine != null ? ('mine' as const) : e.friend != null ? ('friends' as const) : ('community' as const),
        label: (e.mine ?? e.friend ?? e.any).toFixed(1),
      }));
    },

    async placeDetail(placeId) {
      const uid = me();
      const [{ data: placeRow }, { data: reviewRows }, { data: want }] = await Promise.all([
        client.from('places').select('*').eq('id', placeId).maybeSingle(),
        client
          .from('reviews')
          .select('id, author_id, flavour_id, final_score, heat, created_at, scores:review_scores(*), photos:review_photos(url, position), flavour:wing_flavours(id, name, normalized_name)')
          .eq('place_id', placeId),
        uid
          ? client.from('want_to_try').select('id').eq('user_id', uid).eq('place_id', placeId).limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      if (!placeRow) return null;

      const following = new Set(await followingIds());
      const rows = (reviewRows ?? []) as unknown as {
        id: string; author_id: string; flavour_id: string; final_score: string | number;
        heat: number; created_at: string;
        scores: Record<string, string | number> | null;
        photos: { url: string; position: number }[];
        flavour: { id: string; name: string; normalized_name: string } | null;
      }[];

      const friends = rows.filter((r) => following.has(r.author_id));
      const mine = rows.find((r) => r.author_id === uid);

      // Computed live rather than read from the materialised view, which only
      // refreshes on demand and would show a stale average right after a post.
      const avg = (pick: (r: (typeof rows)[number]) => number) =>
        rows.length ? round1(rows.reduce((a, r) => a + pick(r), 0) / rows.length) : 0;

      const community: Aggregate | null = rows.length
        ? {
            placeId,
            flavourId: null,
            reviewCount: rows.length,
            avgFinal: avg((r) => num(r.final_score)),
            avgHeat: avg((r) => r.heat),
            avgCook: avg((r) => num(r.scores?.cook)),
            avgFlavour: avg((r) => num(r.scores?.flavour)),
            avgSauce: avg((r) => num(r.scores?.sauce)),
            avgValue: avg((r) => num(r.scores?.value)),
            avgSize: avg((r) => num(r.scores?.size)),
            avgEye: avg((r) => num(r.scores?.eye)),
            avgSides: avg((r) => num(r.scores?.sides)),
            avgDrink: avg((r) => num(r.scores?.drink)),
          }
        : null;

      const counts = new Map<string, number>();
      rows.forEach((r) => counts.set(r.flavour_id, (counts.get(r.flavour_id) ?? 0) + 1));
      const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        place: toPlace(placeRow as PlaceRow),
        myReview: mine
          ? ({ id: mine.id, finalScore: num(mine.final_score) } as Review)
          : null,
        friendAverage: friends.length
          ? round1(friends.reduce((a, r) => a + num(r.final_score), 0) / friends.length)
          : null,
        community,
        topFlavour: rows.find((r) => r.flavour_id === topId)?.flavour
          ? toFlavour(rows.find((r) => r.flavour_id === topId)!.flavour!)
          : null,
        photoUrl: rows.flatMap((r) => r.photos ?? []).sort((a, b) => a.position - b.position)[0]?.url ?? null,
        wantToTry: Boolean(want?.length),
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

import { Suspense, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useQuery, useStore } from '../../hooks/useStore';
import { EmptyState, Spinner } from '../../components/States';
import { mapProvider, type MapViewport } from '../../lib/map';
import type { Theme } from '../../hooks/useTheme';
import { compact } from '../../lib/format';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import { RankingsScreen } from '../rankings/RankingsScreen';
import { EditProfile } from './EditProfile';
import { FollowRequests } from './FollowRequests';

type Tab = 'posts' | 'rankings' | 'map';

export function ProfileScreen({
  userId,
  theme,
  onOpenProfile,
  onOpenPost,
}: {
  userId: string;
  theme: Theme;
  onOpenProfile?: (id: string) => void;
  onOpenPost?: (reviewId: string) => void;
}) {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('posts');
  const [editing, setEditing] = useState(false);
  const [viewport, setViewport] = useState<MapViewport>({
    center: { lat: 43.6597, lng: -79.4056 },
    zoom: 11,
  });

  const profileQuery = useQuery([userId], (s) => s.getProfile(userId));
  const reviewQuery = useQuery([userId], (s) => s.reviewsByAuthor(userId));
  const followQuery = useQuery([userId], (s) => s.followState(userId));
  const placeQuery = useQuery([userId], async (s) => {
    // The profile map needs coordinates, which live on the place, not the review.
    const markers = await s.discoverMarkers({
      owner: 'everyone', minHeat: 1, maxHeat: 5, minScore: 0, flavourId: null,
    });
    return new Map(markers.map((m) => [m.place.id, m.place]));
  });

  const profile = profileQuery.data;
  const reviews = reviewQuery.data ?? [];
  const followState = followQuery.data ?? 'none';
  const isMe = userId === store.currentUserId();

  if (profileQuery.loading && !profile) return <Spinner label="Loading profile" />;
  if (!profile) return <EmptyState title="Profile not found" />;

  // Private accounts keep their metadata visible; the content behind it is gated.
  const locked = profile.isPrivate && !isMe && followState !== 'following';
  const { Surface } = mapProvider;

  return (
    <div className="pb-4">
      <div className="px-4 pt-5 text-center">
        <div className="mx-auto w-fit">
          <Avatar src={profile.avatarUrl} alt={profile.username} size={90} ring />
        </div>
        <h1 className="mt-2.5 text-lg font-black">@{profile.username}</h1>
        {profile.displayName && profile.displayName !== 'You' && (
          <p className="text-[13px] font-semibold text-muted">{profile.displayName}</p>
        )}
        <p className="mx-auto mt-1 max-w-[36ch] text-xs text-muted">{profile.bio}</p>
        {profile.isPrivate && (
          <p className="mt-1.5 inline-block rounded-full bg-surface2 px-2.5 py-1 text-[10px] font-bold text-muted">
            🔒 Private account
          </p>
        )}

        <div className="mt-4 grid grid-cols-3">
          {[
            ['Reviews', profile.reviewCount],
            ['Followers', profile.followerCount],
            ['Following', profile.followingCount],
          ].map(([label, n]) => (
            <div key={label as string}>
              <p className="text-lg font-black tabular-nums">{compact(n as number)}</p>
              <p className="text-[10px] font-semibold text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          {isMe ? (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-xl border border-line bg-surface py-2.5 text-xs font-extrabold"
            >
              Edit profile
            </button>
          ) : (
            <button
              onClick={() => void store.toggleFollow(userId)}
              className={`w-full rounded-xl py-2.5 text-xs font-extrabold ${
                followState === 'following'
                  ? 'border border-line bg-surface text-text'
                  : followState === 'requested'
                    ? 'border border-line bg-surface2 text-muted'
                    : 'bg-gradient-to-br from-orange to-gold text-white'
              }`}
            >
              {followState === 'following'
                ? 'Following'
                : followState === 'requested'
                  ? 'Requested'
                  : profile.isPrivate
                    ? 'Request to follow'
                    : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} />}

      {isMe && onOpenProfile && <FollowRequests onOpenProfile={onOpenProfile} />}

      <div className="mt-4 grid grid-cols-3 border-y border-line">
        {(['posts', 'rankings', 'map'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`py-3 text-[11px] font-extrabold capitalize ${
              tab === t ? 'border-b-2 border-text text-text' : 'text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {locked ? (
        <div className="px-8 py-16 text-center">
          <p className="text-sm font-bold">This account is private.</p>
          <p className="mt-1.5 text-xs text-muted">
            {followState === 'requested'
              ? `@${profile.username} has to approve your request before you can see their posts, rankings and map.`
              : `Follow @${profile.username} to see their posts, rankings and map.`}
          </p>
        </div>
      ) : tab === 'posts' ? (
        <div className="grid grid-cols-3 gap-0.5">
          {reviews.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenPost?.(r.id)}
              aria-label={`Open review scoring ${r.finalScore.toFixed(1)}`}
              className="relative aspect-square w-full overflow-hidden bg-surface2 active:opacity-80"
            >
              <img
                src={sized(r.photos[0]?.url, IMAGE_WIDTHS.grid)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                {r.finalScore.toFixed(1)}
              </span>
            </button>
          ))}
          {reviews.length === 0 && (
            <div className="col-span-3">
              <EmptyState title="No posts yet" />
            </div>
          )}
        </div>
      ) : tab === 'rankings' ? (
        <RankingsScreen userId={userId} />
      ) : (
        <div className="mx-3 mt-3 overflow-hidden rounded-xl3 border border-line">
          <Suspense
            fallback={
              <div className="grid h-[52vh] min-h-[360px] place-items-center bg-[var(--map)]">
                <Spinner label="Loading map" />
              </div>
            }
          >
          <Surface
            viewport={viewport}
            markers={reviews.flatMap((r) => {
              const place = placeQuery.data?.get(r.placeId);
              if (!place) return [];
              return [{
                id: r.id,
                lat: place.lat,
                lng: place.lng,
                owner: isMe ? ('mine' as const) : ('friends' as const),
                label: r.finalScore.toFixed(1),
              }];
            })}
            theme={theme}
            onMarkerClick={() => {}}
            onViewportChange={setViewport}
            className="h-[52vh] min-h-[360px]"
          />
          </Suspense>
        </div>
      )}
    </div>
  );
}

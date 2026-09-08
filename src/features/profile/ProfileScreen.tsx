import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useStore, useStoreSnapshot } from '../../hooks/useStore';
import { mapProvider, type MapViewport } from '../../lib/map';
import type { Theme } from '../../hooks/useTheme';
import { compact } from '../../lib/format';
import { RankingsScreen } from '../rankings/RankingsScreen';

type Tab = 'posts' | 'rankings' | 'map';

export function ProfileScreen({ userId, theme }: { userId: string; theme: Theme }) {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('posts');
  const [viewport, setViewport] = useState<MapViewport>({
    center: { lat: 43.6597, lng: -79.4056 },
    zoom: 11,
  });

  const profile = useStoreSnapshot((s) => s.getProfile(userId));
  const reviews = useStoreSnapshot((s) => s.reviewsByAuthor(userId));
  const followState = useStoreSnapshot((s) => s.followState(userId));
  const isMe = userId === store.currentUserId();

  if (!profile) return <p className="p-8 text-center text-sm text-muted">Profile not found.</p>;

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
            <button className="w-full rounded-xl border border-line bg-surface py-2.5 text-xs font-extrabold">
              Edit profile
            </button>
          ) : (
            <button
              onClick={() => store.toggleFollow(userId)}
              className={`w-full rounded-xl py-2.5 text-xs font-extrabold ${
                followState === 'following'
                  ? 'border border-line bg-surface text-text'
                  : 'bg-gradient-to-br from-orange to-gold text-white'
              }`}
            >
              {followState === 'following'
                ? 'Following'
                : profile.isPrivate
                  ? 'Request to follow'
                  : 'Follow'}
            </button>
          )}
        </div>
      </div>

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
            Follow @{profile.username} to see their posts, rankings and map.
          </p>
        </div>
      ) : tab === 'posts' ? (
        <div className="grid grid-cols-3 gap-0.5">
          {reviews.map((r) => (
            <img
              key={r.id}
              src={r.photos[0]?.url}
              alt=""
              loading="lazy"
              className="aspect-square w-full bg-surface2 object-cover"
            />
          ))}
          {reviews.length === 0 && (
            <p className="col-span-3 py-16 text-center text-sm text-muted">No posts yet.</p>
          )}
        </div>
      ) : tab === 'rankings' ? (
        <RankingsScreen userId={userId} />
      ) : (
        <div className="mx-3 mt-3 overflow-hidden rounded-xl3 border border-line">
          <Surface
            viewport={viewport}
            markers={reviews.map((r) => {
              const place = store.getPlace(r.placeId)!;
              return {
                id: r.id,
                lat: place.lat,
                lng: place.lng,
                owner: isMe ? ('mine' as const) : ('friends' as const),
                label: r.finalScore.toFixed(1),
              };
            })}
            theme={theme}
            onMarkerClick={() => {}}
            onViewportChange={setViewport}
            className="h-[52vh] min-h-[360px]"
          />
        </div>
      )}
    </div>
  );
}

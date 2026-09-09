import { Avatar } from '../../components/Avatar';
import { ErrorState, PostSkeleton } from '../../components/States';
import { useQuery } from '../../hooks/useStore';
import { PostCard } from './PostCard';

/** Posts from people you follow, newest first. */
export function FeedScreen({
  onOpenProfile,
  onFindPeople,
}: {
  onOpenProfile: (id: string) => void;
  onFindPeople: () => void;
}) {
  const feed = useQuery([], (s) => s.feed());
  const following = useQuery([], (s) => s.followingProfiles());

  if (feed.error) return <ErrorState error={feed.error} onRetry={feed.refetch} />;

  return (
    <div className="pb-4">
      <div className="hide-scrollbar flex gap-3.5 overflow-x-auto px-4 py-3">
        <button onClick={onFindPeople} className="w-[64px] shrink-0 text-center" aria-label="Find people">
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full border border-dashed border-line bg-surface text-2xl text-muted">
            +
          </span>
          <span className="mt-1 block truncate text-[10px] font-semibold text-muted">Find people</span>
        </button>
        {(following.data ?? []).length > 0 && (
          <>
            {following.data!.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProfile(p.id)}
                className="w-[64px] shrink-0 text-center"
              >
                <Avatar src={p.avatarUrl} alt="" size={62} ring />
                <span className="mt-1 block truncate text-[10px] font-semibold text-muted">
                  {p.username}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {feed.data === undefined ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : feed.data.length === 0 ? (
        <div className="px-8 py-14 text-center">
          <p className="text-sm font-bold">Nothing here yet</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Your feed shows wings from people you follow.
          </p>
          <button
            onClick={onFindPeople}
            className="mt-5 rounded-xl bg-gradient-to-br from-orange to-gold px-5 py-2.5 text-xs font-extrabold text-white shadow-glow"
          >
            Find people to follow
          </button>
        </div>
      ) : (
        feed.data.map((item) => (
          <PostCard key={item.review.id} item={item} onOpenProfile={onOpenProfile} />
        ))
      )}
    </div>
  );
}

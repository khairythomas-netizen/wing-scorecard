import { Avatar } from '../../components/Avatar';
import { EmptyState, ErrorState, PostSkeleton } from '../../components/States';
import { useQuery } from '../../hooks/useStore';
import { PostCard } from './PostCard';

/** Posts from people you follow, newest first. */
export function FeedScreen({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const feed = useQuery([], (s) => s.feed());
  const following = useQuery([], (s) => s.followingProfiles());

  if (feed.error) return <ErrorState error={feed.error} onRetry={feed.refetch} />;

  return (
    <div className="pb-4">
      {(following.data ?? []).length > 0 && (
        <div className="hide-scrollbar flex gap-3.5 overflow-x-auto px-4 py-3">
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
        </div>
      )}

      {feed.data === undefined ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : feed.data.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          detail="Follow a few people, or publish your first review from the Rate tab."
        />
      ) : (
        feed.data.map((item) => (
          <PostCard key={item.review.id} item={item} onOpenProfile={onOpenProfile} />
        ))
      )}
    </div>
  );
}

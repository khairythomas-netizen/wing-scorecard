import { Avatar } from '../../components/Avatar';
import { useStoreSnapshot } from '../../hooks/useStore';
import { PostCard } from './PostCard';

/** Posts from people you follow, newest first. */
export function FeedScreen({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const items = useStoreSnapshot((s) => s.feed());
  const following = useStoreSnapshot((s) =>
    s.followingIds().map((id) => s.getProfile(id)!).filter(Boolean),
  );

  return (
    <div className="pb-4">
      <div className="hide-scrollbar flex gap-3.5 overflow-x-auto px-4 py-3">
        {following.map((p) => (
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

      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted">
          Nothing here yet. Follow a few people, or publish your first review.
        </p>
      ) : (
        items.map((item) => (
          <PostCard key={item.review.id} item={item} onOpenProfile={onOpenProfile} />
        ))
      )}
    </div>
  );
}

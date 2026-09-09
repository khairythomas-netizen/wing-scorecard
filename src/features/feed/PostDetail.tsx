import { ChevronIcon } from '../../components/Icons';
import { EmptyState, ErrorState, PostSkeleton } from '../../components/States';
import { useQuery } from '../../hooks/useStore';
import { PostCard } from './PostCard';

/**
 * A single post on its own screen, reached by tapping a photo in a profile
 * grid. Reuses PostCard so a post looks and behaves identically wherever it
 * appears — same carousel, same score breakdown, same comments.
 */
export function PostDetail({
  reviewId,
  onBack,
  onOpenProfile,
}: {
  reviewId: string;
  onBack: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const post = useQuery([reviewId], (s) => s.feedItem(reviewId));

  return (
    <div className="pb-4">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-extrabold text-muted"
          aria-label="Back"
        >
          <ChevronIcon className="h-4 w-4 rotate-180" />
          Back
        </button>
      </div>

      {post.error ? (
        <ErrorState error={post.error} onRetry={post.refetch} />
      ) : post.data === undefined ? (
        <PostSkeleton />
      ) : post.data === null ? (
        <EmptyState
          title="This post is not available"
          detail="It may have been deleted, or the account is private."
        />
      ) : (
        <PostCard item={post.data} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}

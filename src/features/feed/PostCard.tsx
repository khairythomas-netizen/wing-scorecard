import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { HeatMeter } from '../../components/HeatMeter';
import { BookmarkIcon, CommentIcon, HeartIcon } from '../../components/Icons';
import { ReviewBreakdown } from '../../components/ReviewBreakdown';
import { ScoreBadge } from '../../components/ScoreBadge';
import { Sheet } from '../../components/Sheet';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { BREADING_LABEL, STYLE_LABEL, compact, formatPrice, timeAgo } from '../../lib/format';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import type { FeedItem } from '../../lib/types';

/**
 * The photo is the post. Everything structured hangs around it rather than
 * competing with it, and the score is a tap away from its full breakdown.
 */
export function PostCard({
  item,
  onOpenProfile,
  onEdit,
}: {
  item: FeedItem;
  onOpenProfile: (id: string) => void;
  onEdit?: (reviewId: string) => void;
}) {
  const store = useStore();
  const toast = useToast();
  const { review, author, place, flavour } = item;

  const [index, setIndex] = useState(0);
  const [breakdown, setBreakdown] = useState(false);
  const [comments, setComments] = useState(false);
  const [draft, setDraft] = useState('');
  const commentList = useQuery([review.id, comments], async (s) =>
    comments ? s.listComments(review.id) : [],
  );

  const photos = review.photos;

  return (
    <article className="border-t border-line pb-4">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => onOpenProfile(author.id)} aria-label={`Open ${author.username}`}>
          <Avatar src={author.avatarUrl} alt="" size={36} ring />
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenProfile(author.id)}
            className="block truncate text-[13px] font-extrabold"
          >
            {author.username}
          </button>
          <p className="truncate text-[10px] font-semibold text-muted">
            {place.displayName} · {place.city}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-muted">
          {timeAgo(review.createdAt)}
        </span>
        {onEdit && review.authorId === store.currentUserId() && (
          <button
            onClick={() => onEdit(review.id)}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-extrabold text-muted"
          >
            Edit
          </button>
        )}
      </header>

      <div className="relative">
        <div
          className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {photos.map((p) => (
            <img
              key={p.id}
              src={sized(p.url, IMAGE_WIDTHS.feed)}
              alt={`${flavour.name} wings at ${place.displayName}`}
              loading="lazy"
              className="aspect-square w-full shrink-0 snap-center bg-surface2 object-cover"
            />
          ))}
        </div>

        {/* A count on the photo itself. The dots alone were four pixels of
            near-background colour below the image, which told nobody there was
            anything to swipe to. */}
        {photos.length > 1 && (
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white backdrop-blur-sm">
            {index + 1}/{photos.length}
          </span>
        )}

        {/* Dots sit on the photo too, over a scrim, so they read on a light
            image and a dark one alike rather than borrowing the theme. */}
        {photos.length > 1 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
            aria-hidden
          >
            {photos.map((p, i) => (
              <span
                key={p.id}
                className={`h-1.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,.6)] transition-all ${
                  i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 px-3 pb-1 pt-2">
        <button
          onClick={() => void store.toggleLike(review.id)}
          aria-label={item.likedByMe ? 'Unlike' : 'Like'}
          className={item.likedByMe ? 'text-danger' : ''}
        >
          <HeartIcon filled={item.likedByMe} />
        </button>
        <button onClick={() => setComments(true)} aria-label="Comments">
          <CommentIcon />
        </button>
        <button
          onClick={async () => {
            const on = await store.toggleWantToTry(place.id, flavour.id, review.id);
            toast(on ? 'Added to Want to Try' : 'Removed from Want to Try');
          }}
          className={`ml-auto text-[11px] font-extrabold ${item.wantToTry ? 'text-violet' : 'text-muted'}`}
        >
          {item.wantToTry ? '♥ Want to Try' : '+ Want to Try'}
        </button>
        <button
          onClick={() => void store.toggleSave(review.id)}
          aria-label={item.savedByMe ? 'Unsave' : 'Save'}
          className={item.savedByMe ? 'text-text' : ''}
        >
          <BookmarkIcon filled={item.savedByMe} />
        </button>
      </div>

      <div className="px-3">
        <p className="text-[12px] font-bold">{compact(review.likeCount)} likes</p>

        <div className="mt-2 flex items-center gap-2.5">
          <ScoreBadge score={review.finalScore} onClick={() => setBreakdown(true)} />
          <HeatMeter value={review.heat} size={13} />
        </div>

        <p className="mt-2 text-[14px] font-extrabold leading-tight">{review.orderText}</p>
        <p className="mt-0.5 text-[12px] text-muted">
          {[flavour.name, formatPrice(review.priceCents, review.currency), place.displayName]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {[STYLE_LABEL[review.style], BREADING_LABEL[review.breading]].map((t) => (
            <span
              key={t}
              className="rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted"
            >
              {t}
            </span>
          ))}
        </p>

        {review.caption && (
          <p className="mt-2 text-[13px] leading-relaxed">
            <span className="font-extrabold">{author.username}</span> {review.caption}
          </p>
        )}

        {review.commentCount > 0 && (
          <button
            onClick={() => setComments(true)}
            className="mt-1.5 text-[11px] font-semibold text-muted"
          >
            View all {review.commentCount} comments
          </button>
        )}
      </div>

      <Sheet open={breakdown} onClose={() => setBreakdown(false)} title="Score breakdown">
        <ReviewBreakdown review={review} />
      </Sheet>

      <Sheet open={comments} onClose={() => setComments(false)} title="Comments">
        <div className="space-y-3">
          {(commentList.data ?? []).map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar src={c.author.avatarUrl} alt="" size={30} />
              <p className="text-[13px] leading-relaxed">
                <span className="font-extrabold">{c.author.username}</span> {c.body}
              </p>
            </div>
          ))}
          {commentList.data?.length === 0 && (
            <p className="text-[13px] text-muted">No comments yet.</p>
          )}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void store.addComment(review.id, draft);
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[13px] outline-none focus:border-orange"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-xl bg-orange px-4 text-[13px] font-extrabold text-white disabled:opacity-40"
          >
            Post
          </button>
        </form>
      </Sheet>
    </article>
  );
}

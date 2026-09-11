import { useEffect } from 'react';
import { Avatar } from '../../components/Avatar';
import { EmptyState, Spinner } from '../../components/States';
import { useQuery, useStore } from '../../hooks/useStore';
import { timeAgo } from '../../lib/format';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import type { AppNotification } from '../../lib/db/store';

function sentence(n: AppNotification): string {
  const who = n.actor ? `@${n.actor.username}` : 'Someone';
  switch (n.kind) {
    case 'like':
      return `${who} liked your wings`;
    case 'comment':
      return `${who} commented on your post`;
    case 'follow':
      return `${who} started following you`;
    case 'follow_request':
      return `${who} asked to follow you`;
    case 'follow_accepted':
      return `${who} accepted your follow request`;
  }
}

export function NotificationsScreen({
  onOpenProfile,
  onOpenPost,
}: {
  onOpenProfile: (id: string) => void;
  onOpenPost: (reviewId: string) => void;
}) {
  const store = useStore();
  const query = useQuery([], (s) => s.listNotifications());
  const rows = query.data ?? [];

  // Opening the screen is the act of reading them. Marking on arrival rather
  // than per row keeps the badge honest without making anyone tap anything.
  useEffect(() => {
    void store.markNotificationsRead();
  }, [store]);

  if (query.loading && !query.data) return <Spinner label="Loading notifications" />;

  if (rows.length === 0) {
    return (
      <EmptyState title="Nothing yet" detail="Likes, comments and follows will show up here." />
    );
  }

  return (
    <div>
      {rows.map((n) => (
        <button
          key={n.id}
          onClick={() => {
            if (n.reviewId) onOpenPost(n.reviewId);
            else if (n.actor) onOpenProfile(n.actor.id);
          }}
          className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${
            n.read ? '' : 'bg-surface2/60'
          }`}
        >
          <Avatar src={n.actor?.avatarUrl ?? ''} alt="" size={38} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-snug">{sentence(n)}</span>
            <span className="mt-0.5 block text-[10px] font-semibold text-muted">
              {timeAgo(n.createdAt)}
            </span>
          </span>
          {n.reviewPhotoUrl && (
            <img
              src={sized(n.reviewPhotoUrl, IMAGE_WIDTHS.thumb)}
              alt=""
              loading="lazy"
              className="h-11 w-11 shrink-0 rounded-lg bg-surface2 object-cover"
            />
          )}
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-orange" />}
        </button>
      ))}
    </div>
  );
}

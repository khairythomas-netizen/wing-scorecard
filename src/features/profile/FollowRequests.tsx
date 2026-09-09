import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';

/**
 * Incoming requests to follow a private account.
 *
 * Only rendered on your own profile, and only when something is waiting —
 * an empty "no requests" panel is noise on a screen that is mostly photos.
 */
export function FollowRequests({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const store = useStore();
  const toast = useToast();
  const requests = useQuery([], (s) => s.incomingFollowRequests());
  const [busy, setBusy] = useState<string | null>(null);

  const rows = requests.data ?? [];
  if (rows.length === 0) return null;

  const act = async (id: string, approve: boolean, username: string) => {
    setBusy(id);
    try {
      if (approve) await store.approveFollowRequest(id);
      else await store.rejectFollowRequest(id);
      toast(approve ? `${username} can now see your wings` : 'Request declined');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the request');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="border-b border-line px-4 py-3">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
        Follow requests
        <span className="ml-1.5 rounded-full bg-orange px-1.5 py-0.5 text-[10px] text-white">
          {rows.length}
        </span>
      </h2>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5">
            <button onClick={() => onOpenProfile(r.requester.id)} aria-label={`Open ${r.requester.username}`}>
              <Avatar src={r.requester.avatarUrl} alt="" size={38} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onOpenProfile(r.requester.id)}
                className="block truncate text-[13px] font-extrabold"
              >
                {r.requester.username}
              </button>
              <p className="truncate text-[11px] text-muted">
                {r.requester.displayName || 'wants to follow you'}
              </p>
            </div>
            <button
              disabled={busy === r.id}
              onClick={() => void act(r.id, true, r.requester.username)}
              className="shrink-0 rounded-lg bg-gradient-to-br from-orange to-gold px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy === r.id}
              onClick={() => void act(r.id, false, r.requester.username)}
              className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-extrabold text-muted disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

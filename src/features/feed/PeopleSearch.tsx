import { useEffect, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { CloseIcon } from '../../components/Icons';
import { Spinner } from '../../components/States';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import type { Profile } from '../../lib/types';

/**
 * Finding people to follow. Without this, following depended on happening
 * across someone's post, which made an empty feed self-perpetuating.
 */
export function PeopleSearch({
  open,
  onClose,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  // With no query this suggests people you are not already following.
  const results = useQuery([debounced], (s) =>
    debounced.trim() ? s.searchProfiles(debounced) : s.listSuggestedProfiles(),
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-bg">
      <div className="app-header sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-[var(--glass)] px-3 backdrop-blur-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by username"
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-orange"
        />
        <button onClick={onClose} aria-label="Close" className="shrink-0 p-1.5 text-muted">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="app-scroll overflow-y-auto">
        {!debounced.trim() && (
          <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
            Suggested
          </p>
        )}
        {results.data === undefined ? (
          <Spinner label="Searching" />
        ) : results.data.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">
            {debounced.trim() ? `No one matching “${debounced}”.` : 'No one to suggest yet.'}
          </p>
        ) : (
          results.data.map((p) => (
            <PersonRow key={p.id} profile={p} onOpenProfile={onOpenProfile} onNavigate={onClose} />
          ))
        )}
      </div>
    </div>
  );
}

function PersonRow({
  profile,
  onOpenProfile,
  onNavigate,
}: {
  profile: Profile;
  onOpenProfile: (id: string) => void;
  onNavigate: () => void;
}) {
  const store = useStore();
  const toast = useToast();
  const state = useQuery([profile.id], (s) => s.followState(profile.id));
  const [busy, setBusy] = useState(false);

  const label =
    state.data === 'following' ? 'Following' : state.data === 'requested' ? 'Requested' : 'Follow';

  const act = async () => {
    setBusy(true);
    try {
      const next = await store.toggleFollow(profile.id);
      if (next === 'requested') toast(`Requested to follow ${profile.username}`);
      else if (next === 'following') toast(`Following ${profile.username}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
      <button
        onClick={() => {
          onOpenProfile(profile.id);
          onNavigate();
        }}
        aria-label={`Open ${profile.username}`}
      >
        <Avatar src={profile.avatarUrl} alt="" size={42} />
      </button>
      <button
        onClick={() => {
          onOpenProfile(profile.id);
          onNavigate();
        }}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-[13px] font-extrabold">{profile.username}</span>
        <span className="block truncate text-[11px] text-muted">
          {profile.displayName || `${profile.reviewCount} reviews`}
          {profile.isPrivate && ' · 🔒'}
        </span>
      </button>
      <button
        onClick={() => void act()}
        disabled={busy || state.data === undefined}
        className={`shrink-0 rounded-lg px-3.5 py-1.5 text-[11px] font-extrabold disabled:opacity-50 ${
          label === 'Follow'
            ? 'bg-gradient-to-br from-orange to-gold text-white'
            : 'border border-line bg-surface text-text'
        }`}
      >
        {label}
      </button>
    </div>
  );
}

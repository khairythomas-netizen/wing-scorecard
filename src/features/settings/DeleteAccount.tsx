import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';

const CONFIRM = 'DELETE';

/**
 * Deleting your account for good.
 *
 * The App Store requires this to be reachable from inside the app, and
 * requires that it really deletes rather than deactivates. It is irreversible,
 * so it asks you to type the word: a second tap is too easy to do by accident
 * with something this final.
 */
export function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await store.deleteMyAccount();
      // No toast: the account is gone and the app drops back to the sign-in
      // screen, which says it more clearly than a message would.
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the account');
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Delete my account">
      <div className="px-1 pb-2">
        <p className="text-[13px] leading-relaxed">
          This removes your account, your reviews, your photos, your comments and
          everything else tied to you. It cannot be undone and there is no way to get any
          of it back.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Wanted a break instead? Signing out leaves everything where it is.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">
            Type {CONFIRM} to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={CONFIRM}
            className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-danger"
          />
        </label>

        <button
          onClick={() => void remove()}
          disabled={typed.trim().toUpperCase() !== CONFIRM || busy}
          className="mt-4 w-full rounded-xl bg-danger py-3 text-sm font-black text-white disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete my account for good'}
        </button>
      </div>
    </Sheet>
  );
}

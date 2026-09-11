import { useState, type FormEvent } from 'react';
import { BrandLockup } from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { friendlyAuthError } from '../../lib/auth/types';

/**
 * Shown when the app is opened from a password reset link.
 *
 * Supabase signs the person in to make this possible, so this screen stands
 * between that session and the rest of the app: arriving from an emailed link
 * proves they read the inbox, not that they chose a password they can use
 * again tomorrow.
 */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const { client } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await client.updatePassword(password);
      onDone();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="safe-screen min-h-app mx-auto flex w-full max-w-[440px] flex-col justify-center px-6">
      <div className="mb-8 flex justify-center">
        <BrandLockup />
      </div>
      <div className="animate-rise">
        <h1 className="text-2xl font-black tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">
          You are signed in from the link in your email. Set a password and you are back in.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">New password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">Again</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it once more"
              className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
            />
          </label>

          {mismatch && (
            <p className="text-[12px] font-semibold text-danger">Those two do not match.</p>
          )}
          {error && <p className="text-[12px] font-semibold text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || mismatch || password.length < 6}
            className="w-full rounded-xl bg-gradient-to-br from-orange to-gold py-3.5 text-sm font-black text-white shadow-glow disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}

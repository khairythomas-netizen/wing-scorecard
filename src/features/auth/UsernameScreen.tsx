import { useEffect, useState, type FormEvent } from 'react';
import { BrandLockup } from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { friendlyAuthError, suggestUsername, validateUsername } from '../../lib/auth/types';

/**
 * Second half of signup. A profile row already exists at this point; this
 * claims the @username, which is the identity everything social hangs off.
 */
export function UsernameScreen() {
  const { client, reload, user, profile } = useAuth();
  const [value, setValue] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = value.trim().toLowerCase();
  const formatError = normalized ? validateUsername(normalized) : null;

  // Offer the suggestion only if it is actually free. Prefilling a taken name
  // would replace a blank field with an error, which is worse than blank.
  useEffect(() => {
    const candidate = suggestUsername(profile?.displayName ?? '', user?.email ?? '');
    if (!candidate) return;
    let live = true;
    void client.isUsernameAvailable(candidate).then((free) => {
      // Never overwrite typing that started while the check was in flight.
      if (live && free) setValue((current) => (current === '' ? candidate : current));
    });
    return () => {
      live = false;
    };
    // Runs once per sign-in; the field is the person's from then on.
  }, [client, profile?.displayName, user?.email]);

  // Debounced availability check, so the field answers before submission.
  useEffect(() => {
    if (!normalized || formatError) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const ok = await client.isUsernameAvailable(normalized);
      if (cancelled) return;
      setAvailable(ok);
      setChecking(false);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setChecking(false);
    };
  }, [normalized, formatError, client]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (formatError) return;
    setBusy(true);
    setError(null);
    try {
      await client.claimUsername(normalized);
      await reload();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const status = formatError
    ? { text: formatError, tone: 'text-danger' }
    : checking
      ? { text: 'Checking…', tone: 'text-muted' }
      : available === true
        ? { text: `@${normalized} is available`, tone: 'text-green' }
        : available === false
          ? { text: 'That username is taken.', tone: 'text-danger' }
          : { text: 'Letters, numbers, dot and underscore.', tone: 'text-muted' };

  return (
    <div className="safe-screen min-h-app mx-auto flex w-full max-w-[440px] flex-col justify-center px-6">
      <div className="mb-8 flex justify-center">
        <BrandLockup />
      </div>
      <div className="animate-rise">
        <h1 className="text-2xl font-black tracking-tight">Pick your username</h1>
        <p className="mt-1.5 text-sm text-muted">
          This is how people find you and your rankings.
        </p>

        <form onSubmit={submit} className="mt-6">
          <div className="flex items-center rounded-xl2 border border-line bg-surface px-3.5 focus-within:border-orange">
            <span className="text-sm font-bold text-muted">@</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="wingfiend"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent py-3 pl-1 text-sm outline-none"
            />
          </div>

          <p className={`mt-2 text-[11px] font-semibold ${status.tone}`}>{status.text}</p>
          {error && <p className="mt-1 text-[12px] font-semibold text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || Boolean(formatError) || available === false || !normalized}
            className="mt-5 w-full rounded-xl bg-gradient-to-br from-orange to-gold py-3.5 text-sm font-black text-white shadow-glow disabled:opacity-50"
          >
            {busy ? 'Claiming…' : 'Continue'}
          </button>
        </form>

        <button
          onClick={() => void client.signOut()}
          className="mt-5 w-full text-[12px] font-semibold text-muted"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

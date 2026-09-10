import { useEffect, useState, type FormEvent } from 'react';
import { BrandLockup } from '../../components/Brand';
import { useAuth } from '../../hooks/useAuth';
import { friendlyAuthError, type OAuthProvider } from '../../lib/auth/types';
import { ProviderButton } from './ProviderButton';

type Mode = 'signIn' | 'signUp';

/** The wall shown when a Supabase project is attached and nobody is signed in. */
export function AuthScreen() {
  const { client, reload } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  // Only offer the providers the project actually has configured, so a button
  // on this screen always leads somewhere.
  useEffect(() => {
    let live = true;
    client
      .enabledProviders()
      .then((list) => {
        if (live) setProviders(list);
      })
      .catch(() => {
        /* email sign-in is unaffected */
      });
    return () => {
      live = false;
    };
  }, [client]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signUp') {
        const { needsEmailConfirmation } = await client.signUp(email.trim(), password);
        if (needsEmailConfirmation) {
          setCheckEmail(true);
          return;
        }
      } else {
        await client.signIn(email.trim(), password);
      }
      await reload();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: OAuthProvider) => {
    setError(null);
    setBusy(true);
    try {
      // On success the browser leaves for the provider and never comes back
      // to this line, so `busy` staying true is correct.
      await client.signInWithProvider(provider);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <Frame>
        <h1 className="text-2xl font-black tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We sent a confirmation link to <span className="font-bold text-text">{email}</span>.
          Open it to finish setting up your account, then come back and sign in.
        </p>
        <button
          onClick={() => {
            setCheckEmail(false);
            setMode('signIn');
          }}
          className="mt-6 w-full rounded-xl border border-line bg-surface py-3 text-sm font-extrabold"
        >
          Back to sign in
        </button>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-2xl font-black tracking-tight">
        {mode === 'signIn' ? 'Welcome back' : 'Start rating wings'}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {mode === 'signIn'
          ? 'Sign in to your wing rankings.'
          : 'Create an account to save and share your reviews.'}
      </p>

      {providers.length > 0 && (
        <>
          <div className="mt-6 space-y-2.5">
            {providers.map((p) => (
              <ProviderButton key={p} provider={p} disabled={busy} onClick={() => social(p)} />
            ))}
          </div>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
              or use email
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`${providers.length ? '' : 'mt-6 '}space-y-3`}>
        <label className="block">
          <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signUp' ? 'At least 6 characters' : '••••••••'}
            className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
          />
        </label>

        {error && <p className="text-[12px] font-semibold text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-br from-orange to-gold py-3.5 text-sm font-black text-white shadow-glow disabled:opacity-60"
        >
          {busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
        }}
        className="mt-5 w-full text-[12px] font-semibold text-muted"
      >
        {mode === 'signIn' ? (
          <>
            New here? <span className="font-extrabold text-text">Create an account</span>
          </>
        ) : (
          <>
            Already have an account? <span className="font-extrabold text-text">Sign in</span>
          </>
        )}
      </button>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-screen min-h-app mx-auto flex w-full max-w-[440px] flex-col justify-center px-6">
      <div className="mb-8 flex justify-center">
        <BrandLockup />
      </div>
      <div className="animate-rise">{children}</div>
      {/* Signing in is the moment someone decides to trust the app, so the
          terms they are agreeing to belong on this screen rather than buried
          in a settings menu. */}
      <p className="mt-8 text-center text-[11px] text-muted">
        <a href={`${import.meta.env.BASE_URL}privacy.html`} className="underline underline-offset-2">
          Privacy
        </a>
        <span className="mx-2">·</span>
        <a href={`${import.meta.env.BASE_URL}terms.html`} className="underline underline-offset-2">
          Terms
        </a>
      </p>
    </div>
  );
}

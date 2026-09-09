import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authClient } from '../lib/auth';
import type { AuthState } from '../lib/auth/types';
import { store } from '../lib/db';

interface AuthContextValue extends AuthState {
  client: typeof authClient;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  const reload = useCallback(async () => {
    const { user, profile } = await authClient.current();

    // The store needs to know who is asking before any query runs, otherwise
    // the first feed fetch would come back empty.
    store.setCurrentUserId(user?.id ?? null);

    // A fresh signup can land here before the profile trigger has committed.
    // One short retry avoids bouncing the user to the username step and back.
    if (user && !profile) {
      await new Promise((r) => setTimeout(r, 400));
      const retry = await authClient.current();
      setState({ user: retry.user, profile: retry.profile, loading: false });
      return;
    }
    setState({ user, profile, loading: false });
  }, []);

  useEffect(() => {
    void reload();
    return authClient.onChange(() => void reload());
  }, [reload]);

  const value = useMemo(
    () => ({ ...state, client: authClient, reload }),
    [state, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

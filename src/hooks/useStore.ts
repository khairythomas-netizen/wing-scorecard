import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { store } from '../lib/db';
import type { WingzStore } from '../lib/db/store';

export { store };

export const StoreContext = createContext<WingzStore>(store);
export const useStore = () => useContext(StoreContext);

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Runs an async store read and keeps it fresh.
 *
 * Refetches when `deps` change and whenever the store reports a write, so a
 * like or a new post updates every open list without any manual invalidation.
 * Stale responses are dropped by sequence number, which matters because
 * filter changes fire overlapping requests.
 */
export function useQuery<T>(
  deps: readonly unknown[],
  run: (s: WingzStore) => Promise<T>,
): QueryResult<T> {
  const s = useStore();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const seq = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;

  const execute = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    runRef
      .current(s)
      .then((result) => {
        if (id !== seq.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (id !== seq.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [s]);

  useEffect(execute, [execute, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => s.subscribe(execute), [s, execute]);

  return { data, loading, error, refetch: execute };
}

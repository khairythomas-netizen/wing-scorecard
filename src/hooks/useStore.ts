import { createContext, useContext, useSyncExternalStore } from 'react';
import { createLocalStore } from '../lib/db/localStore';
import type { WingzStore } from '../lib/db/store';

export const store: WingzStore = createLocalStore();

export const StoreContext = createContext<WingzStore>(store);
export const useStore = () => useContext(StoreContext);

/**
 * Re-render on any store write. The local store is small enough that a single
 * version counter is cheaper than fine-grained subscriptions; the Supabase
 * implementation will swap this for per-query subscriptions.
 */
let version = 0;
const bump = () => {
  version += 1;
};
store.subscribe(bump);

export function useStoreSnapshot<T>(select: (s: WingzStore) => T): T {
  const s = useStore();
  useSyncExternalStore(
    (cb) => s.subscribe(cb),
    () => version,
    () => version,
  );
  return select(s);
}

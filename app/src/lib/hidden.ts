// Plain assets and tokens hidden from a wallet's asset list, per wallet, in this browser only.
// Hiding changes nothing on chain: the coins stay under the wallet's key and can be shown again.
import { useSyncExternalStore } from 'react';

const prefix = 'wharfedale.hidden.v1.';
const listeners = new Set<() => void>();
const cache = new Map<string, readonly string[]>();
const none: readonly string[] = [];

function read(wallet: string): readonly string[] {
  const cached = cache.get(wallet);
  if (cached) return cached;
  let ids: readonly string[] = none;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(prefix + wallet) ?? '[]');
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    // unreadable or unavailable storage: nothing hidden
  }
  cache.set(wallet, ids);
  return ids;
}

function write(wallet: string, ids: readonly string[]) {
  cache.set(wallet, ids);
  try {
    localStorage.setItem(prefix + wallet, JSON.stringify(ids));
  } catch {
    // storage unavailable: hidden for this session only
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The asset ids hidden from `wallet` (its address), and hide/show for them. */
export function useHiddenAssets(wallet: string | undefined) {
  const ids = useSyncExternalStore(subscribe, () => (wallet ? read(wallet) : none));
  return {
    hidden: new Set(ids),
    hide: (id: string) => wallet && !read(wallet).includes(id) && write(wallet, [...read(wallet), id]),
    show: (id: string) => wallet && write(wallet, read(wallet).filter((x) => x !== id)),
  };
}

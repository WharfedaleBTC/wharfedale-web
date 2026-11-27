// Demo wallets, kept in this browser only (localStorage, unencrypted).
import { useMemo, useSyncExternalStore } from 'react';
import { Key } from '@wharfedale/sdk';

export interface StoredWallet {
  name: string;
  /** Recovery phrase, when the wallet came from one. */
  phrase?: string;
  /** Hex secret (derived from the phrase, or imported). */
  secret: string;
}

interface Store {
  active: string | null;
  wallets: StoredWallet[];
}

const KEY = 'wharfedale.wallets.v1';
const listeners = new Set<() => void>();
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '') as Store;
  } catch {
    cache = { active: null, wallets: [] };
  }
  return cache;
}

function write(s: Store) {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: keep the wallet for this session only
  }
  listeners.forEach((l) => l());
}

export const wallets = {
  add(w: StoredWallet) {
    const s = read();
    if (s.wallets.some((x) => x.name === w.name)) throw new Error(`a wallet named "${w.name}" exists`);
    write({ active: w.name, wallets: [...s.wallets, w] });
  },
  remove(name: string) {
    const s = read();
    const rest = s.wallets.filter((w) => w.name !== name);
    write({ active: rest[0]?.name ?? null, wallets: rest });
  },
  select(name: string) {
    write({ ...read(), active: name });
  },
};

export function subscribeWallets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active wallet, outside React (the DAMP signer follows it). */
export function activeStoredWallet(): StoredWallet | null {
  const s = read();
  return s.wallets.find((w) => w.name === s.active) ?? null;
}

export function useWallets() {
  const store = useSyncExternalStore(subscribeWallets, read);
  const active = store.wallets.find((w) => w.name === store.active) ?? null;
  // One Key per wallet, so effects that depend on it don't rerun on every render.
  const secret = active?.secret;
  const key = useMemo(() => (secret ? Key.fromSecret(secret) : null), [secret]);
  return { store, active, key };
}

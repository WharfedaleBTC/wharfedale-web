// Demo wallets, kept in this browser only (localStorage, unencrypted).
import { useSyncExternalStore } from 'react';
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

export function useWallets() {
  const store = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
  );
  const active = store.wallets.find((w) => w.name === store.active) ?? null;
  return { store, active, key: active ? Key.fromSecret(active.secret) : null };
}

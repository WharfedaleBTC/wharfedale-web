import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from '@wharfedale/sdk';
import { client } from './api';
import { useWallets } from './wallets';

/** The active wallet as an SDK Wallet, and its balances (refreshed every 3 s). */
export function useActiveWallet() {
  const { store, active, key } = useWallets();
  const wallet = useMemo(() => (key ? new Wallet(client, key) : null), [active?.secret]); // eslint-disable-line react-hooks/exhaustive-deps
  const balances = useQuery({
    queryKey: ['balances', active?.name, active?.secret],
    enabled: !!wallet,
    refetchInterval: 3_000,
    queryFn: async () => [...(await wallet!.balances()).entries()],
  });
  return { store, active, wallet, balances };
}

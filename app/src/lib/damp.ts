// DAMP regulated assets in this app: DAMP's browser modules (../damp/apps/web/src/lib, aliased
// as @damp) read their chain settings from a runtime configuration and sign with the active
// wallet's recovery phrase. This module sets both up once, the first time a page needs them;
// the signer's WebAssembly (~17 MB) loads only then.
import { useQuery } from '@tanstack/react-query';
import { setRuntimeConfig } from '@damp/runtime-config';
import { setSignerWalletSource, startWalletSigner } from '@damp/damp-signer';
import { normalizePhrase } from '@damp/wallets';
import { client, useConfig, type AppConfig } from './api';
import { activeStoredWallet, subscribeWallets } from './wallets';

let started: Promise<void> | null = null;

async function start(config: AppConfig): Promise<void> {
  const [genesis, chain] = await Promise.all([client.restText('block-height/0'), client.chainInfo()]);
  setRuntimeConfig({
    network: `wharfedale/${genesis.trim()}`,
    nativeAsset: { id: chain.feeAsset, ...config.nativeAsset },
    // The server's allowlisted node proxy (Esplora GET routes and POST /tx) and the registry.
    esploraUrl: `${window.location.origin}/api/node`,
    registryUrl: '/api/registry/',
    faucetUrl: config.faucet ? '/api/faucet' : null,
  });
  // DAMP keys come from the recovery phrase; wallets imported from a secret or key file have none.
  setSignerWalletSource({
    active: () => {
      const w = activeStoredWallet();
      return w?.phrase ? { name: w.name, phrase: normalizePhrase(w.phrase) } : null;
    },
    subscribe: subscribeWallets,
  });
  startWalletSigner();
}

/** Whether DAMP is configured, and once it is ready (runtime configuration set, signer started). */
export function useDamp() {
  const config = useConfig().data;
  const enabled = !!config?.damp && !config.classicAssets;
  const ready = useQuery({
    queryKey: ['damp-start'],
    enabled,
    staleTime: Infinity,
    retry: 2,
    queryFn: async () => {
      started ??= start(config!).catch((e: unknown) => {
        started = null;
        throw e;
      });
      await started;
      return true;
    },
  });
  return { config, enabled, ready: ready.data === true, error: ready.error as Error | null, retry: () => void ready.refetch() };
}

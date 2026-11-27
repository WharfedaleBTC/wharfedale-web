// Shared pieces of the regulated-asset (DAMP) pages. Loaded only after lib/damp.ts has set the
// runtime configuration, through the lazy routes in ./index.tsx.
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signerSnapshot, subscribeSigner } from '@damp/damp-signer';
import { deploymentQueryKeys, useDeployments, useOfficialDeployments } from '@damp/deployments';
import type { CanonicalDeployment } from '@damp/registry';
import { loadPolicyTimeline } from '@damp/policy-timeline';
import { deleteDeployment } from '@damp/store';
import { requirePublishedDeployment, type Deployment } from '@damp/domain';
import { esploraUrlForDeployment, traverseLiveAnchor } from '@damp/esplora';
import { resolvePolicySnapshot } from '@damp/policy-registry';
import { useWalletSync } from '@damp/wallet-query';
import { assetBalances, type AssetBalance } from '@damp/wallet-sync';
import { useWallets } from '../lib/wallets';

export function useSigner() {
  return useSyncExternalStore(subscribeSigner, signerSnapshot, signerSnapshot);
}

/** The deployments this browser imported (public data only), and the one for an asset id. */
export function useRegulatedAssets(assetId?: string | null) {
  const deployments = useDeployments();
  const list = deployments.data ?? [];
  return { deployments, list, selected: assetId ? (list.find((d) => d.regulatedAsset === assetId) ?? null) : null };
}

/** The active wallet's DAMP coins (WBTC wallet key and every holder covenant), every 3 s. */
export function useRegulatedBalances() {
  const sync = useWalletSync();
  const snapshot = sync.data?.snapshot;
  const balances = useMemo(() => new Map<string, AssetBalance>(assetBalances(snapshot).map((b) => [b.assetId, b])), [snapshot]);
  return { sync, snapshot, balances, syncError: sync.data?.syncError ?? (sync.error ? String((sync.error as Error).message ?? sync.error) : undefined) };
}

/** The deployment's live verifier output and its current policy (the blacklist), from chain and registry. */
export function useLivePolicy(deployment: Deployment | null | undefined) {
  return useQuery({
    queryKey: ['damp-live-policy', deployment?.deploymentId],
    enabled: deployment?.publication === 'published',
    staleTime: 10_000,
    queryFn: async () => {
      const selected = requirePublishedDeployment(deployment);
      const anchor = await traverseLiveAnchor(selected, esploraUrlForDeployment(selected));
      if (anchor.live.confirmations < 1) throw new Error('The live verifier output is not confirmed yet.');
      const policy = await resolvePolicySnapshot(selected, anchor.live.scriptPubkey);
      return { anchor: anchor.live, policy };
    },
  });
}

/**
 * Why regulated assets aren't available for the active wallet, or null when they are: DAMP keys
 * come from the recovery phrase, so wallets imported from a secret or key file can't hold them.
 */
export function useWalletGate(): ReactNode | null {
  const { active } = useWallets();
  const signer = useSigner();
  if (!active) return null;
  if (!active.phrase) {
    return (
      <>
        <strong>Regulated assets need a recovery-phrase wallet.</strong> This wallet was imported from a secret, and DAMP keys come from the phrase. <Link className="text-link" to="/wallet/new">Create a wallet</Link> or import one from its phrase.
      </>
    );
  }
  if (signer.error) return <><strong>The signer didn't open.</strong> {signer.error}</>;
  return null;
}

/** A disclosure for technical detail, closed by default. */
export function Details({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="details">
      <summary>{label}</summary>
      <div className="details__body">{children}</div>
    </details>
  );
}

/** A registry entry as a public deployment record (no issuer authority), for read-only pages. */
export function publicDeployment(entry: CanonicalDeployment): Deployment {
  return { ...entry.manifest, deploymentId: entry.deploymentId, confirmations: 0, publication: 'published' };
}

/** One asset by deployment id: the wallet's record when added, otherwise the registry's entry. */
export function useAsset(deploymentId: string) {
  const { list, deployments } = useRegulatedAssets();
  const official = useOfficialDeployments();
  const held = list.find((d) => d.deploymentId === deploymentId) ?? null;
  const entry = official.data?.find((e) => e.deploymentId === deploymentId) ?? null;
  const deployment = held ?? (entry ? publicDeployment(entry) : null);
  return { deployment, held: !!held, entry, pending: deployments.isPending || (!held && official.isPending), error: official.error };
}

/** The verifier's live policy, the activated policies (newest first) and the transfer count. */
export function usePolicyTimeline(deployment: Deployment | null | undefined) {
  return useQuery({
    queryKey: ['damp-policy-timeline', deployment?.deploymentId],
    enabled: deployment?.publication === 'published',
    staleTime: 10_000,
    queryFn: () => loadPolicyTimeline(requirePublishedDeployment(deployment)),
  });
}

/** Esplora's totals for the asset: every explicit issuance, initial and later. */
export function useIssued(deployment: Deployment | null | undefined) {
  return useQuery({
    queryKey: ['damp-asset-stats', deployment?.regulatedAsset],
    enabled: !!deployment,
    staleTime: 15_000,
    queryFn: async () => {
      const response = await fetch(`${esploraUrlForDeployment(deployment!)}/asset/${deployment!.regulatedAsset}`);
      if (!response.ok) throw new Error(`The node answered ${response.status}.`);
      const body = (await response.json()) as { chain_stats?: { issued_amount?: number; issuance_count?: number } };
      return { issued: BigInt(body.chain_stats?.issued_amount ?? 0), issuances: body.chain_stats?.issuance_count ?? 0 };
    },
  });
}

/** Forget an asset in this browser: the coins stay on chain under the wallet's key. */
export function useRemoveAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deploymentId: string) => deleteDeployment(deploymentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['wallet-sync'] }),
      ]);
    },
  });
}

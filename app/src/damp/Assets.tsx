// The Assets page with DAMP: the node's plain assets and the DAMP registry's regulated ones in one
// list. Adding a regulated asset stores its public manifest in this browser (after checking it
// against the registry, the chain and the signer); the wallet then lists, sends and receives it.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deploymentQueryKeys, useOfficialDeployments } from '@damp/deployments';
import { persistPublicDeploymentImport, validatePublicDeploymentImport } from '@damp/deployment-import';
import { formatUnits, supplyModeLabel, userFacingError, type Deployment } from '@damp/domain';
import { canonicalRegistryContent, type CanonicalDeployment } from '@damp/registry';
import { AssetsListPage, issuedText, usePlainAssets, type ListedAsset } from '../pages/AssetList';
import { Details, useRegulatedAssets } from './shared';

function ManualImport({ onImported }: { onImported: (d: Deployment) => void }) {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      onImported(await persistPublicDeploymentImport(await validatePublicDeploymentImport(source)));
      setSource('');
    } catch (e) {
      setError(userFacingError(e));
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Details label="Add a regulated asset by manifest, deployment id or registry URL">
      <div className="stack-md">
        <div className="field">
          <label htmlFor="manifest">Manifest JSON, deployment id or registry URL</label>
          <textarea id="manifest" ref={ref} className="textarea input--mono" rows={5} value={source} onChange={(e) => { setSource(e.target.value); setError(null); }} aria-invalid={!!error} />
          <span className={error ? 'hint err' : 'hint'}>{error ?? "It must match the registry's published bytes."}</span>
        </div>
        <div className="button-row">
          <button className="button button--secondary" type="button" disabled={busy || !source.trim()} aria-busy={busy} onClick={() => void run()}>
            {busy ? 'Verifying…' : 'Verify and add'}
          </button>
        </div>
      </div>
    </Details>
  );
}

/** Add a registry entry to this browser's wallet, after the same checks as a manual import. */
export function useAddAsset() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Deployment | null>(null);
  async function imported(d: Deployment) {
    setAdded(d);
    await queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.all });
  }
  async function add(entry: CanonicalDeployment) {
    setAdding(entry.deploymentId);
    setError(null);
    try {
      await imported(await persistPublicDeploymentImport(await validatePublicDeploymentImport(canonicalRegistryContent(entry.manifest))));
    } catch (e) {
      setError(userFacingError(e));
    } finally {
      setAdding(null);
    }
  }
  return { add, imported, adding, error, added };
}

/** The Assets page with DAMP: plain assets from the node, regulated ones from the DAMP registry. */
export function RegulatedAssetsPage() {
  const official = useOfficialDeployments();
  const { list } = useRegulatedAssets();
  const { add, imported, adding, error, added } = useAddAsset();
  const entries = official.data ?? [];
  // A deployment's regulated and verifier assets are listed once, as the regulated asset.
  const hidden = useMemo(() => new Set(entries.flatMap((e) => [e.manifest.regulatedAsset, e.manifest.verifierAsset])), [entries]);
  const { items: plain, registry } = usePlainAssets(hidden);
  const records = useMemo(() => new Map((registry.data ?? []).map((r) => [r.asset_id, r])), [registry.data]);
  const held = useMemo(() => new Set(list.map((d) => d.deploymentId)), [list]);
  const regulated: ListedAsset[] = entries.map((entry) => {
    const m = entry.manifest;
    const record = records.get(m.regulatedAsset);
    return {
      key: entry.deploymentId,
      assetId: m.regulatedAsset,
      kind: 'regulated',
      name: m.asset.name,
      ticker: m.asset.ticker,
      facts: `${record ? issuedText(record, m.asset.precision) : `${formatUnits(m.issuedSupply, m.asset.precision)} issued`} · ${supplyModeLabel(m.supplyMode).toLowerCase()}`,
      inWallet: held.has(entry.deploymentId),
      height: record?.status?.block_height ?? Number.MAX_SAFE_INTEGER,
      action: (
        <button className="button button--sm button--primary" type="button" disabled={!!adding} aria-busy={adding === entry.deploymentId} onClick={() => void add(entry)}>
          {adding === entry.deploymentId ? 'Verifying…' : 'Add to wallet'}
        </button>
      ),
    };
  });
  const problem = registry.error ? `The node is unavailable: ${(registry.error as Error).message}` : official.error ? `The regulated asset registry is unavailable: ${userFacingError(official.error)}` : null;
  return (
    <AssetsListPage
      items={[...regulated, ...plain]}
      loading={registry.isPending || official.isPending}
      error={problem}
      notice={
        <>
          {added && (
            <p className="notice notice--ok" role="status">
              <strong>{added.asset.name} added.</strong> Manifest, live verifier and policy checked. <Link className="text-link" to="/wallet">Open the wallet</Link>
            </p>
          )}
          {error && <p className="notice notice--danger" role="alert">Couldn't add it: {error}</p>}
        </>
      }
      footer={<ManualImport onImported={(d) => void imported(d)} />}
    />
  );
}

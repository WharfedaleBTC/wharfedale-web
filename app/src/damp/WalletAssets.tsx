// The wallet's regulated assets: one row per added DAMP deployment, after the WBTC row. The row
// opens the asset's page; × removes the asset from this browser after a confirmation.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatUnits, supplyModeLabel, userFacingError, type Deployment } from '@damp/domain';
import type { AssetBalance } from '@damp/wallet-sync';
import { ArrowDownLeft, ArrowUpRight } from '../components/icons';
import { Ticker, reveal } from '../components/motion';
import { useRegulatedAssets, useRegulatedBalances, useRemoveAsset, useSigner, useWalletGate } from './shared';

/** The confirmation under a row, shared by the wallet and the asset page. */
export function RemoveConfirm({ deployment, onCancel, onRemoved }: { deployment: Deployment; onCancel: () => void; onRemoved?: () => void }) {
  const remove = useRemoveAsset();
  return (
    <div className="confirm" role="alertdialog" aria-label={`Remove ${deployment.asset.name}`}>
      <p>
        <strong>Remove {deployment.asset.name} from this wallet?</strong> It only hides the asset here. Your coins stay on chain under your key; add it again from Assets to see them.
        {remove.error && <span className="err" style={{ display: 'block' }}>Couldn't remove it: {userFacingError(remove.error)}</span>}
      </p>
      <div className="button-row">
        <button className="button button--sm button--danger" type="button" disabled={remove.isPending} aria-busy={remove.isPending} onClick={() => remove.mutate(deployment.deploymentId, { onSuccess: () => onRemoved?.() })}>
          {remove.isPending ? 'Removing…' : 'Remove'}
        </button>
        <button className="button button--sm button--secondary" type="button" disabled={remove.isPending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RegulatedRow({ deployment, balance, synced, index }: { deployment: Deployment; balance?: AssetBalance; synced: boolean; index: number }) {
  const { asset } = deployment;
  const [confirming, setConfirming] = useState(false);
  const page = `/assets/${deployment.deploymentId}`;
  return (
    <li className="asset-row asset-row--link" {...reveal('up', index * 60)}>
      <Link className="asset-row__hit" to={page} aria-label={`${asset.name}: details`} />
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: '0.5rem 0.75rem' }}>
          <span className="index__title">{asset.name}</span>
          <span className="badge badge--signal">regulated</span>
        </div>
        <span className="data" style={{ display: 'block', marginTop: '0.375rem' }}>
          {asset.ticker} · {supplyModeLabel(deployment.supplyMode).toLowerCase()} · {deployment.regulatedAsset.slice(0, 8)}
        </span>
      </div>
      <div className="asset-row__amount">
        {synced ? <Ticker value={formatUnits(balance?.confirmed ?? 0n, asset.precision)} /> : '—'}
        <span className="amount__unit" style={{ display: 'block', marginTop: '0.25rem', letterSpacing: '0.12em' }}>{asset.ticker}</span>
        {balance?.pending ? <span className="data" style={{ display: 'block' }}>+{formatUnits(balance.pending, asset.precision)} pending</span> : null}
      </div>
      <div className="asset-row__actions">
        <Link to={`/wallet/send?asset=${deployment.regulatedAsset}`} className="button button--sm button--primary">
          Send <ArrowUpRight />
        </Link>
        <Link to={`/wallet/receive?asset=${deployment.regulatedAsset}`} className="button button--sm button--secondary">
          Receive <ArrowDownLeft />
        </Link>
        <button className="icon-x" type="button" aria-label={`Remove ${asset.name} from this wallet`} aria-expanded={confirming} onClick={() => setConfirming((c) => !c)}>
          ×
        </button>
      </div>
      {confirming && <RemoveConfirm deployment={deployment} onCancel={() => setConfirming(false)} />}
    </li>
  );
}

/** Rows for the wallet's asset list, and a note when the wallet can't hold regulated assets. */
export function RegulatedWalletAssets({ offset }: { offset: number }) {
  const gate = useWalletGate();
  const signer = useSigner();
  const { list, deployments } = useRegulatedAssets();
  const { snapshot, balances, syncError } = useRegulatedBalances();
  if (gate) return <li className="notice" style={{ marginTop: '1rem' }}>{gate}</li>;
  if (deployments.isPending) return null;
  if (!list.length) {
    return (
      <li className="notice" style={{ marginTop: '1rem' }}>
        <strong>No regulated assets yet.</strong> <Link className="text-link" to="/assets">Browse the chain's regulated assets</Link> and add one to hold, send and receive it.
      </li>
    );
  }
  return (
    <>
      {list.map((d, i) => (
        <RegulatedRow key={d.deploymentId} deployment={d} balance={balances.get(d.regulatedAsset)} synced={!!snapshot} index={offset + i} />
      ))}
      {!snapshot && signer.opening && <li className="hint" style={{ paddingTop: '1rem' }}>Opening the signer…</li>}
      {syncError && <li className="notice notice--danger" style={{ marginTop: '1rem' }}>{snapshot ? 'Showing the last good state. ' : ''}{syncError}</li>}
    </>
  );
}

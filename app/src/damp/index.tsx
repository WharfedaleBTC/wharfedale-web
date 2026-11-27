// Entry points for the regulated-asset (DAMP) pages. Each loads lazily, after lib/damp.ts has set
// DAMP's runtime configuration and started the signer, so the explorer and network pages never
// fetch DAMP's code or WebAssembly.
import { lazy, Suspense, type ReactNode } from 'react';
import { useDamp } from '../lib/damp';

const WalletAssets = lazy(() => import('./WalletAssets').then((m) => ({ default: m.RegulatedWalletAssets })));
const AssetsPage = lazy(() => import('./Assets').then((m) => ({ default: m.RegulatedAssetsPage })));
const AssetPage = lazy(() => import('./AssetPage').then((m) => ({ default: m.RegulatedAssetPage })));
const SendSwitch = lazy(() => import('./switch').then((m) => ({ default: m.SendSwitch })));
const ReceiveSwitch = lazy(() => import('./switch').then((m) => ({ default: m.ReceiveSwitch })));

function Gate({ children, off, loading }: { children: ReactNode; off: ReactNode; loading: ReactNode }) {
  const damp = useDamp();
  if (!damp.enabled) return <>{off}</>;
  if (damp.error) {
    return (
      <p className="notice notice--danger" role="alert">
        Regulated assets are unavailable: {damp.error.message}{' '}
        <button type="button" className="text-link" onClick={damp.retry}>
          Retry
        </button>
      </p>
    );
  }
  if (!damp.ready) return <>{loading}</>;
  return <Suspense fallback={loading}>{children}</Suspense>;
}

/** Regulated rows for the wallet's asset list (nothing when DAMP is off). */
export function RegulatedWalletAssets({ offset }: { offset: number }) {
  return (
    <Gate off={null} loading={<li className="hint" style={{ paddingTop: '1rem' }}>Loading regulated assets…</li>}>
      <WalletAssets offset={offset} />
    </Gate>
  );
}

const pageLoading = (
  <main className="shell section">
    <p className="lead">Loading regulated assets…</p>
  </main>
);

export function RegulatedAssets() {
  return (
    <Gate off={pageLoading} loading={pageLoading}>
      <AssetsPage />
    </Gate>
  );
}

/** `/assets/:id`: a regulated asset by deployment id, otherwise `fallback` (a plain asset's page). */
export function RegulatedAsset({ fallback }: { fallback: ReactNode }) {
  return (
    <Gate off={fallback} loading={pageLoading}>
      <AssetPage fallback={fallback} />
    </Gate>
  );
}

/** `/wallet/send`: a regulated asset's transfer page when `asset` is one, otherwise `fallback` (WBTC). */
export function SendPage({ asset, fallback }: { asset: string | null; fallback: ReactNode }) {
  if (!asset) return <>{fallback}</>;
  return (
    <Gate off={fallback} loading={pageLoading}>
      <SendSwitch asset={asset} fallback={fallback} />
    </Gate>
  );
}

export function ReceivePage({ asset, fallback }: { asset: string | null; fallback: ReactNode }) {
  if (!asset) return <>{fallback}</>;
  return (
    <Gate off={fallback} loading={pageLoading}>
      <ReceiveSwitch asset={asset} fallback={fallback} />
    </Gate>
  );
}

// Send and Receive pick the regulated-asset page when the `asset` query names an imported DAMP
// deployment's asset, and the WBTC page otherwise.
import type { ReactNode } from 'react';
import { RegulatedReceive } from './Receive';
import { RegulatedSend } from './Send';
import { useRegulatedAssets } from './shared';

export function SendSwitch({ asset, fallback }: { asset: string | null; fallback: ReactNode }) {
  const { deployments, selected } = useRegulatedAssets(asset);
  if (deployments.isPending) return null;
  return selected ? <RegulatedSend deployment={selected} /> : <>{fallback}</>;
}

export function ReceiveSwitch({ asset, fallback }: { asset: string | null; fallback: ReactNode }) {
  const { deployments, selected } = useRegulatedAssets(asset);
  if (deployments.isPending) return null;
  return selected ? <RegulatedReceive deployment={selected} /> : <>{fallback}</>;
}

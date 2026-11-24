// How an asset is shown: on-chain name and ticker when the node verified them; the native asset
// from the server config; otherwise its id.
import { useAssetRecord, useChainInfo, useConfig, type AssetRecord } from './api';
import { formatAmount, short } from './format';

export interface AssetView {
  id: string;
  name: string;
  /** Ticker, or a short id. */
  unit: string;
  precision: number;
  native: boolean;
  record: AssetRecord | null;
}

export function useAssetView(id: string | undefined): AssetView | undefined {
  const config = useConfig().data;
  const chain = useChainInfo().data;
  const record = useAssetRecord(id && id !== chain?.feeAsset ? id : undefined).data ?? null;
  if (!id || !config || !chain) return undefined;
  if (id === chain.feeAsset) {
    return { id, name: config.nativeAsset.name, unit: config.nativeAsset.ticker, precision: config.nativeAsset.precision, native: true, record: null };
  }
  if (record?.name && record.ticker) {
    return { id, name: record.name, unit: record.ticker, precision: record.precision ?? 0, native: false, record };
  }
  return { id, name: 'Unnamed asset', unit: id.slice(0, 8), precision: 0, native: false, record };
}

export const amountText = (v: AssetView | undefined, base: number): string => (v ? `${formatAmount(base, v.precision)} ${v.unit}` : `${base}`);
export const idText = (id: string): string => short(id, 8, 0).replace('…', '');

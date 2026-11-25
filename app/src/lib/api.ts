// The node (through the server's allowlisted proxy), the server's own endpoints, and shared queries.
import { useQuery } from '@tanstack/react-query';
import { Client } from '@wharfedale/sdk';

export const client = new Client(`${window.location.origin}/api/node`);

export interface AppConfig {
  nativeAsset: { ticker: string; name: string; precision: number };
  faucet: { amount: number; cooldownMinutes: number } | null;
  docsUrl: string;
  /** The lending app, linked from the top bar; null when not configured. */
  lendingUrl: string | null;
}

export interface EsploraBlock {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  proposer?: string;
  previousblockhash?: string | null;
  mediantime?: number;
}

export interface EsploraOut {
  scriptpubkey: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value?: number;
  valuecommitment?: string;
  asset?: string;
  assetcommitment?: string;
}

export interface EsploraIn {
  txid: string;
  vout: number;
  is_coinbase: boolean;
  witness: string[];
  prevout: EsploraOut | null;
  issuance: { asset_id: string; is_reissuance: boolean; assetamount?: number; tokenamount?: number } | null;
}

export interface EsploraTx {
  txid: string;
  fee: number;
  size: number;
  weight: number;
  vin: EsploraIn[];
  vout: EsploraOut[];
  status: { confirmed: boolean; block_height?: number; block_hash?: string };
}

export interface AssetRecord {
  asset_id: string;
  reissuance_token?: string | null;
  name?: string | null;
  ticker?: string | null;
  precision?: number | null;
  chain_stats?: { issued_amount?: number };
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export const api = {
  config: () => fetch('/api/config').then((r) => json<AppConfig>(r)),
  network: () => fetch('/api/network').then((r) => json<NetworkGraph>(r)),
  faucetStatus: () => fetch('/api/faucet').then((r) => json<{ balance: number; amount: number; cooldownMinutes: number; coins: number }>(r)),
  faucetPay: (address: string) =>
    fetch('/api/faucet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) }).then((r) =>
      json<{ txid: string }>(r),
    ),
};

export interface NetworkGraph {
  nodes: { id: string; name: string; role: 'validator' | 'full' | 'unknown'; address: string | null; configured: boolean; online: boolean; height: number | null; peers: number | null; mempool: number | null }[];
  edges: { source: string; target: string }[];
  tip: number | null;
}

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity });
}

export function useChainInfo() {
  return useQuery({ queryKey: ['chaininfo'], queryFn: () => client.chainInfo(), refetchInterval: 2_000 });
}

/** The asset record (with on-chain name, if any); `null` for ids without one (tokens, unknown). */
export function useAssetRecord(id: string | undefined) {
  return useQuery({
    queryKey: ['asset', id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: () => client.rest<AssetRecord>(`asset/${id}`).catch(() => null),
  });
}

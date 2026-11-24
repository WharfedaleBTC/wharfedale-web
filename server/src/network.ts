// The network page's graph: every configured node's getnetworkinfo, merged by peer id.
import type { NodeEntry } from './config.js';

interface PeerInfo {
  peer_id: string;
  moniker: string;
  address: string;
  role: 'validator' | 'full';
  consensus_address: string | null;
  direction: 'inbound' | 'outbound' | null;
  score: number;
}

interface NetworkInfo {
  peer_id: string;
  moniker: string;
  role: 'validator' | 'full';
  consensus_address: string | null;
  height: number;
  peers: PeerInfo[];
}

export interface GraphNode {
  id: string;
  name: string;
  role: 'validator' | 'full' | 'unknown';
  /** Consensus address (validators): matches a block's `proposer`. */
  address: string | null;
  /** In the config (polled), as opposed to only seen as someone's peer. */
  configured: boolean;
  online: boolean;
  height: number | null;
  peers: number | null;
  mempool: number | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
  tip: number | null;
}

async function rpc<T>(url: string, method: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'web', method, params: [] }),
    signal: AbortSignal.timeout(2_500),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } | null };
  if (body.error) throw new Error(body.error.message ?? 'rpc error');
  return body.result as T;
}

export async function buildGraph(entries: NodeEntry[]): Promise<Graph> {
  const polled = await Promise.all(
    entries.map(async (e) => {
      try {
        const [info, mempool] = await Promise.all([
          rpc<NetworkInfo>(e.rpc, 'getnetworkinfo'),
          rpc<{ size: number }>(e.rpc, 'getmempoolinfo').catch(() => null),
        ]);
        return { entry: e, info, mempool: mempool?.size ?? null };
      } catch {
        return { entry: e, info: null, mempool: null };
      }
    }),
  );
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, { source: string; target: string }>();
  for (const p of polled) {
    if (!p.info) {
      nodes.set(`config:${p.entry.name}`, { id: `config:${p.entry.name}`, name: p.entry.name, role: 'unknown', address: null, configured: true, online: false, height: null, peers: null, mempool: null });
      continue;
    }
    nodes.set(p.info.peer_id, {
      id: p.info.peer_id,
      name: p.entry.name,
      role: p.info.role,
      address: p.info.consensus_address,
      configured: true,
      online: true,
      height: p.info.height,
      peers: p.info.peers.length,
      mempool: p.mempool,
    });
  }
  for (const p of polled) {
    if (!p.info) continue;
    for (const peer of p.info.peers) {
      if (!nodes.has(peer.peer_id)) {
        nodes.set(peer.peer_id, { id: peer.peer_id, name: peer.moniker || peer.peer_id.slice(-8), role: peer.role, address: peer.consensus_address, configured: false, online: true, height: null, peers: null, mempool: null });
      }
      const [a, b] = [p.info.peer_id, peer.peer_id].sort();
      edges.set(`${a}|${b}`, { source: a!, target: b! });
    }
  }
  const heights = [...nodes.values()].map((n) => n.height).filter((h): h is number => h !== null);
  return { nodes: [...nodes.values()], edges: [...edges.values()], tip: heights.length ? Math.max(...heights) : null };
}

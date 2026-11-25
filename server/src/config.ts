import { readFileSync } from 'node:fs';

export interface NodeEntry {
  name: string;
  /** JSON-RPC + Esplora base URL. */
  rpc: string;
}

export interface Config {
  /** host:port to listen on. */
  listen: string;
  /** The node the app reads from and submits to (a full node; validators stay private). */
  publicNode: string;
  /** Nodes drawn on the network page (polled with getnetworkinfo). */
  nodes: NodeEntry[];
  nativeAsset: { ticker: string; name: string; precision: number };
  faucet?: {
    keyFile: string;
    amount: number;
    cooldownMinutes: number;
    /** Keep at least this many spendable faucet coins (one payout per coin per block). */
    minCoins: number;
  };
  /**
   * Behind a reverse proxy: take the client address (faucet limit) from the last
   * `X-Forwarded-For` entry, which that proxy appends. Default false: the socket address
   * (otherwise any client could pick its own address with the header).
   */
  trustProxy?: boolean;
  /** Base URL of the mdBook docs (the Docs page links into it). */
  docsUrl?: string;
  /** Folder with the built app; default dist/app next to the server. */
  staticDir?: string;
}

export function loadConfig(path = process.env.WHARFEDALE_WEB_CONFIG ?? 'config.json'): Config {
  const c = JSON.parse(readFileSync(path, 'utf8')) as Config;
  if (!c.publicNode || !Array.isArray(c.nodes)) throw new Error(`${path}: publicNode and nodes are required`);
  return { ...c, listen: c.listen ?? '127.0.0.1:8080' };
}

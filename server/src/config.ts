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
  /**
   * The public node's address as visitors reach it (JSON-RPC and Esplora), shown in the Docs
   * examples; default the local network's full node, http://127.0.0.1:18447.
   */
  publicRpcUrl?: string;
  /** The lending app (simplicity-lending); when set, the top bar links to it after Assets. */
  lendingUrl?: string;
  /**
   * DAMP regulated assets: the wallet holds, sends and receives them, and the Assets page lists the
   * registry's deployments. `registryUrl` is the DAMP registry directory (served read-only under
   * /api/registry/); `appUrl` is the DAMP issuer console, linked from the Assets page. Without
   * it the wallet holds WBTC only.
   */
  damp?: { registryUrl: string; appUrl?: string };
  /**
   * The earlier asset tools: the Assets page issues WFA1-named assets, and the wallet lists and
   * sends every asset it holds. Hidden by default; true brings them back in place of DAMP.
   */
  classicAssets?: boolean;
  /** Folder with the built app; default dist/app next to the server. */
  staticDir?: string;
}

/**
 * The public addresses can also come from the environment, which wins over the file, so a
 * deployment keeps every address visitors see in one place (demo-prod's .env):
 * PUBLIC_RPC_URL (`publicRpcUrl`), LENDING_URL (`lendingUrl`) and DAMP_URL (`damp.appUrl`, used
 * when `damp` is configured). Unset or empty variables leave the file's values.
 */
export function publicUrlsFromEnv(c: Config, env: NodeJS.ProcessEnv = process.env): Config {
  const value = (name: string) => env[name]?.trim() || undefined;
  const publicRpcUrl = value('PUBLIC_RPC_URL') ?? c.publicRpcUrl;
  const lendingUrl = value('LENDING_URL') ?? c.lendingUrl;
  const damp = c.damp && { ...c.damp, appUrl: value('DAMP_URL') ?? c.damp.appUrl };
  return { ...c, publicRpcUrl, lendingUrl, damp };
}

export function loadConfig(path = process.env.WHARFEDALE_WEB_CONFIG ?? 'config.json'): Config {
  const c = JSON.parse(readFileSync(path, 'utf8')) as Config;
  if (!c.publicNode || !Array.isArray(c.nodes)) throw new Error(`${path}: publicNode and nodes are required`);
  return publicUrlsFromEnv({ ...c, listen: c.listen ?? '127.0.0.1:8080' });
}

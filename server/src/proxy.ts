// The only way from the browser to a node: allowlisted JSON-RPC methods and Esplora GET paths,
// forwarded to the configured public node.
import type { Context } from 'hono';

export const RPC_METHODS = new Set([
  'getblockchaininfo',
  'getblockcount',
  'getblockhash',
  'getrawtransaction',
  'getscriptutxos',
  'testmempoolaccept',
  'sendrawtransaction',
]);

const HEX64 = '[0-9a-f]{64}';
const ESPLORA_PATHS = [
  /^blocks$/,
  /^blocks\/\d+$/,
  /^blocks\/tip\/(height|hash)$/,
  /^block-height\/\d+$/,
  new RegExp(`^block/${HEX64}$`),
  new RegExp(`^block/${HEX64}/(status|txids|txs)$`),
  new RegExp(`^block/${HEX64}/txs/\\d+$`),
  new RegExp(`^tx/${HEX64}(/status|/outspends|/hex)?$`),
  new RegExp(`^tx/${HEX64}/outspend/\\d+$`),
  new RegExp(`^scripthash/${HEX64}(/utxo|/txs|/txs/mempool|/txs/chain|/txs/chain/${HEX64})?$`),
  /^assets\/registry$/,
  new RegExp(`^asset/${HEX64}$`),
  new RegExp(`^asset/${HEX64}/txs/chain(/${HEX64})?$`),
  /^address\/[a-z0-9]{10,120}(\/utxo|\/txs)?$/,
  /^mempool\/txids$/,
  /^fee-estimates$/,
];

export function esploraAllowed(path: string): boolean {
  return ESPLORA_PATHS.some((re) => re.test(path));
}

const TIMEOUT_MS = 15_000;

export async function forwardRpc(c: Context, node: string): Promise<Response> {
  let body: { method?: unknown; params?: unknown; id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ result: null, error: { code: -32700, message: 'parse error' }, id: null }, 400);
  }
  if (typeof body.method !== 'string' || !RPC_METHODS.has(body.method)) {
    return c.json({ result: null, error: { code: -32601, message: 'method not allowed' }, id: body.id ?? null }, 403);
  }
  // The node verifies every transaction of a testmempoolaccept batch: one per request here.
  if (body.method === 'testmempoolaccept' && !(Array.isArray(body.params) && Array.isArray(body.params[0]) && body.params[0].length <= 1)) {
    return c.json({ result: null, error: { code: -32602, message: 'testmempoolaccept: one transaction per request' }, id: body.id ?? null }, 400);
  }
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '1.0', id: body.id ?? 'web', method: body.method, params: Array.isArray(body.params) ? body.params : [] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
}

/** Query parameters forwarded for a path (numbers only); everything else is dropped. */
function esploraQuery(path: string, url: string): string {
  if (path !== 'assets/registry') return '';
  const given = new URL(url).searchParams;
  const kept = new URLSearchParams();
  for (const key of ['start_index', 'limit']) {
    const value = given.get(key);
    if (value && /^\d{1,6}$/.test(value)) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : '';
}

export async function forwardEsplora(c: Context, node: string, path: string): Promise<Response> {
  if (!esploraAllowed(path)) return c.json({ error: 'path not allowed' }, 403);
  const res = await fetch(`${node.replace(/\/+$/, '')}/${path}${esploraQuery(path, c.req.url)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const headers: Record<string, string> = { 'content-type': res.headers.get('content-type') ?? 'application/json' };
  const total = res.headers.get('x-total-results');
  if (total && /^\d+$/.test(total)) headers['x-total-results'] = total;
  return new Response(res.body, { status: res.status, headers });
}

/** POST /tx: broadcast one raw transaction (hex body), as Esplora does. Returns the txid. */
export async function forwardBroadcast(c: Context, node: string): Promise<Response> {
  const body = (await c.req.text()).trim();
  if (!/^(?:[0-9a-f]{2})+$/i.test(body)) return c.text('body must be a raw transaction in hex', 400);
  const res = await fetch(`${node.replace(/\/+$/, '')}/tx`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain' } });
}

// DAMP registry files: deployments/index.json, deployments/<id>.json, policies/<id>/<hash>.json.
const REGISTRY_PATHS = [/^deployments\/index\.json$/, new RegExp(`^deployments/${HEX64}\\.json$`), new RegExp(`^policies/${HEX64}/${HEX64}\\.json$`)];

export function registryAllowed(path: string): boolean {
  return REGISTRY_PATHS.some((re) => re.test(path));
}

/** GET a DAMP registry file from `registry` (a directory URL). */
export async function forwardRegistry(c: Context, registry: string, path: string): Promise<Response> {
  if (!registryAllowed(path)) return c.json({ error: 'path not allowed' }, 403);
  let res: Response;
  try {
    res = await fetch(new URL(path, registry.replace(/\/?$/, '/')), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return c.json({ error: 'the DAMP registry is unreachable' }, 502);
  }
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' } });
}

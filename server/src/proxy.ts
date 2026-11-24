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
  new RegExp(`^asset/${HEX64}$`),
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
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '1.0', id: body.id ?? 'web', method: body.method, params: Array.isArray(body.params) ? body.params : [] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
}

export async function forwardEsplora(c: Context, node: string, path: string): Promise<Response> {
  if (!esploraAllowed(path)) return c.json({ error: 'path not allowed' }, 403);
  const res = await fetch(`${node.replace(/\/+$/, '')}/${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}

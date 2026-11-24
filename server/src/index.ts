// wharfedale-web server: the built app, a node proxy (allowlist), the network graph, the faucet.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { Client } from '@wharfedale/sdk';
import { loadConfig } from './config.js';
import { forwardEsplora, forwardRpc } from './proxy.js';
import { buildGraph } from './network.js';
import { Faucet, FaucetError } from './faucet.js';

const config = loadConfig();
const app = new Hono();
const faucet = config.faucet ? new Faucet(new Client(config.publicNode), config.faucet) : null;

app.get('/api/config', (c) =>
  c.json({
    nativeAsset: config.nativeAsset,
    faucet: config.faucet ? { amount: config.faucet.amount, cooldownMinutes: config.faucet.cooldownMinutes } : null,
    docsUrl: (config.docsUrl ?? 'https://wharfedalebtc.github.io/wharfedale/').replace(/\/?$/, '/'),
  }),
);
app.post('/api/node', (c) => forwardRpc(c, config.publicNode));
app.get('/api/node/*', (c) => forwardEsplora(c, config.publicNode, c.req.path.slice('/api/node/'.length)));
app.get('/api/network', async (c) => c.json(await buildGraph(config.nodes)));

app.get('/api/faucet', async (c) => {
  if (!faucet) return c.json({ error: 'faucet disabled' }, 404);
  return c.json(await faucet.status());
});
app.post('/api/faucet', async (c) => {
  if (!faucet) return c.json({ error: 'faucet disabled' }, 404);
  const body = await c.req.json().catch(() => ({}) as { address?: unknown });
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const client = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || getConnInfo(c).remote.address || 'unknown';
  try {
    return c.json({ txid: await faucet.pay(address, client) });
  } catch (e) {
    const err = e instanceof FaucetError ? e : new FaucetError((e as Error).message, 503);
    return c.json({ error: err.message }, err.status);
  }
});

// The built app (SPA: unknown paths serve index.html).
const here = dirname(fileURLToPath(import.meta.url));
const staticDir = config.staticDir ?? join(here, '..', 'app');
if (existsSync(staticDir)) {
  app.use('/*', serveStatic({ root: staticDir }));
  app.get('*', serveStatic({ root: staticDir, path: 'index.html' }));
}

const [hostname, port] = config.listen.split(':');
serve({ fetch: app.fetch, hostname, port: Number(port) }, (info) => console.log(`wharfedale-web on http://${info.address}:${info.port} → ${config.publicNode}`));

if (faucet) {
  const tick = () => void faucet.keepCoins();
  setTimeout(tick, 3_000);
  setInterval(tick, 30_000);
}

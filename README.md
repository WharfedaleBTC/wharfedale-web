# wharfedale-web

A small web app for a Wharfedale network: the live network, a block explorer, a demo wallet for
WBTC and regulated assets ([DAMP](https://github.com/WharfedaleBTC/damp)), a faucet for the
native (fee) asset and a docs page. React in the browser, a small Node server in front of the
nodes.

```text
browser (React)  ──/api/*──▶  server (Node, Hono)  ──allowlisted RPC + Esplora──▶  public full node
  wallet keys stay here         faucet key, network graph  ──getnetworkinfo──▶  every configured node
```

| Screen | Path | Does |
|---|---|---|
| Network (home) | `/` | The live network as an isometric scene of translucent servers (rack: validator, tower: full node); each new block pulses out from its proposer (blocks come only with transactions). Height, time since the last block, the node list, the latest blocks |
| Blocks | `/blocks` | Latest blocks (live), older pages, search by height, block hash or txid |
| Block details | `/block/:hash` | Time, proposer (by node name), size, fees; each transaction's From and To (confidential amounts show as hidden), asset names |
| Wallet | `/wallet` | Wallet switcher; WBTC and each regulated asset added from Assets, with Send and Receive |
| New wallet | `/wallet/new` | 12-word recovery phrase (BIP39; key at `m/86'/1'/0'/0/0`) |
| Import | `/wallet/import` | Recovery phrase, key file, or hex secret |
| Back up | `/wallet/backup` | Reveal the phrase, download a key file, remove the wallet |
| Send / Receive | `/wallet/send`, `/wallet/receive` | WBTC: dry run on the node, then send; QR code and address. With `?asset=<regulated asset>`: a DAMP transfer (checked against a fresh wallet sync and the live blacklist, then signed and sent) and the wallet's holder address for that asset |
| Faucet | `/faucet` | Native coins to any address, rate-limited |
| Assets | `/assets` | Regulated assets: the DAMP registry's deployments, each added to this browser after checking it against the registry, the chain and the signer; its live blacklist; a link to the DAMP issuer console. Shown when `damp` is configured |
| Docs | `/docs` | Links into the node's documentation; common flows (connect, keys, balances, send, issue, Simplicity contract) in Rust and TypeScript, with a language switcher; `/docs#send` links to one |

Wallets are kept **unencrypted in the browser's localStorage**: this is a demo for test networks.
Transactions are built, blinded and signed in the page with `@wharfedale/sdk`; the server never
sees a key.

### Regulated assets (DAMP)

The wallet holds DAMP regulated assets: holders send them without the issuer, and the asset's
Simplicity covenant enforces the issuer's blacklist on every transfer. The app uses DAMP's own
browser modules (`../damp/apps/web/src/lib`, imported as `@damp/*`) and its signer, Rust compiled
to WebAssembly (~17 MB, loaded only on the wallet and asset pages). DAMP's keys come from the
recovery phrase, so wallets imported from a hex secret or key file hold WBTC only. Issuing, the
blacklist, reissuance and audit reports stay in the DAMP app (the issuer console).

The earlier asset tools (issuing WFA1-named assets on the Assets page; the wallet listing and
sending every asset it holds) are still in the code (`pages/Assets.tsx`, the classic branches of
`pages/Wallet.tsx` and `pages/Send.tsx`) and come back with `classicAssets: true`.

## Server

| Endpoint | |
|---|---|
| `POST /api/node` | JSON-RPC to `publicNode`, only: `getblockchaininfo`, `getblockcount`, `getblockhash`, `getrawtransaction`, `getscriptutxos`, `testmempoolaccept` (one transaction), `sendrawtransaction`; bodies up to 2 MiB |
| `GET /api/node/*` | Esplora GET paths (blocks, block txs, tx, tx outspends, scripthash, asset, address, mempool txids, fee estimates) |
| `POST /api/node/tx` | Esplora broadcast: one raw transaction (hex), up to 2 MiB |
| `GET /api/registry/*` | DAMP registry files from `damp.registryUrl`, only `deployments/index.json`, `deployments/<id>.json` and `policies/<id>/<script hash>.json` |
| `GET /api/network` | `getnetworkinfo` of every configured node, merged into `{nodes, edges, tip}` |
| `GET/POST /api/faucet` | Faucet status; pay `{address}` (a `wfc1…`/`wf1…` address; one payout per output script and per client IP every `cooldownMinutes`) |
| `GET /api/config` | Native asset label, faucet settings, the docs, lending and DAMP links, and `classicAssets` |
| `/*` | The built app |

The faucet serializes payouts and keeps at least `minCoins` spendable coins (it splits a large
coin when it runs low), so it can serve many requests per block: the node's mempool only spends
confirmed coins.

## Configuration

`config.json` (path from `WHARFEDALE_WEB_CONFIG`, default `./config.json`); see
`config.example.json`:

| Key | |
|---|---|
| `listen` | `host:port` |
| `publicNode` | The node the app reads from and submits to: use a full node (`role = "full"`) |
| `nodes` | `[{name, rpc}]` drawn on the network page (home) |
| `nativeAsset` | `{ticker, name, precision}` of the fee asset |
| `faucet` | `{keyFile, amount, cooldownMinutes, minCoins}`; omit to disable |
| `trustProxy` | `true` behind a reverse proxy: the faucet takes the client IP from the last `X-Forwarded-For` entry. Default `false` (socket address): never enable it without a proxy, or clients can pick their own IP |
| `docsUrl` | Base URL of the node's mdBook; default `https://wharfedalebtc.github.io/wharfedale/` |
| `publicRpcUrl` | The public node's address as visitors reach it, shown in the Docs examples; default `http://127.0.0.1:18447` |
| `lendingUrl` | The lending app ([simplicity-lending](https://github.com/WharfedaleBTC/simplicity-lending)); when set, the top bar links to it after Assets. Omit to hide the link |
| `damp` | `{registryUrl, appUrl}`: the DAMP registry directory (served by the DAMP app at `/registry/`) and the DAMP issuer console. Omit for a WBTC-only wallet and no Assets page |
| `classicAssets` | `true` restores the earlier asset tools in place of DAMP (see above). Default `false` |

The public addresses can also be set from the environment, which wins over the file:
`PUBLIC_RPC_URL` (`publicRpcUrl`), `LENDING_URL` (`lendingUrl`) and `DAMP_URL` (`damp.appUrl`,
when `damp` is set). A deployment can then keep every address visitors see in one `.env`.

## Run

With the node repository's Docker network, which builds this app from source:

```bash
make -C ../wharfedale run
```

Then open <http://localhost:8080>. From the published images instead (no source needed), see
`../demo-prod`. For development against that network:

```bash
docker compose -f ../wharfedale/docker/compose.yml cp node0:/net/faucet.json faucet.json
```

The app needs DAMP's checkout next to it (`../damp`, or `DAMP_DIR`) with its signer built:

```bash
make -C ../damp wasm
```

```bash
cp config.example.json config.json && npm install --ignore-scripts && npm run build && npm start
```

```bash
npm run dev
```

`npm run dev` serves the app with hot reload on :5173 and proxies `/api` to the server on :8080.

## Design

A light grey canvas, white surfaces, hairline rules and square corners; dark green (`#072a1d`)
for primary actions and dark fields, yellow-green (`#cdeb3f`) used small (live status, section
markers, registration marks). Archivo (variable width) for text, IBM Plex Mono (uppercase,
letterspaced) for numbers, labels and buttons.

- **Shell:** a fixed header (transparent over the home hero, white and blurred elsewhere; a full
  screen menu on small screens) and a dark green footer with a call to action, link columns,
  live chain facts and a full-width wordmark.
- **Pages:** each opens with a masthead: a numbered marker, a headline that rises word by word, a
  lede, an aside, and a rule that draws in. Content sits on a 12-column grid: a main column and a
  sticky aside (a dark summary or preview panel inside registration marks).
- **Motion:** sections reveal as they scroll in, numbers roll when they change, new blocks flash
  in, hovers draw rules and slide in dark fields. All of it is off under
  `prefers-reduced-motion`.
- **Scene:** `components/NetworkScene.tsx` lays the nodes on an isometric floor ring; the servers
  are SVG (`components/NodeGlyph.tsx`): faces are washes, edges hairlines, hidden edges dashed.
  Pulses use the block's `proposer` matched to each validator's consensus address (now in
  `/api/network`).

Tokens and components are in `app/src/styles.css`; the Docs page's examples are in
`app/src/lib/examples.ts` (keep them in step with the SDK READMEs).

## CI and images

`.github/workflows/ci.yml` builds and type-checks the app against `WharfedaleBTC/wharfedale-sdk-ts`
and `WharfedaleBTC/damp` (checked out next to it, as locally, with the DAMP workspace's path
dependencies: wharfedale, wharfedale-sdk-rs and malachite); the Dockerfile's `wasm` stage
compiles DAMP's signer, once per build whatever the image platforms. On `master` it publishes
`ghcr.io/wharfedalebtc/wharfedale-web:latest` (linux/amd64, linux/arm64) and keeps the built app
as a workflow artifact; a `vX.Y.Z` tag adds `:X.Y.Z` and a GitHub Release with the built app.

## Notes

- Built with Vite 7, React 19, React Router 7, TanStack Query 5, Hono 4. No graph library: the
  network scene is plain SVG.
- In the browser, `create-hash` and `create-hmac` (used by liquidjs-lib) are replaced by small
  `@noble/hashes` shims (`app/src/shims/`), so no Node stream polyfills are needed.
- Dependencies are pinned exactly to releases at least two weeks old; `.npmrc` sets
  `ignore-scripts=true`.

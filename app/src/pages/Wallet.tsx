import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { client, useChainInfo, type AssetRecord } from '../lib/api';
import { useAssetView } from '../lib/assets';
import { formatAmount, short } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';
import { useWallets, wallets } from '../lib/wallets';
import { Masthead } from '../components/Layout';
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from '../components/icons';
import { Marks, Ticker, reveal } from '../components/motion';
import { Qr } from '../components/Qr';
import { copyText } from '../lib/clipboard';

function AssetRow({ id, amount, tokenOf, index }: { id: string; amount: number; tokenOf?: AssetRecord; index: number }) {
  const view = useAssetView(tokenOf ? undefined : id);
  const parent = useAssetView(tokenOf?.asset_id);
  const name = tokenOf ? `${parent?.name ?? 'Asset'} token` : (view?.name ?? '…');
  const sub = tokenOf ? `mints more ${parent?.unit ?? ''} · ${id.slice(0, 8)}` : view?.native ? 'native · pays fees' : view ? `${view.unit} · ${id.slice(0, 8)}` : id.slice(0, 8);
  const shown = tokenOf ? String(amount) : formatAmount(amount, view?.precision ?? 0);
  return (
    <li className="asset-row" {...reveal('up', index * 60)}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: '0.5rem 0.75rem' }}>
          <span className="index__title">{name}</span>
          {view?.native && <span className="badge badge--accent">native</span>}
          {tokenOf && <span className="badge">token</span>}
        </div>
        <span className="data" style={{ display: 'block', marginTop: '0.375rem' }}>{sub}</span>
      </div>
      <div className="asset-row__amount">
        <Ticker value={shown} />
        <span className="amount__unit" style={{ display: 'block', marginTop: '0.25rem', letterSpacing: '0.12em' }}>{tokenOf ? 'token' : view?.unit}</span>
      </div>
      <div className="asset-row__actions">
        <Link to={`/wallet/send?asset=${id}`} className="button button--sm button--primary">
          Send <ArrowUpRight />
        </Link>
        <Link to="/wallet/receive" className="button button--sm button--secondary">
          Receive <ArrowDownLeft />
        </Link>
      </div>
    </li>
  );
}

function ReceiveCard({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="plate">
      <Marks />
      <div className="panel panel--dark on-dark stack-lg">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label label--mark">Receive</span>
          <span className="badge">confidential</span>
        </div>
        <div style={{ background: '#fff', padding: '0.875rem', alignSelf: 'flex-start' }}>
          <Qr text={address} size={132} />
        </div>
        <p className="mono" style={{ color: 'var(--paper-80)' }}>{short(address, 18, 14)}</p>
        <div className="button-row">
          <button
            className="button button--accent"
            onClick={async () => {
              setCopied(await copyText(address));
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <Link to="/wallet/receive" className="button button--outline-light">
            Full screen
          </Link>
        </div>
      </div>
    </div>
  );
}

export function WalletHome() {
  const { store, active, balances } = useActiveWallet();
  const { key } = useWallets();
  const feeAsset = useChainInfo().data?.feeAsset;
  const held = balances.data ?? [];
  // Asset records of held assets tell which held ids are their reissuance tokens.
  const records = useQueries({
    queries: held
      .filter(([id]) => id !== feeAsset)
      .map(([id]) => ({ queryKey: ['asset', id], staleTime: 30_000, queryFn: () => client.rest<AssetRecord>(`asset/${id}`).catch(() => null) })),
  });
  const tokenOf = new Map<string, AssetRecord>();
  for (const r of records) if (r.data?.reissuance_token) tokenOf.set(r.data.reissuance_token, r.data);
  const ordered = [...held].sort(([a], [b]) => (a === feeAsset ? -1 : b === feeAsset ? 1 : Number(tokenOf.has(a)) - Number(tokenOf.has(b))));

  if (!active || !key) {
    return (
      <main>
        <Masthead no="03" section="Wallet" title="Your wallet" lede="A recovery phrase, confidential payments and every asset you hold. Keys are made and kept in this browser." />
        <section className="shell section section--snug">
          <ol className="index" style={{ borderTop: 0 }}>
            {[
              ['/wallet/new', 'Create a wallet', 'A new 12-word recovery phrase. Write it down; it is the only way back in.'],
              ['/wallet/import', 'Import a wallet', 'From a recovery phrase, a key file from the CLI or SDKs, or a hex secret.'],
            ].map(([to, title, text], i) => (
              <li key={to} {...reveal('up', i * 80)}>
                <Link to={to!} className="index__row" style={{ paddingBlock: '2rem' }}>
                  <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="h1" style={{ display: 'block' }}>{title}</span>
                    <span className="index__text" style={{ display: 'block' }}>{text}</span>
                  </span>
                  <ArrowRight className="index__arrow" />
                </Link>
              </li>
            ))}
          </ol>
          <p className="hint" style={{ marginTop: '1.5rem' }}>Test network only: wallets are stored unencrypted.</p>
        </section>
      </main>
    );
  }
  return (
    <main>
      <Masthead
        no="03"
        section="Wallet"
        title={active.name}
        lede="Every asset this wallet holds, confirmed on chain."
        aside={
          <div className="stack-md">
            <div className="field">
              <label htmlFor="wallet">Switch wallet</label>
              <select id="wallet" className="select" value={active.name} onChange={(e) => wallets.select(e.target.value)}>
                {store.wallets.map((w) => (
                  <option key={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
            <nav aria-label="Wallet actions" className="row" style={{ gap: '0 1.5rem' }}>
              <Link to="/wallet/new" className="text-button link-rule">New</Link>
              <Link to="/wallet/import" className="text-button link-rule">Import</Link>
              <Link to="/wallet/backup" className="text-button link-rule">Back up</Link>
            </nav>
          </div>
        }
      />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main">
            <h2 className="label label--mark">Assets</h2>
            {balances.isError && <p className="notice notice--danger" style={{ marginTop: '1rem' }}>Can't load balances.</p>}
            {balances.data && held.length === 0 && (
              <div className="notice" style={{ marginTop: '1.5rem' }}>
                <strong>Nothing here yet.</strong> <Link className="text-link" to="/faucet">Get test coins</Link> or share your address to receive.
              </div>
            )}
            <ul style={{ marginTop: '1rem', borderTop: '1px solid var(--ink)' }}>
              {ordered.map(([id, amount], i) => (
                <AssetRow key={id} id={id} amount={amount} tokenOf={tokenOf.get(id)} index={i} />
              ))}
            </ul>
          </div>
          <div className="split__aside sticky">
            <ReceiveCard address={key.address()} />
            <p className="hint" style={{ marginTop: '1.5rem' }}>
              Keys stay in this browser and are for testing only. Need coins? <Link className="text-link" to="/faucet">Use the faucet</Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

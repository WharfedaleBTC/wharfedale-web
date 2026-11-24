import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FEE, validateMetadata } from '@wharfedale/sdk';
import { Masthead, SectionHead } from '../components/Layout';
import { Marks, reveal } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { client, useChainInfo, type AssetRecord } from '../lib/api';
import { amountText, useAssetView } from '../lib/assets';
import { formatAmount, parseAmount, short } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';

function Mine({ record, held, canMint, index }: { record: AssetRecord; held: number; canMint: boolean; index: number }) {
  const view = useAssetView(record.asset_id);
  const { wallet } = useActiveWallet();
  const qc = useQueryClient();
  const [minting, setMinting] = useState(false);
  const [more, setMore] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function mint() {
    setBusy(true);
    try {
      const base = parseAmount(more, view?.precision ?? 0);
      const txid = await wallet!.reissue(record.asset_id, base);
      setMsg({ ok: true, text: `Minted · ${short(txid)}` });
      setMinting(false);
      setMore('');
      qc.invalidateQueries({ queryKey: ['asset', record.asset_id] });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  const supply = record.chain_stats?.issued_amount;
  return (
    <li className="asset-row" {...reveal('up', index * 60)}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: '0.5rem 0.75rem' }}>
          <span className="index__title">{view?.name ?? '…'}</span>
          {view?.record?.ticker && <span className="badge badge--signal">{view.unit}</span>}
          {!record.reissuance_token && <span className="badge">fixed supply</span>}
        </div>
        <span className="data" style={{ display: 'block', marginTop: '0.375rem' }}>
          {record.asset_id.slice(0, 16)}… · you hold {amountText(view, held)}
        </span>
        {msg && <p className={msg.ok ? 'notice' : 'notice notice--danger'} style={{ marginTop: '0.75rem' }}>{msg.text}</p>}
      </div>
      <div className="asset-row__amount">
        {supply !== undefined ? formatAmount(supply, view?.precision ?? 0) : '…'}
        <span className="amount__unit" style={{ display: 'block', marginTop: '0.25rem' }}>supply</span>
      </div>
      <div className="asset-row__actions">
        {minting ? (
          <>
            <input className="input" style={{ height: '2.25rem', width: '9rem' }} inputMode="decimal" aria-label={`Amount of ${view?.unit} to mint`} placeholder="Amount" value={more} onChange={(e) => setMore(e.target.value)} />
            <button className="button button--sm button--primary" disabled={!more || busy} aria-busy={busy} onClick={mint}>Mint</button>
            <button className="button button--sm button--ghost" onClick={() => setMinting(false)}>Cancel</button>
          </>
        ) : (
          <>
            {canMint && <button className="button button--sm button--secondary" onClick={() => setMinting(true)}>Mint more</button>}
            <Link to={`/wallet/send?asset=${record.asset_id}`} className="button button--sm button--secondary">Send</Link>
          </>
        )}
      </div>
    </li>
  );
}

export function Assets() {
  const { active, wallet, balances } = useActiveWallet();
  const feeAsset = useChainInfo().data?.feeAsset;
  const native = useAssetView(feeAsset);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [precision, setPrecision] = useState('2');
  const [amount, setAmount] = useState('');
  const [mintable, setMintable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const held = new Map(balances.data ?? []);
  const records = useQueries({
    queries: [...held.keys()]
      .filter((id) => id !== feeAsset)
      .map((id) => ({ queryKey: ['asset', id], refetchInterval: 5_000, queryFn: () => client.rest<AssetRecord>(`asset/${id}`).catch(() => null) })),
  });
  const mine = records.map((r) => r.data).filter((r): r is AssetRecord => !!r);

  let error: string | null = null;
  let base = 0;
  const p = Number(precision);
  try {
    if (name || ticker) validateMetadata({ name, ticker, precision: p });
    if (amount) base = parseAmount(amount, p);
  } catch (e) {
    error = (e as Error).message;
  }
  // The canonical metadata the issuance commits to (sorted keys), as the node will see it.
  const json = JSON.stringify({ name: name.trim(), precision: p, ticker });
  const bytes = new TextEncoder().encode(json).length;

  async function create() {
    setBusy(true);
    setResult(null);
    try {
      const issued = await wallet!.issue(base, mintable ? 1 : 0, DEFAULT_FEE, { name: name.trim(), ticker, precision: p });
      setResult({ ok: true, text: `Created ${name.trim()} (${ticker} · ${issued.asset.slice(0, 8)}). It appears under your assets after the next block.` });
      setName('');
      setTicker('');
      setAmount('');
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return (
      <main>
        <Masthead
          no="05"
          section="Assets"
          title="Create an asset"
          lede={
            <>
              Assets are issued from your wallet. <Link className="text-link" to="/wallet/new">Create</Link> or <Link className="text-link" to="/wallet/import">import</Link> one first.
            </>
          }
        />
      </main>
    );
  }
  return (
    <main>
      <Masthead
        no="05"
        section="Assets"
        title="Create an asset"
        lede={
          <>
            Issued from {active!.name} for a fee of <span className="num" style={{ color: 'var(--ink)' }}>{amountText(native, DEFAULT_FEE)}</span>. The name, ticker and decimals go on chain with it.
          </>
        }
      />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main stack-lg">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" className="input" value={name} maxLength={64} placeholder="Demo Points" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="ticker">Ticker</label>
                <input id="ticker" className="input input--mono" value={ticker} maxLength={8} placeholder="DPT" onChange={(e) => setTicker(e.target.value.toUpperCase())} />
              </div>
              <div className="field">
                <label htmlFor="dec">Decimals</label>
                <select id="dec" className="select" value={precision} onChange={(e) => setPrecision(e.target.value)}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="supply">Amount</label>
              <div className="amount">
                <input id="supply" inputMode="decimal" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} />
                <span className="amount__unit">{ticker || 'units'}</span>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={mintable} onChange={(e) => setMintable(e.target.checked)} />
              <span>
                Allow minting more later
                <span className="hint" style={{ display: 'block' }}>Creates one reissuance token in this wallet</span>
              </span>
            </label>
            {error && <p className="notice notice--danger">{error}</p>}
            <button className="button button--lg button--primary button--full" disabled={busy || !!error || !name.trim() || !ticker || base <= 0} aria-busy={busy} onClick={create}>
              Create {name.trim() || 'asset'} <ArrowRight />
            </button>
            {result && (
              <p className={result.ok ? 'notice notice--ok' : 'notice notice--danger'} role="status">
                {result.text}
              </p>
            )}
          </div>
          <div className="split__aside sticky">
            <div className="plate">
              <Marks />
              <div className="panel panel--dark on-dark stack-lg">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="label label--mark">Preview</span>
                  {ticker && <span className="badge badge--accent">{ticker}</span>}
                </div>
                <div>
                  <div className="h1" style={{ color: '#fff' }}>{name.trim() || 'Unnamed asset'}</div>
                  <div className="num" style={{ marginTop: '1rem', fontSize: '2rem', letterSpacing: '-0.03em', color: '#fff' }}>
                    {base > 0 ? formatAmount(base, p) : (0).toFixed(p)}
                  </div>
                  <div className="label" style={{ marginTop: '0.5rem' }}>
                    {mintable ? 'initial supply · mintable' : 'fixed supply'}
                  </div>
                </div>
                <div className="stack">
                  <span className="label">On chain · OP_RETURN “WFA1”</span>
                  <p className="preview">
                    {json.split(/("[^"]*"|\d+)/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
                  </p>
                  <span className="label" style={{ color: bytes > 128 ? '#ffb4a6' : undefined }}>{bytes} / 128 bytes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="shell section section--flush-top" aria-labelledby="mine-h">
        <SectionHead id="mine-h" label="Issued by you" title="Your assets" aside="Supply is the total issued on chain, including later mints." />
        {mine.length === 0 ? (
          <p className="notice" style={{ marginTop: '1.5rem' }}>None yet.</p>
        ) : (
          <ul>
            {mine.map((r, i) => (
              <Mine key={r.asset_id} record={r} index={i} held={held.get(r.asset_id) ?? 0} canMint={!!r.reissuance_token && (held.get(r.reissuance_token) ?? 0) > 0} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// Issuing a plain asset: name, ticker and decimals go on chain in a WFA1 record next to the issuance.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_FEE, validateMetadata } from '@wharfedale/sdk';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { useChainInfo } from '../lib/api';
import { amountText, useAssetView } from '../lib/assets';
import { formatAmount, parseAmount } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';

/** `/assets/new`: issue a plain asset with its WFA1 name, ticker and decimals. */
export function CreateAsset() {
  const { active, wallet } = useActiveWallet();
  const feeAsset = useChainInfo().data?.feeAsset;
  const native = useAssetView(feeAsset);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [precision, setPrecision] = useState('2');
  const [amount, setAmount] = useState('');
  const [mintable, setMintable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; asset?: string } | null>(null);

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
      setResult({ ok: true, text: `Created ${name.trim()} (${ticker} · ${issued.asset.slice(0, 8)}). It is listed once the next block confirms it.`, asset: issued.asset });
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
        section="Assets · New plain asset"
        title="Create a plain asset"
        back={{ to: '/assets', label: 'Assets' }}
        lede={
          <>
            A named asset that moves to any address or contract, including Lending. Issued from {active!.name} for a fee of <span className="num" style={{ color: 'var(--ink)' }}>{amountText(native, DEFAULT_FEE)}</span>. The name, ticker and decimals go on chain with it.
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
                {result.text} {result.asset && <Link className="text-link" to={`/assets/${result.asset}`}>Open it</Link>}
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
      <section className="shell section section--flush-top">
        <p className="hint">Want holders to move it only under your blacklist? Create a regulated asset in the DAMP console instead.</p>
      </section>
    </main>
  );
}

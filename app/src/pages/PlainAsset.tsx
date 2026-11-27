// One plain asset: its on-chain name, supply and issuance history, your balance, and Mint more for
// the wallet that holds its reissuance token.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Masthead, SectionHead } from '../components/Layout';
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from '../components/icons';
import { client, useAssetRecord, type EsploraTx } from '../lib/api';
import { useAssetView } from '../lib/assets';
import { formatAmount, parseAmount, short } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';

const PAGE = 5;

type Issuance = { txid: string; height?: number; amount?: number; reissuance: boolean };

/** The asset's issuances, newest first, from its confirmed history (the most recent 250 transactions). */
function useIssuances(id: string) {
  return useQuery({
    queryKey: ['asset-issuances', id],
    staleTime: 15_000,
    queryFn: async () => {
      const found: Issuance[] = [];
      let last: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const txs = await client.rest<EsploraTx[]>(last ? `asset/${id}/txs/chain/${last}` : `asset/${id}/txs/chain`);
        for (const tx of txs) {
          for (const input of tx.vin as Array<{ issuance?: { asset_id?: string; is_reissuance?: boolean; assetamount?: number } | null }>) {
            if (input.issuance?.asset_id === id) found.push({ txid: tx.txid, height: tx.status.block_height, amount: input.issuance.assetamount, reissuance: !!input.issuance.is_reissuance });
          }
        }
        if (txs.length < 25) break;
        last = txs[txs.length - 1].txid;
      }
      return found;
    },
  });
}

function Mint({ id, precision, unit, onDone }: { id: string; precision: number; unit: string; onDone: () => void }) {
  const { wallet } = useActiveWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function mint() {
    setBusy(true);
    setMessage(null);
    try {
      const txid = await wallet!.reissue(id, parseAmount(amount, precision));
      setMessage({ ok: true, text: `Minted ${amount} ${unit} · ${short(txid)}. It counts once the next block confirms it.` });
      setOpen(false);
      setAmount('');
      onDone();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      {open ? (
        <div className="row" style={{ gap: '0.5rem' }}>
          <input className="input" style={{ height: '2.25rem', width: '9rem' }} inputMode="decimal" aria-label={`Amount of ${unit} to mint`} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="button button--sm button--primary" type="button" disabled={!amount || busy} aria-busy={busy} onClick={() => void mint()}>Mint</button>
          <button className="button button--sm button--ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      ) : (
        <div className="row" style={{ gap: '0.5rem 1rem' }}>
          <span className="hint">You hold its reissuance token.</span>
          <button className="text-button link-rule" type="button" onClick={() => setOpen(true)}>Mint more</button>
        </div>
      )}
      {message && <p className={message.ok ? 'hint' : 'hint err'} role="status">{message.text}</p>}
    </div>
  );
}

function History({ id, precision }: { id: string; precision: number }) {
  const issuances = useIssuances(id);
  const [page, setPage] = useState(0);
  if (issuances.isPending) return <p className="hint">Reading the asset's history…</p>;
  if (issuances.error) return <p className="notice notice--danger">{(issuances.error as Error).message}</p>;
  const all = issuances.data!;
  let total = 0;
  const totals = new Map<string, number>();
  for (const issuance of [...all].reverse()) {
    total += issuance.amount ?? 0;
    totals.set(issuance.txid, total);
  }
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const rows = all.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <>
      <table className="ledger">
        <thead><tr><th scope="col">Block</th><th scope="col">Event</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Total after</th><th scope="col">Transaction</th></tr></thead>
        <tbody>
          {rows.map((issuance) => (
            <tr key={issuance.txid}>
              <td>{issuance.height?.toLocaleString('en-US') ?? '—'}</td>
              <td>{issuance.reissuance ? 'Mint' : 'Initial issuance'}</td>
              <td className="num">{issuance.amount !== undefined ? formatAmount(issuance.amount, precision) : 'confidential'}</td>
              <td className="num">{formatAmount(totals.get(issuance.txid) ?? 0, precision)}</td>
              <td className="mono" title={issuance.txid}>{short(issuance.txid, 6, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="pager">
          <span className="hint">{page * PAGE + 1}–{Math.min(all.length, page * PAGE + PAGE)} of {all.length} issuances</span>
          <span className="button-row">
            <button className="button button--sm button--secondary" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
            <button className="button button--sm button--secondary" type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Older <ArrowRight /></button>
          </span>
        </div>
      )}
    </>
  );
}

export function PlainAsset() {
  const { id = '' } = useParams();
  const record = useAssetRecord(id);
  const view = useAssetView(id);
  const { wallet, balances } = useActiveWallet();
  const queryClient = useQueryClient();
  if (record.isPending || !view) return <main className="shell section"><p className="lead">Loading the asset…</p></main>;
  const r = record.data;
  if (!r) {
    return (
      <main className="shell section stack-md">
        <p className="lead">No asset with this id on this chain.</p>
        <Link className="text-link" to="/assets">All assets</Link>
      </main>
    );
  }
  const held = new Map(balances.data ?? []);
  const balance = held.get(id) ?? 0;
  const canMint = !!r.reissuance_token && (held.get(r.reissuance_token) ?? 0) > 0;
  const mintable = (r.chain_stats?.reissuance_tokens ?? 0) > 0;
  const named = !!(r.name && r.ticker);
  return (
    <main>
      <Masthead
        no="05"
        section={`Plain asset · ${view.unit}`}
        title={view.name}
        back={{ to: '/assets', label: 'Assets' }}
        lede="A plain asset on this chain: it moves to any address or contract, including Lending, and amounts stay confidential."
        aside={
          wallet ? (
            <div className="stack-md">
              <span className="label">In your wallet</span>
              <span className="figure__value">{formatAmount(balance, view.precision)} <span className="amount__unit">{view.unit}</span></span>
              <div className="button-row">
                <Link to={`/wallet/send?asset=${id}`} className="button button--primary">Send <ArrowUpRight /></Link>
                <Link to="/wallet/receive" className="button button--secondary">Receive <ArrowDownLeft /></Link>
              </div>
              {canMint && <Mint id={id} precision={view.precision} unit={view.unit} onDone={() => void queryClient.invalidateQueries({ queryKey: ['asset-issuances', id] })} />}
            </div>
          ) : undefined
        }
      />
      <section className="shell section section--snug">
        <div className="stack-xl asset-page">
          <dl className="facts">
            <dt>Issued</dt>
            <dd>{r.chain_stats?.issued_amount !== undefined ? `${formatAmount(r.chain_stats.issued_amount, view.precision)} ${view.unit}` : '—'}</dd>
            <dt>Supply</dt>
            <dd>{mintable ? "Mintable: the reissuance token's holder can mint more" : 'Fixed, nobody can mint more'}</dd>
            <dt>Decimals</dt>
            <dd>{view.precision}</dd>
            <dt>Issued in</dt>
            <dd>{r.status?.block_height !== undefined ? `Block ${r.status.block_height.toLocaleString('en-US')}` : 'Unconfirmed'}</dd>
          </dl>
          <section className="stack-md">
            <SectionHead label="History" title="Issuances" />
            <History id={id} precision={view.precision} />
          </section>
          <details className="details">
            <summary>Technical details</summary>
            <div className="details__body">
              <dl className="dl">
                <div><dt>Asset id</dt><dd className="mono">{short(id, 10, 8)}</dd></div>
                {r.reissuance_token && <div><dt>Reissuance token</dt><dd className="mono">{short(r.reissuance_token, 10, 8)}</dd></div>}
                <div><dt>On chain</dt><dd className="mono">{named ? `OP_RETURN “WFA1” ${JSON.stringify({ name: r.name, precision: r.precision ?? 0, ticker: r.ticker })}` : 'No WFA1 name record'}</dd></div>
              </dl>
            </div>
          </details>
        </div>
      </section>
    </main>
  );
}

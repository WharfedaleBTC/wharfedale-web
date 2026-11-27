// `/tx/:txid` and `/address/:address`: the targets of other apps' explorer links (the DAMP console,
// the lending app). A transaction opens its block at its row; an address lists its transactions.
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Masthead } from '../components/Layout';
import { ArrowRight } from '../components/icons';
import { client, type EsploraTx } from '../lib/api';
import { short } from '../lib/format';

export function TxRoute() {
  const { txid = '' } = useParams();
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ['tx-status', txid],
    enabled: /^[0-9a-f]{64}$/.test(txid),
    refetchInterval: (q) => (q.state.data?.confirmed ? false : 3_000),
    queryFn: () => client.rest<{ confirmed: boolean; block_hash?: string }>(`tx/${txid}/status`),
  });
  const hash = status.data?.block_hash;
  useEffect(() => {
    if (hash) navigate(`/block/${hash}#${txid}`, { replace: true });
  }, [hash, navigate, txid]);
  const lede = !/^[0-9a-f]{64}$/.test(txid)
    ? 'Not a transaction id.'
    : status.isError
      ? 'This node doesn’t know the transaction.'
      : status.data && !status.data.confirmed
        ? 'In the mempool: it opens in its block once it confirms.'
        : 'Finding its block…';
  return (
    <main>
      <Masthead no="02" section="Transaction" title="Transaction" back={{ to: '/blocks', label: 'Explorer' }} lede={<><span className="mono" style={{ color: 'var(--ink-3)', overflowWrap: 'anywhere' }}>{txid}</span><br />{lede}</>} />
    </main>
  );
}

export function AddressPage() {
  const { address = '' } = useParams();
  const txs = useQuery({
    queryKey: ['address-txs', address],
    refetchInterval: 10_000,
    queryFn: () => client.rest<EsploraTx[]>(`address/${address}/txs`),
  });
  return (
    <main>
      <Masthead no="02" section="Address" title="Address" back={{ to: '/blocks', label: 'Explorer' }} lede={<span className="mono" style={{ color: 'var(--ink-3)', overflowWrap: 'anywhere' }}>{address}</span>} />
      <section className="shell section section--snug">
        {txs.isPending ? (
          <p className="hint">Reading its transactions…</p>
        ) : txs.isError ? (
          <p className="notice notice--danger">This node can’t look up the address: {(txs.error as Error).message}</p>
        ) : !txs.data!.length ? (
          <p className="notice">No transactions yet.</p>
        ) : (
          <ol className="index">
            {txs.data!.map((tx) => (
              <li key={tx.txid}>
                <Link className="index__row" to={`/tx/${tx.txid}`}>
                  <span className="index-no">{tx.status.block_height?.toLocaleString('en-US') ?? '—'}</span>
                  <span>
                    <span className="index__title mono" style={{ display: 'block' }}>{short(tx.txid, 12, 10)}</span>
                    <span className="index__text" style={{ display: 'block' }}>{tx.status.confirmed ? `Block ${tx.status.block_height?.toLocaleString('en-US')}` : 'In the mempool'} · {tx.vin.length} in, {tx.vout.length} out</span>
                  </span>
                  <ArrowRight className="index__arrow" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

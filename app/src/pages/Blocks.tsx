import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { client, type EsploraBlock, type EsploraTx } from '../lib/api';
import { ago, short } from '../lib/format';
import { Masthead } from '../components/Layout';
import { ArrowRight, ArrowUpRight } from '../components/icons';
import { useNow } from '../components/motion';

export function Blocks() {
  const [params] = useSearchParams();
  const from = params.get('from');
  const blocks = useQuery({
    queryKey: ['blocks', from],
    queryFn: () => client.rest<EsploraBlock[]>(from ? `blocks/${from}` : 'blocks'),
    refetchInterval: from ? false : 1_000,
  });
  const navigate = useNavigate();
  const now = useNow();
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const s = q.trim().toLowerCase();
    try {
      if (/^\d+$/.test(s)) return navigate(`/block/${(await client.restText(`block-height/${s}`)).trim()}`);
      if (/^[0-9a-f]{64}$/.test(s)) {
        const block = await client.rest<EsploraBlock>(`block/${s}`).catch(() => null);
        if (block) return navigate(`/block/${s}`);
        const tx = await client.rest<EsploraTx>(`tx/${s}`);
        if (tx.status.block_hash) return navigate(`/block/${tx.status.block_hash}#${s}`);
        return setError('That transaction is not in a block yet.');
      }
      setError('Enter a block height, block hash or transaction id.');
    } catch {
      setError('Nothing found.');
    } finally {
      setBusy(false);
    }
  }

  const list = blocks.data ?? [];
  const last = list[list.length - 1];

  return (
    <main>
      <Masthead
        no="02"
        section="Explorer"
        title="Blocks"
        lede="Every block the validators have decided, newest first. Live while you watch."
        aside={
          <form onSubmit={search} className="stack" role="search">
            <label htmlFor="search" className="field__label">
              Height, block hash or txid
            </label>
            <div style={{ display: 'flex' }}>
              <input id="search" className="input input--mono" type="search" placeholder="2048 or 64 hex…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="button button--primary" style={{ height: '3.5rem', flex: 'none' }} aria-busy={busy} disabled={!q.trim()}>
                Find <ArrowRight />
              </button>
            </div>
            {error && <p className="notice notice--danger">{error}</p>}
          </form>
        }
      />
      <section className="shell section section--snug" aria-label="Blocks">
        {blocks.isError && <p className="notice notice--danger">Can't reach the node.</p>}
        <div className="index__row blocks-row" style={{ paddingBlock: '0.75rem', borderBottomColor: 'var(--ink)' }} aria-hidden="true">
          <span className="label">Height</span>
          <span className="label">Hash</span>
          <span className="label blocks-row__wide">Txs</span>
          <span className="label blocks-row__wide">Size</span>
          <span className="label" style={{ textAlign: 'right' }}>Age</span>
          <span />
        </div>
        <ol>
          {list.map((b, i) => (
            <li key={b.id} className={i === 0 && !from ? 'fresh' : undefined}>
              <Link to={`/block/${b.id}`} className="index__row blocks-row">
                <span className="blocks-row__height">{b.height.toLocaleString('en-US')}</span>
                <span className="data" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {short(b.id, 12, 10)}
                </span>
                <span className="data blocks-row__wide">{b.tx_count === 1 ? '1 tx' : `${b.tx_count} txs`}</span>
                <span className="data blocks-row__wide">{(b.size / 1000).toFixed(1)} kB</span>
                <span className="label" style={{ textAlign: 'right' }}>
                  {ago(b.timestamp, now)}
                </span>
                <ArrowUpRight className="index__arrow" />
              </Link>
            </li>
          ))}
        </ol>
        {last && last.height > 0 && (
          <div className="pager" style={{ marginTop: '2.5rem' }}>
            {from ? (
              <Link to="/blocks" className="button button--secondary">
                Latest
              </Link>
            ) : (
              <span />
            )}
            <Link to={`/blocks?from=${last.height - 1}`} className="button button--secondary">
              Older blocks <ArrowRight />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

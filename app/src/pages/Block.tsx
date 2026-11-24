import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, client, useChainInfo, type EsploraBlock, type EsploraTx } from '../lib/api';
import { Masthead } from '../components/Layout';
import { Tx } from '../components/Tx';
import { ArrowLeft, ArrowRight } from '../components/icons';
import { amountText, useAssetView } from '../lib/assets';
import { ago } from '../lib/format';
import { useNow } from '../components/motion';

const PAGE = 25;

export function Block() {
  const { hash = '' } = useParams();
  const location = useLocation();
  const now = useNow();
  const block = useQuery({ queryKey: ['block', hash], queryFn: () => client.rest<EsploraBlock>(`block/${hash}`) });
  const blockCount = useRef<number | undefined>(undefined);
  blockCount.current = block.data?.tx_count;
  const txs = useInfiniteQuery({
    queryKey: ['block-txs', hash],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => client.rest<EsploraTx[]>(`block/${hash}/txs/${pageParam}`),
    // The node answers 400 past the last transaction: stop at the block's tx_count.
    getNextPageParam: (last, all) => (last.length === PAGE && all.length * PAGE < (blockCount.current ?? Infinity) ? all.length * PAGE : undefined),
  });
  const tip = useChainInfo().data?.blocks;
  const next = useQuery({
    queryKey: ['block-height', (block.data?.height ?? -2) + 1],
    enabled: !!block.data && tip !== undefined && block.data.height < tip,
    queryFn: async () => (await client.restText(`block-height/${block.data!.height + 1}`)).trim(),
  });
  const graph = useQuery({ queryKey: ['network'], queryFn: api.network, staleTime: 30_000 });
  const list = txs.data?.pages.flat() ?? [];
  const fees = list.reduce((s, t) => s + (t.fee ?? 0), 0);
  const fee = useAssetView(useChainInfo().data?.feeAsset);

  useEffect(() => {
    if (location.hash && list.length) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash, list.length]);

  const b = block.data;
  if (block.isError) {
    return (
      <main>
        <Masthead no="02" section="Block" title="Block not found" back={{ to: '/blocks', label: 'Explorer' }} lede={<span className="mono">{hash}</span>} />
      </main>
    );
  }
  const proposer = b?.proposer ? graph.data?.nodes.find((n) => n.address === b.proposer) : undefined;
  return (
    <main>
      <Masthead
        no="02"
        section="Block"
        title={b ? `Block ${b.height.toLocaleString('en-US')}` : 'Block'}
        back={{ to: '/blocks', label: 'Explorer' }}
        lede={<span className="mono" style={{ color: 'var(--ink-3)' }}>{hash}</span>}
        aside={
          b && (
            <div className="button-row">
              {b.previousblockhash ? (
                <Link className="button button--secondary" to={`/block/${b.previousblockhash}`}>
                  <ArrowLeft className="button__icon" /> {(b.height - 1).toLocaleString('en-US')}
                </Link>
              ) : (
                <span />
              )}
              {next.data ? (
                <Link className="button button--secondary" to={`/block/${next.data}`}>
                  {(b.height + 1).toLocaleString('en-US')} <ArrowRight />
                </Link>
              ) : (
                <span className="button button--ghost" aria-disabled="true" style={{ cursor: 'default' }}>
                  <span className="live__dot" aria-hidden="true" /> Latest
                </span>
              )}
            </div>
          )
        }
      />
      <section className="shell section section--snug">
        {b && (
          <dl className="spec" style={{ borderTop: 0 }}>
            <div className="spec__cell">
              <dt className="spec__term">Time</dt>
              <dd className="spec__value">
                {new Date(b.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC
                <span className="data" style={{ display: 'block' }}>{ago(b.timestamp, now)}</span>
              </dd>
            </div>
            <div className="spec__cell">
              <dt className="spec__term">Proposer</dt>
              <dd className="spec__value">
                {proposer?.name ?? (b.proposer ? `${b.proposer.slice(0, 12)}…` : '—')}
                {proposer && <span className="data" style={{ display: 'block' }}>{b.proposer!.slice(0, 12)}…</span>}
              </dd>
            </div>
            <div className="spec__cell">
              <dt className="spec__term">Size</dt>
              <dd className="spec__value">
                {(b.size / 1000).toFixed(1)} kB<span className="data" style={{ display: 'block' }}>{b.weight.toLocaleString('en-US')} WU</span>
              </dd>
            </div>
            <div className="spec__cell">
              <dt className="spec__term">Fees</dt>
              <dd className="spec__value">
                {amountText(fee, fees)}
                <span className="data" style={{ display: 'block' }}>{b.tx_count === 1 ? '1 transaction' : `${b.tx_count} transactions`}</span>
              </dd>
            </div>
          </dl>
        )}
        <h2 className="label label--mark" style={{ marginTop: '4rem', marginBottom: '1rem' }}>
          Transactions
        </h2>
        <div>
          {list.map((t, i) => (
            <Tx key={t.txid} tx={t} index={i} />
          ))}
        </div>
        {txs.hasNextPage && (
          <button className="button button--secondary" style={{ marginTop: '2rem' }} onClick={() => txs.fetchNextPage()} aria-busy={txs.isFetchingNextPage}>
            More transactions
          </button>
        )}
      </section>
    </main>
  );
}

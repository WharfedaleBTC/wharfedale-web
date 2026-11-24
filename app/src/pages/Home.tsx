import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, client, useChainInfo, type EsploraBlock } from '../lib/api';
import { ago, short } from '../lib/format';
import { SectionHead } from '../components/Layout';
import { NetworkScene, nodeKind, nodeState, orderNodes } from '../components/NetworkScene';
import { NodeIcon } from '../components/NodeGlyph';
import { ArrowRight, ArrowUpRight, IconAsset, IconBlocks, IconDocs, IconDrop, IconWallet } from '../components/icons';
import { Marks, Ticker, Words, reveal, useNow } from '../components/motion';

const TILES = [
  { to: '/blocks', no: '02', name: 'Explorer', text: 'Blocks, transactions and on-chain asset names. Search by height, hash or txid.', Icon: IconBlocks },
  { to: '/wallet', no: '03', name: 'Wallet', text: 'A recovery phrase, confidential payments, every asset you hold.', Icon: IconWallet },
  { to: '/faucet', no: '04', name: 'Faucet', text: 'Native coins for fees and testing, to any address.', Icon: IconDrop },
  { to: '/assets', no: '05', name: 'Assets', text: 'Issue a named asset with its ticker and decimals on chain; mint more.', Icon: IconAsset },
  { to: '/docs', no: '06', name: 'Docs', text: 'The reference, and the common flows in Rust and TypeScript.', Icon: IconDocs },
];

export function Home() {
  const graph = useQuery({ queryKey: ['network'], queryFn: api.network, refetchInterval: 5_000 });
  const blocks = useQuery({ queryKey: ['blocks', null], queryFn: () => client.rest<EsploraBlock[]>('blocks'), refetchInterval: 1_000 });
  const chain = useChainInfo().data;
  const now = useNow();
  const g = graph.data;
  const list = blocks.data ?? [];
  const latest = list[0];
  const validators = g?.nodes.filter((n) => n.role === 'validator').length;
  const full = g?.nodes.filter((n) => n.role === 'full').length;
  const proposer = latest && g ? g.nodes.find((n) => n.address && n.address === latest.proposer) : undefined;
  const height = chain?.blocks ?? latest?.height;

  return (
    <>
      <section id="hero" className="hero on-dark" aria-labelledby="hero-title">
        <div className="hero__backdrop" aria-hidden="true">
          <div className="hero__bloom" />
          <div className="hero__wash" />
          <div className="hero__guides" />
          <div className="hero__number">{height !== undefined ? <Ticker value={String(height)} /> : null}</div>
          <div className="hero__rail">Malachite BFT · Elements · Confidential assets · Simplicity</div>
        </div>
        <div className="shell" style={{ position: 'relative' }}>
          <div className="hero__grid">
            <div className="hero__detail">
              <span className="label label--mark hero__in">01 — Live network</span>
              <h1 id="hero-title" className="hero__title d1">
                <Words text="The network, live." delay={120} />
              </h1>
              <div className="spec hero__in" style={{ '--d': '260ms' } as React.CSSProperties}>
                <div className="spec__cell">
                  <div className="spec__term">Height</div>
                  <div className="spec__value">{height !== undefined ? <Ticker value={height.toLocaleString('en-US')} /> : '…'}</div>
                </div>
                <div className="spec__cell">
                  <div className="spec__term">Last block</div>
                  <div className="spec__value">{latest ? ago(latest.timestamp, now) : '…'}</div>
                </div>
                <div className="spec__cell">
                  <div className="spec__term">Validators</div>
                  <div className="spec__value">{validators ?? '…'}</div>
                </div>
                <div className="spec__cell">
                  <div className="spec__term">Full nodes</div>
                  <div className="spec__value">{full ?? '…'}</div>
                </div>
              </div>
              <p className="hero__summary hero__in" style={{ '--d': '340ms' } as React.CSSProperties}>
                Validators agree on every block with Malachite BFT, and a block is made only when there is a transaction to put in it. Full nodes follow the
                chain, serve this app and relay transactions. Each pulse is a new block leaving the validator that proposed it.
              </p>
              <div className="hero__actions hero__in" style={{ '--d': '420ms' } as React.CSSProperties}>
                <Link to="/blocks" className="button button--lg button--light">
                  Open explorer <ArrowRight />
                </Link>
                <Link to="/faucet" className="button button--lg button--accent">
                  Get test coins
                </Link>
              </div>
            </div>
            <div className="hero__visual">
              <div className="plate hero__in" style={{ '--d': '200ms' } as React.CSSProperties}>
                <Marks />
                {g ? <NetworkScene graph={g} proposer={latest?.proposer} blockId={latest?.id} /> : <div style={{ aspectRatio: '3 / 2' }} />}
                <span className="tag" style={{ right: '-0.5rem', top: '1rem' }}>
                  <span className="live__dot" aria-hidden="true" /> Live · polled every 5 s
                </span>
                {latest && (
                  <span className="tag" style={{ left: '-0.5rem', bottom: '1rem' }}>
                    Block {latest.height.toLocaleString('en-US')}
                    {proposer ? ` · proposed by ${proposer.name}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="block-rail hero__in" style={{ '--d': '520ms' } as React.CSSProperties}>
            <div className="block-rail__row">
              <span className="label" style={{ flex: 'none' }}>
                Blocks
              </span>
              <ol className="block-rail__list" aria-label="Latest blocks">
                {list.slice(0, 8).map((b) => (
                  <li key={b.id} className="block-rail__item">
                    <Link to={`/block/${b.id}`} className="block-rail__link">
                      <span className="block-rail__track">
                        <span className="block-rail__fill" />
                      </span>
                      <span className="block-rail__name">
                        #{b.height.toLocaleString('en-US')} · {b.tx_count} tx
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section" aria-labelledby="nodes-h">
        <SectionHead
          id="nodes-h"
          label="Nodes"
          title="Who is online"
          aside={g ? `${g.nodes.length} nodes, ${g.edges.length} links. Heights and peers come from each node's getnetworkinfo.` : 'Polling the nodes…'}
        />
        <ol className="index" style={{ borderTop: 0 }}>
          {g &&
            orderNodes(g.nodes).map((node, i) => {
              const state = nodeState(node, g.tip);
              const behind = node.height !== null && g.tip !== null ? g.tip - node.height : 0;
              return (
                <li key={node.id} className="index__row" {...reveal('up', i * 60, { gridTemplateColumns: '2.5rem 3.5rem minmax(0, 1fr) auto' })}>
                  <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                  <NodeIcon kind={nodeKind(node)} state={state} />
                  <span style={{ minWidth: 0 }}>
                    <span className="index__title">{node.name}</span>
                    <span className="data" style={{ display: 'block', marginTop: '0.25rem' }}>
                      {node.id.startsWith('config:') ? 'from config' : `…${node.id.slice(-10)}`}
                      {node.address ? ` · ${node.address.slice(0, 10)}…` : ''}
                    </span>
                  </span>
                  <span className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem 1.5rem' }}>
                    <span className="data" style={{ textAlign: 'right' }}>
                      {!node.online
                        ? 'not answering'
                        : node.height === null
                          ? 'seen as a peer'
                          : `${node.height.toLocaleString('en-US')}${behind > 1 ? ` · ${behind} behind` : ''} · ${node.peers} peers${node.mempool !== null ? ` · ${node.mempool} in mempool` : ''}`}
                    </span>
                    <span
                      className={
                        state === 'offline' ? 'badge badge--danger' : state === 'lagging' ? 'badge badge--caution' : node.role === 'validator' ? 'badge badge--signal' : 'badge'
                      }
                    >
                      {state === 'offline' ? 'offline' : state === 'lagging' ? 'lagging' : node.role === 'full' ? 'full node' : node.role}
                    </span>
                  </span>
                </li>
              );
            })}
        </ol>
      </section>

      <section className="shell section section--flush-top" aria-labelledby="recent-h">
        <SectionHead
          id="recent-h"
          label="Explorer"
          title="Latest blocks"
          aside={
            <Link to="/blocks" className="button button--secondary">
              All blocks <ArrowRight />
            </Link>
          }
        />
        <ol className="index" style={{ borderTop: 0 }} aria-label="Latest blocks">
          {list.slice(0, 6).map((b, i) => (
            <li key={b.id} className={i === 0 ? 'fresh' : undefined}>
              <Link to={`/block/${b.id}`} className="index__row blocks-row">
                <span className="blocks-row__height">{b.height.toLocaleString('en-US')}</span>
                <span className="data" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {short(b.id, 10, 8)}
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
      </section>

      <section className="shell section section--flush-top" aria-labelledby="use-h">
        <SectionHead id="use-h" label="Use the network" title="Everything runs in your browser" aside="Keys are generated and kept in this page; transactions are built, blinded and signed here, then sent through a full node." />
        <div className="tiles" style={{ marginTop: '2.5rem' }}>
          {TILES.map((t, i) => (
            <Link key={t.to} to={t.to} className="tile" {...reveal('up', i * 70)}>
              <div className="tile__top">
                <span className="index-no">{t.no}</span>
                <t.Icon />
              </div>
              <div>
                <div className="tile__name">{t.name}</div>
                <p className="tile__text">{t.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

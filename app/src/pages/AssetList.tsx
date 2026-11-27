// The Assets page: every asset on this chain, plain and regulated, with search, a kind filter and
// pages. Plain assets come from the node's asset registry; regulated ones (DAMP) from the DAMP
// registry, passed in by the DAMP module when it is configured.
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Masthead, SectionHead } from '../components/Layout';
import { ArrowRight } from '../components/icons';
import { reveal } from '../components/motion';
import { useAllAssets, useChainInfo, useConfig, type AssetRecord } from '../lib/api';
import { formatAmount } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';

export type ListedAsset = {
  /** Row key and page id: the deployment id of a regulated asset, the asset id of a plain one. */
  key: string;
  assetId: string;
  kind: 'plain' | 'regulated';
  name: string;
  ticker: string;
  facts: string;
  inWallet: boolean;
  /** Regulated: the Add to wallet button. */
  action?: ReactNode;
  height: number;
};

const PAGE = 10;

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const issuedText = (record: AssetRecord | undefined, precision: number) =>
  record?.chain_stats?.issued_amount !== undefined ? `${formatAmount(record.chain_stats.issued_amount, precision)} issued` : 'issued amount unknown';

/** Plain assets: every registry record that isn't the fee asset or part of a regulated deployment. */
export function usePlainAssets(hidden: ReadonlySet<string>) {
  const registry = useAllAssets();
  const feeAsset = useChainInfo().data?.feeAsset;
  const { balances } = useActiveWallet();
  const held = useMemo(() => new Map(balances.data ?? []), [balances.data]);
  const items = useMemo<ListedAsset[]>(
    () =>
      (registry.data ?? [])
        .filter((r) => r.asset_id !== feeAsset && !hidden.has(r.asset_id))
        .map((r) => {
          const precision = r.name && r.ticker ? (r.precision ?? 0) : 0;
          const mintable = (r.chain_stats?.reissuance_tokens ?? 0) > 0;
          return {
            key: r.asset_id,
            assetId: r.asset_id,
            kind: 'plain' as const,
            name: r.name && r.ticker ? r.name : 'Unnamed asset',
            ticker: r.ticker ?? r.asset_id.slice(0, 6),
            facts: `${issuedText(r, precision)} · ${mintable ? 'mintable' : 'fixed supply'}`,
            inWallet: (held.get(r.asset_id) ?? 0) > 0,
            height: r.status?.block_height ?? Number.MAX_SAFE_INTEGER,
          };
        }),
    [registry.data, feeAsset, hidden, held],
  );
  return { items, registry };
}

function matches(item: ListedAsset, query: string) {
  const q = query.trim().toLowerCase();
  return !q || [item.name, item.ticker, item.assetId, item.key].some((field) => field.toLowerCase().includes(q));
}

function Pages({ page, pages, from, to, total, onPage }: { page: number; pages: number; from: number; to: number; total: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i).filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 1);
  return (
    <div className="pager">
      <span className="hint">{from}–{to} of {total} assets</span>
      <span className="button-row">
        <button className="button button--sm button--secondary" type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Newer</button>
        <span className="pager__pages">
          {numbers.map((n, i) => (
            <span key={n} className="row" style={{ gap: '0.25rem' }}>
              {i > 0 && n - numbers[i - 1] > 1 && <span className="hint">…</span>}
              <button className="pager__page" type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n + 1}</button>
            </span>
          ))}
        </span>
        <button className="button button--sm button--secondary" type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Older <ArrowRight /></button>
      </span>
    </div>
  );
}

export function AssetsListPage({ items, loading, error, notice, footer }: { items: ListedAsset[]; loading: boolean; error?: string | null; notice?: ReactNode; footer?: ReactNode }) {
  const appUrl = useConfig().data?.damp?.appUrl ?? null;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'plain' | 'regulated'>('all');
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => [...items].sort((a, b) => b.height - a.height || a.name.localeCompare(b.name)), [items]);
  const searched = sorted.filter((item) => matches(item, query));
  const shown = searched.filter((item) => kind === 'all' || item.kind === kind);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = shown.slice(current * PAGE, current * PAGE + PAGE);
  const count = (k: 'plain' | 'regulated') => searched.filter((item) => item.kind === k).length;
  const pick = (next: typeof kind) => {
    setKind(next);
    setPage(0);
  };

  return (
    <main>
      <Masthead
        no="05"
        section="Assets"
        title="Assets"
        lede="Every asset on this chain. Plain assets move anywhere, including into Lending. Regulated assets carry their issuer's blacklist on every transfer."
        aside={
          <div className="stack-md">
            <span className="label">Create</span>
            <div className="button-row">
              <Link className="button button--primary" to="/assets/new">Plain asset <ArrowRight /></Link>
              {appUrl && <a className="button button--secondary" href={`${appUrl}/#/assets/new`}>Regulated asset <ArrowRight /></a>}
            </div>
            {appUrl && <p className="hint">Regulated assets are created and managed in the DAMP console.</p>}
          </div>
        }
      />
      <section className="shell section section--snug">
        <div className="stack-xl">
          {notice}
          <section className="stack-md" aria-label="Assets on this chain">
            <SectionHead label="On this chain" title="All assets" />
            <div className="filter-bar">
              <label className="search">
                <span className="sr-only">Search assets</span>
                <SearchIcon />
                <input className="input" type="search" placeholder="Search by name, ticker or asset id" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
              </label>
              <div className="segmented" role="tablist" aria-label="Kind">
                <button role="tab" type="button" aria-selected={kind === 'all'} onClick={() => pick('all')}>All {searched.length}</button>
                <button role="tab" type="button" aria-selected={kind === 'plain'} onClick={() => pick('plain')}>Plain {count('plain')}</button>
                <button role="tab" type="button" aria-selected={kind === 'regulated'} onClick={() => pick('regulated')}>Regulated {count('regulated')}</button>
              </div>
            </div>
            <p className="hint" role={error ? 'alert' : 'status'}>
              {error ? error : loading && !items.length ? 'Reading the chain…' : `${shown.length} asset${shown.length === 1 ? '' : 's'} · ${items.filter((i) => i.inWallet).length} in your wallet`}
            </p>
            {rows.length > 0 && (
              <ol className="index">
                {rows.map((item, i) => (
                  <li key={item.key} {...reveal('up', i * 40)}>
                    <div className="index__row" style={{ gridTemplateColumns: '4.5rem minmax(0, 1fr) auto' }}>
                      <span className="index-no">{item.ticker}</span>
                      <span>
                        <span className="row" style={{ gap: '0.5rem 0.75rem' }}>
                          <Link className="index__title" to={`/assets/${item.key}`}>{item.name}</Link>
                          <span className={item.kind === 'regulated' ? 'badge badge--signal' : 'badge'}>{item.kind}</span>
                        </span>
                        <span className="index__text" style={{ display: 'block', marginTop: '0.25rem' }}>
                          {item.facts} · <span className="mono">{item.assetId.slice(0, 8)}</span>
                        </span>
                      </span>
                      <span className="row" style={{ gap: '0.5rem 1.25rem', justifyContent: 'flex-end' }}>
                        <Link className="text-button link-rule" to={`/assets/${item.key}`}>View</Link>
                        {item.inWallet ? <span className="badge badge--accent">In wallet</span> : item.action ?? (item.kind === 'plain' ? <span className="hint">Shows in your wallet when you hold it</span> : null)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {!loading && !shown.length && !error && <p className="notice">{query ? 'No asset matches.' : 'No assets yet.'}</p>}
            <Pages page={current} pages={pages} from={shown.length ? current * PAGE + 1 : 0} to={Math.min(shown.length, current * PAGE + PAGE)} total={shown.length} onPage={setPage} />
          </section>
          {footer}
        </div>
      </section>
    </main>
  );
}

/** The Assets page without DAMP: plain assets only. */
export function PlainAssetsPage() {
  const { items, registry } = usePlainAssets(useMemo(() => new Set<string>(), []));
  return <AssetsListPage items={items} loading={registry.isPending} error={registry.error ? `The node is unavailable: ${(registry.error as Error).message}` : null} />;
}

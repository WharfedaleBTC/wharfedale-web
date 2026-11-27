// One regulated asset: what it is, your coins (spendable or blocked), the issuer's blacklist and the
// history of policies, all from the registry and the chain. Works for assets not yet in the wallet.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatUnits, shortHash, userFacingError, type Deployment } from '@damp/domain';
import { blockedSince, describePolicyEvent, entryKey, holderTransfers, pageOf, type PolicyEvent } from '@damp/policy-timeline';
import { deploymentRegistryPath, registryFileUrl, type CanonicalDeployment } from '@damp/registry';
import { Masthead, SectionHead } from '../components/Layout';
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from '../components/icons';
import { useAddAsset } from './Assets';
import { Details, useAsset, useIssued, usePolicyTimeline, useRegulatedBalances } from './shared';
import { RemoveConfirm } from './WalletAssets';

const PAGE = 5;

export function Pager({ from, to, total, page, pages, noun, onPage }: { from: number; to: number; total: number; page: number; pages: number; noun: string; onPage: (page: number) => void }) {
  if (total <= PAGE) return null;
  return (
    <div className="pager">
      <span className="hint">{from}–{to} of {total} {noun}</span>
      <span className="button-row">
        <button className="button button--sm button--secondary" type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Newer</button>
        <button className="button button--sm button--secondary" type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Older <ArrowRight /></button>
      </span>
    </div>
  );
}

function PolicyHistory({ events }: { events: PolicyEvent[] }) {
  const [page, setPage] = useState(0);
  const view = pageOf(events, page, PAGE);
  return (
    <>
      <ol className="index">
        {view.rows.map((event) => (
          <li key={event.snapshot.policyRoot + event.snapshot.sequence}>
            <div className="index__row">
              <span className="index-no">#{event.snapshot.sequence + 1}</span>
              <span>
                <span className="index__title" style={{ display: 'block' }}>{describePolicyEvent(event)}</span>
                <span className="index__text" style={{ display: 'block' }}>
                  {event.blockHeight !== undefined ? `Block ${event.blockHeight.toLocaleString('en-US')}` : 'Unconfirmed'}
                  {event.txid && <> · tx <span className="mono">{shortHash(event.txid, 4, 4)}</span></>}
                </span>
              </span>
              <span className={event.active ? 'badge badge--signal' : 'badge'}>{event.active ? 'Active' : 'Replaced'}</span>
            </div>
          </li>
        ))}
      </ol>
      <Pager {...view} noun="policies" onPage={setPage} />
    </>
  );
}

function Coins({ deployment, blocked, paused }: { deployment: Deployment; blocked: Set<string>; paused: boolean }) {
  const { snapshot } = useRegulatedBalances();
  if (!snapshot) return <p className="hint">Syncing your coins…</p>;
  const coins = snapshot.utxos.filter((u) => u.source === 'holder' && u.deploymentId === deployment.deploymentId && (u.status === 'confirmed' || u.status === 'unconfirmed'));
  if (!coins.length) return <p className="hint">No coins yet. Share your receive address to get some.</p>;
  return (
    <table className="ledger">
      <thead>
        <tr><th scope="col">Coin</th><th scope="col">State</th><th scope="col" className="num">Amount</th></tr>
      </thead>
      <tbody>
        {coins.map((u) => {
          const key = `${u.txid}:${u.vout}`;
          return (
            <tr key={key}>
              <td className="mono">{shortHash(u.txid, 10, 6)}:{u.vout}</td>
              <td>
                {blocked.has(key) ? <span className="badge badge--danger">Blocked</span> : u.status === 'unconfirmed' ? <span className="badge badge--caution">Pending</span> : paused ? <span className="badge badge--caution">Paused</span> : <span className="badge badge--signal">Spendable</span>}
              </td>
              <td className="num">{formatUnits(u.amount, deployment.asset.precision)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Aside({ deployment, held, entry }: { deployment: Deployment; held: boolean; entry: CanonicalDeployment | null }) {
  const navigate = useNavigate();
  const { snapshot, balances } = useRegulatedBalances();
  const [confirming, setConfirming] = useState(false);
  const { add, adding, error } = useAddAsset();
  const { asset } = deployment;
  // After a confirmed removal the page re-renders without the asset: back to the wallet.
  const wasHeld = useRef(held);
  useEffect(() => {
    if (wasHeld.current && !held && confirming) {
      setConfirming(false);
      navigate('/wallet');
    }
    wasHeld.current = held;
  }, [held, confirming, navigate]);
  if (!held) {
    return (
      <div className="stack-md">
        <span className="label">Not in your wallet</span>
        <button className="button button--primary" type="button" disabled={!!adding} aria-busy={!!adding} onClick={() => entry && void add(entry)}>
          {adding ? 'Verifying…' : 'Add to wallet'}
        </button>
        {error && <p className="hint err">Couldn't add it: {error}</p>}
      </div>
    );
  }
  const balance = balances.get(deployment.regulatedAsset);
  return (
    <div className="stack-md">
      <span className="label">In your wallet</span>
      <span className="figure__value">
        {snapshot ? formatUnits(balance?.confirmed ?? 0n, asset.precision) : '—'} <span className="amount__unit">{asset.ticker}</span>
      </span>
      <div className="button-row">
        <Link to={`/wallet/send?asset=${deployment.regulatedAsset}`} className="button button--primary">Send <ArrowUpRight /></Link>
        <Link to={`/wallet/receive?asset=${deployment.regulatedAsset}`} className="button button--secondary">Receive <ArrowDownLeft /></Link>
        <button className="icon-x" type="button" aria-label={`Remove ${asset.name} from this wallet`} aria-expanded={confirming} onClick={() => setConfirming((c) => !c)}>×</button>
      </div>
      {confirming && <RemoveConfirm deployment={deployment} onCancel={() => setConfirming(false)} />}
    </div>
  );
}

function Section({ label, title, aside, children }: { label: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="stack-md">
      <SectionHead label={label} title={title} aside={aside} />
      {children}
    </section>
  );
}

export function RegulatedAssetPage({ fallback }: { fallback?: ReactNode }) {
  const { id: deploymentId = '' } = useParams();
  const { deployment, held, entry, pending, error } = useAsset(deploymentId);
  const timeline = usePolicyTimeline(deployment);
  const issued = useIssued(deployment);
  if (pending) return <main className="shell section"><p className="lead">Loading the asset…</p></main>;
  if (!deployment && fallback) return <>{fallback}</>;
  if (!deployment) {
    return (
      <main className="shell section stack-md">
        <p className="lead">{error ? `The registry is unavailable: ${userFacingError(error)}` : 'No regulated asset with this id is published on this chain.'}</p>
        <Link className="text-link" to="/assets">All regulated assets</Link>
      </main>
    );
  }
  const { asset } = deployment;
  const t = timeline.data;
  const policy = t?.policy ?? null;
  const blocked = new Set((policy?.entries ?? []).map(entryKey));
  const since = t ? blockedSince(t.events) : new Map<string, number>();
  const active = t?.events.find((e) => e.active);

  return (
    <main>
      <Masthead
        no="05"
        section={`Regulated asset · ${asset.ticker}`}
        title={asset.name}
        back={held ? { to: '/wallet', label: 'Wallet' } : { to: '/assets', label: 'Assets' }}
        lede="Issued with DAMP on this chain. You send it without asking the issuer; a covenant checks the issuer's blacklist on every transfer, and amounts stay confidential."
        aside={<Aside deployment={deployment} held={held} entry={entry} />}
      />
      <section className="shell section section--snug">
        <div className="stack-xl asset-page">
          {t && !policy && (
            <p className="notice notice--danger" role="status"><strong>Transfers are paused by the issuer.</strong> Your coins stay yours; you can send them again once the issuer resumes.</p>
          )}
          <dl className="facts">
            <dt>Issued</dt>
            <dd>{formatUnits(issued.data?.issued || BigInt(deployment.issuedSupply), asset.precision)} {asset.ticker}</dd>
            <dt>Supply</dt>
            <dd>{deployment.supplyMode === 'issuer-managed' ? 'Issuer managed, can mint more' : 'Fixed, nobody can mint more'}</dd>
            <dt>Blacklist</dt>
            <dd>{policy ? `${policy.entryCount} of ${2 ** policy.treeDepth} coins blocked` : timeline.isPending ? 'Checking…' : '—'}</dd>
            <dt>Policy</dt>
            <dd>{active ? `#${active.snapshot.sequence + 1}${active.blockHeight !== undefined ? `, since block ${active.blockHeight.toLocaleString('en-US')}` : ''}` : timeline.isPending ? 'Checking…' : '—'}</dd>
          </dl>
          {timeline.error && <p className="notice notice--danger" role="alert">Couldn't read the policy: {userFacingError(timeline.error)}</p>}
          {held && (
            <Section label="Your coins" title="Coins">
              <Coins deployment={deployment} blocked={blocked} paused={!!t?.paused} />
            </Section>
          )}
          {policy && (
            <Section label="Policy" title="Blacklist" aside={<span className="badge">{policy.entryCount} of {2 ** policy.treeDepth}</span>}>
              <p className="hint">The verifier refuses any transfer that spends one of these exact coins. Notes are the issuer's and public.</p>
              {policy.entries.length ? (
                <table className="ledger">
                  <thead><tr><th scope="col">Coin</th><th scope="col">Issuer note</th><th scope="col">Since</th></tr></thead>
                  <tbody>
                    {policy.entries.map((e) => (
                      <tr key={entryKey(e)}>
                        <td className="mono">{shortHash(e.txid, 10, 6)}:{e.vout}</td>
                        <td>{e.note ?? '—'}</td>
                        <td>{since.has(entryKey(e)) ? `Policy #${since.get(entryKey(e))}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">No coins are blocked.</p>
              )}
              {t && <p className="hint">Checked against the registry's policy file and the live verifier output <span className="mono">{shortHash(t.live.txid, 8, 6)}:0</span>.</p>}
            </Section>
          )}
          {t && t.events.length > 0 && (
            <Section label="History" title="Policy changes">
              <PolicyHistory events={t.events} />
            </Section>
          )}
          <Details label="Technical details">
            <dl className="dl">
              <div><dt>Asset id</dt><dd className="mono">{shortHash(deployment.regulatedAsset, 10, 8)}</dd></div>
              <div><dt>Deployment</dt><dd className="mono">{shortHash(deployment.deploymentId, 10, 8)}</dd></div>
              <div><dt>Issuer key</dt><dd className="mono">{shortHash(deployment.issuerPublicKey, 10, 8)}</dd></div>
              <div><dt>Audit key</dt><dd className="mono">{shortHash(deployment.audit.publicKey, 10, 8)}</dd></div>
              <div><dt>Verifier asset</dt><dd className="mono">1 unit of {shortHash(deployment.verifierAsset, 8, 4)}</dd></div>
              {t && <div><dt>Live verifier output</dt><dd className="mono">{shortHash(t.live.txid, 10, 6)}:0</dd></div>}
              {policy && <div><dt>Policy root</dt><dd className="mono">{shortHash(policy.policyRoot, 10, 8)} · depth {policy.treeDepth}</dd></div>}
              <div><dt>Precision</dt><dd>{asset.precision} decimals</dd></div>
              <div><dt>Transfers</dt><dd>{t ? holderTransfers(t, issued.data?.issuances).toLocaleString('en-US') : '—'}</dd></div>
              <div><dt>Registry</dt><dd><a className="text-link" href={registryFileUrl(deploymentRegistryPath(deployment.deploymentId))} target="_blank" rel="noreferrer">Manifest ↗</a></dd></div>
            </dl>
          </Details>
        </div>
      </section>
    </main>
  );
}

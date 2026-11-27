import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_FEE, destination } from '@wharfedale/sdk';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { client, useChainInfo, useConfig } from '../lib/api';
import { SendPage } from '../damp';
import { amountText, useAssetView } from '../lib/assets';
import { formatAmount, parseAmount, short } from '../lib/format';
import { useActiveWallet } from '../lib/useWallet';

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'sending' } | { kind: 'error'; message: string } | { kind: 'sent'; txid: string };

/** `/wallet/send?asset=…`: a regulated asset's transfer, or a plain payment. */
export function Send() {
  const [params] = useSearchParams();
  const feeAsset = useChainInfo().data?.feeAsset;
  const classic = useConfig().data?.classicAssets ?? false;
  const asset = params.get('asset');
  if (classic) return <PlainSend asset={asset ?? feeAsset} />;
  // A regulated asset's page when DAMP knows it; any other asset (WBTC or plain) is a plain payment.
  return <SendPage asset={asset && asset !== feeAsset ? asset : null} fallback={<PlainSend asset={asset ?? feeAsset} />} />;
}

function PlainSend({ asset }: { asset: string | undefined }) {
  const { wallet, balances } = useActiveWallet();
  const feeAsset = useChainInfo().data?.feeAsset;
  const view = useAssetView(asset ?? undefined);
  const fee = useAssetView(feeAsset);
  const available = balances.data?.find(([id]) => id === asset)?.[1] ?? 0;
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const confirmed = useQuery({
    queryKey: ['tx-height', status.kind === 'sent' ? status.txid : null],
    enabled: status.kind === 'sent',
    refetchInterval: (q) => (q.state.data ? false : 1_000),
    queryFn: () => client.txHeight((status as { txid: string }).txid).then((h) => h ?? null),
  });

  let dest: ReturnType<typeof destination> | null = null;
  try {
    dest = to.trim() ? destination(to.trim()) : null;
  } catch {
    dest = null;
  }
  let base: number | null = null;
  let amountError: string | null = null;
  try {
    base = amount ? parseAmount(amount, view?.precision ?? 0) : null;
  } catch (e) {
    amountError = (e as Error).message;
  }

  async function build() {
    if (!wallet || !dest || !base || !asset) throw new Error('fill in the address and amount');
    return wallet.buildSend(to.trim(), base, { asset, fee: DEFAULT_FEE });
  }
  async function check() {
    setStatus({ kind: 'checking' });
    try {
      const reason = await client.testAccept(await build());
      setStatus(reason ? { kind: 'error', message: reason } : { kind: 'ok' });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    }
  }
  async function send() {
    setStatus({ kind: 'sending' });
    try {
      setStatus({ kind: 'sent', txid: await client.sendTransaction(await build()) });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    }
  }

  if (!wallet) {
    return (
      <main>
        <Masthead no="03" section="Send" title="No wallet yet" back={{ to: '/wallet', label: 'Wallet' }} lede="Create or import a wallet first." />
      </main>
    );
  }
  const maxBase = asset === feeAsset ? Math.max(0, available - DEFAULT_FEE) : available;
  const busy = status.kind === 'checking' || status.kind === 'sending';
  const step = (n: number): 'done' | 'active' | 'error' | undefined => {
    const k = status.kind;
    if (n === 1) return k === 'checking' ? 'active' : k === 'ok' || k === 'sending' || k === 'sent' ? 'done' : k === 'error' ? 'error' : undefined;
    if (n === 2) return k === 'sending' ? 'active' : k === 'sent' ? 'done' : undefined;
    return k === 'sent' ? (confirmed.data ? 'done' : 'active') : undefined;
  };
  return (
    <main>
      <Masthead
        no="03"
        section="Send"
        title={`Send ${view?.name ?? ''}`.trim()}
        back={{ to: '/wallet', label: 'Wallet' }}
        lede={
          <>
            Available <span className="num" style={{ color: 'var(--ink)' }}>{amountText(view, available)}</span>
          </>
        }
      />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main stack-lg">
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" className="input input--mono" value={to} onChange={(e) => setTo(e.target.value)} placeholder="wfc1… or wf1…" spellCheck={false} autoComplete="off" />
              {to.trim() && (
                <span className="hint">
                  {!dest ? 'Not a Wharfedale address.' : dest.blindingKey ? 'Confidential address: the amount and asset are hidden on chain.' : 'Explicit address: the amount is visible on chain.'}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="amount">Amount</label>
              <div className="amount">
                <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoComplete="off" />
                <span className="amount__unit">{view?.unit}</span>
                <button className="button button--sm button--accent" type="button" onClick={() => setAmount(formatAmount(maxBase, view?.precision ?? 0).replace(/,/g, ''))}>
                  Max
                </button>
              </div>
              {amountError && <span className="err hint">{amountError}</span>}
            </div>
            <div className="button-row">
              <button className="button button--lg button--secondary" disabled={!dest || !base || busy} aria-busy={status.kind === 'checking'} onClick={check}>
                Check on node
              </button>
              <button className="button button--lg button--primary" disabled={!dest || !base || busy} aria-busy={status.kind === 'sending'} onClick={send}>
                Send {base ? amountText(view, base) : ''} <ArrowRight />
              </button>
            </div>
          </div>
          <div className="split__aside sticky">
            <div className="plate">
              <Marks />
              <div className="panel panel--dark on-dark stack-lg">
                <span className="label label--mark">Summary</span>
                <dl className="dl">
                  <div>
                    <dt>Amount</dt>
                    <dd>{base ? amountText(view, base) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Fee</dt>
                    <dd>{amountText(fee, DEFAULT_FEE)}</dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>{dest ? (dest.blindingKey ? 'confidential' : 'explicit') : '—'}</dd>
                  </div>
                </dl>
                <ol className="steps">
                  <li data-state={step(1)}>Node check</li>
                  <li data-state={step(2)}>Broadcast</li>
                  <li data-state={step(3)}>In a block</li>
                </ol>
                {status.kind === 'error' && <p className="notice notice--danger">{status.message}</p>}
                {status.kind === 'ok' && <p className="notice">The node would accept it.</p>}
                {status.kind === 'sent' && (
                  <p className="notice" role="status">
                    <span className="mono">{short(status.txid)}</span>
                    <br />
                    {confirmed.data ? (
                      <>
                        Confirmed in{' '}
                        <Link className="text-link" to={`/block-height/${confirmed.data}`}>
                          block {confirmed.data.toLocaleString('en-US')}
                        </Link>
                      </>
                    ) : (
                      'Waiting for a block…'
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

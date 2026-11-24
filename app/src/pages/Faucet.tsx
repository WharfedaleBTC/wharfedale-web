import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Masthead } from '../components/Layout';
import { Marks, Ticker } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { api, client, useChainInfo } from '../lib/api';
import { amountText, useAssetView } from '../lib/assets';
import { formatAmount, short } from '../lib/format';
import { useWallets } from '../lib/wallets';

export function Faucet() {
  const { active, key } = useWallets();
  const [address, setAddress] = useState('');
  useEffect(() => {
    if (key && !address) setAddress(key.address());
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const native = useAssetView(useChainInfo().data?.feeAsset);
  const status = useQuery({ queryKey: ['faucet'], queryFn: api.faucetStatus, refetchInterval: 5_000, retry: false });
  const pay = useMutation({ mutationFn: (a: string) => api.faucetPay(a.trim()) });
  const confirmed = useQuery({
    queryKey: ['tx-height', pay.data?.txid],
    enabled: !!pay.data,
    refetchInterval: (q) => (q.state.data ? false : 1_000),
    queryFn: () => client.txHeight(pay.data!.txid).then((h) => h ?? null),
  });
  const s = status.data;
  return (
    <main>
      <Masthead
        no="04"
        section="Faucet"
        title="Test coins"
        lede={s ? `Native coins for fees and testing, to any address, once every ${s.cooldownMinutes} minutes.` : status.isError ? 'The faucet is not enabled on this server.' : 'Native coins for fees and testing.'}
      />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main stack-lg">
            <div className="field">
              <label htmlFor="addr">Address</label>
              <input id="addr" className="input input--mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="wfc1… or wf1…" spellCheck={false} />
              {active && key && (address === key.address() ? <span className="hint">From your wallet, {active.name}</span> : (
                <button type="button" className="text-button" style={{ alignSelf: 'flex-start' }} onClick={() => setAddress(key.address())}>
                  Use {active.name}
                </button>
              ))}
            </div>
            <button className="button button--lg button--primary button--full" disabled={!address.trim() || pay.isPending || !s} aria-busy={pay.isPending} onClick={() => pay.mutate(address)}>
              Send me {s ? amountText(native, s.amount) : 'coins'} <ArrowRight />
            </button>
            {pay.isError && <p className="notice notice--danger">{(pay.error as Error).message}</p>}
            {pay.data && (
              <p className="notice notice--ok" role="status">
                <strong>Sent.</strong> <span className="mono">{short(pay.data.txid)}</span> ·{' '}
                {confirmed.data ? (
                  <>
                    confirmed in{' '}
                    <Link className="text-link" to={`/block-height/${confirmed.data}`}>
                      block {confirmed.data.toLocaleString('en-US')}
                    </Link>
                  </>
                ) : (
                  'waiting for a block…'
                )}
                {confirmed.data && (
                  <>
                    {' '}
                    · <Link className="text-link" to="/wallet">open the wallet</Link>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="split__aside sticky">
            <div className="plate">
              <Marks />
              <div className="panel panel--dark on-dark stack-lg">
                <span className="label label--mark">Per request</span>
                <div>
                  <div className="num" style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.75rem)', lineHeight: 1, letterSpacing: '-0.04em', color: '#fff' }}>
                    {s ? formatAmount(s.amount, native?.precision ?? 0) : '…'}
                  </div>
                  <div className="label" style={{ marginTop: '0.75rem' }}>{native ? `${native.name} · ${native.unit}` : ''}</div>
                </div>
                <dl className="dl">
                  <div>
                    <dt>Cooldown</dt>
                    <dd>{s ? `${s.cooldownMinutes} min per address and client` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Balance</dt>
                    <dd>{s ? <Ticker value={amountText(native, s.balance)} /> : '—'}</dd>
                  </div>
                  <div>
                    <dt>Coins ready</dt>
                    <dd>{s ? s.coins : '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

import type { EsploraIn, EsploraOut, EsploraTx } from '../lib/api';
import { amountText, useAssetView } from '../lib/assets';
import { short } from '../lib/format';
import { Flow } from './icons';
import { reveal } from './motion';

function Amount({ asset, value }: { asset?: string; value?: number }) {
  const view = useAssetView(asset);
  if (value === undefined || !asset) return <span className="muted">hidden</span>;
  return <span>{amountText(view, value)}</span>;
}

function IssuedName({ asset }: { asset: string }) {
  const view = useAssetView(asset);
  return <>{view && !view.native && view.record?.name ? `${view.name} (${view.unit} · ${asset.slice(0, 8)})` : asset.slice(0, 8)}</>;
}

function kind(tx: EsploraTx): string {
  if (tx.vin.some((i) => i.is_coinbase)) return 'coinbase';
  if (tx.vin.some((i) => i.issuance && !i.issuance.is_reissuance)) return 'issuance';
  if (tx.vin.some((i) => i.issuance)) return 'reissuance';
  if (tx.vin.some((i) => i.witness.length >= 4)) return 'contract';
  if (tx.vout.some((o) => o.valuecommitment)) return 'confidential';
  return 'transfer';
}

function who(o: EsploraOut): string {
  if (o.scriptpubkey_type === 'fee') return 'network fee';
  if (o.scriptpubkey_type === 'op_return') return o.scriptpubkey.startsWith('6a0457464131') ? 'asset name (on chain)' : 'data';
  return o.scriptpubkey_address ? short(o.scriptpubkey_address, 12, 10) : short(o.scriptpubkey, 10, 6);
}

function Line({ who, amount }: { who: React.ReactNode; amount?: React.ReactNode }) {
  return (
    <div className="tx__line">
      <span className="tx__who">{who}</span>
      <span className="tx__amount">{amount}</span>
    </div>
  );
}

function Input({ i }: { i: EsploraIn }) {
  if (i.is_coinbase) return <Line who="this block's fees, to its proposer" />;
  return (
    <>
      {i.issuance && (
        <Line
          who={
            <>
              {i.issuance.is_reissuance ? 'mints more ' : 'issues '}
              <IssuedName asset={i.issuance.asset_id} />
            </>
          }
          amount={i.issuance.assetamount !== undefined ? <Amount asset={i.issuance.asset_id} value={i.issuance.assetamount} /> : <span className="muted">hidden</span>}
        />
      )}
      <Line who={i.prevout ? who(i.prevout) : `${short(i.txid)}:${i.vout}`} amount={<Amount asset={i.prevout?.asset} value={i.prevout?.value} />} />
    </>
  );
}

export function Tx({ tx, index = 0 }: { tx: EsploraTx; index?: number }) {
  const k = kind(tx);
  return (
    <article id={tx.txid} className="tx" {...reveal('up', Math.min(index, 6) * 50)}>
      <div className="tx__head">
        <span className="index-no">{String(index + 1).padStart(2, '0')}</span>
        <span className="mono">{short(tx.txid, 12, 10)}</span>
        <span className={k === 'coinbase' ? 'badge' : k === 'issuance' || k === 'reissuance' ? 'badge badge--accent' : 'badge badge--signal'}>{k}</span>
      </div>
      <div className="tx__flow">
        <div className="tx__side">
          <div className="label" style={{ marginBottom: '0.25rem' }}>From</div>
          {tx.vin.map((i, n) => (
            <Input key={n} i={i} />
          ))}
        </div>
        <Flow />
        <div className="tx__side">
          <div className="label" style={{ marginBottom: '0.25rem' }}>To</div>
          {tx.vout.map((o, n) => (
            <Line key={n} who={who(o)} amount={o.scriptpubkey_type === 'op_return' && !o.value ? undefined : <Amount asset={o.asset} value={o.value} />} />
          ))}
        </div>
      </div>
    </article>
  );
}

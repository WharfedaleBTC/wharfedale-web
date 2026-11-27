import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChainInfo, useConfig } from '../lib/api';
import { ReceivePage } from '../damp';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { Qr } from '../components/Qr';
import { useWallets } from '../lib/wallets';
import { copyText } from '../lib/clipboard';

/** `/wallet/receive?asset=…`: a regulated asset's holder address, or the wallet address. */
export function Receive() {
  const [params] = useSearchParams();
  const feeAsset = useChainInfo().data?.feeAsset;
  const classic = useConfig().data?.classicAssets ?? false;
  const asset = params.get('asset');
  if (classic) return <PlainReceive classic />;
  return <ReceivePage asset={asset && asset !== feeAsset ? asset : null} fallback={<PlainReceive classic={false} />} />;
}

function PlainReceive({ classic }: { classic: boolean }) {
  const { active, key } = useWallets();
  const [explicit, setExplicit] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!key || !active) {
    return (
      <main>
        <Masthead no="03" section="Receive" title="No wallet yet" back={{ to: '/wallet', label: 'Wallet' }} lede="Create or import a wallet first." />
      </main>
    );
  }
  const address = explicit ? key.explicitAddress() : key.address();
  return (
    <main>
      <Masthead
        no="03"
        section="Receive"
        title="Receive"
        back={{ to: '/wallet', label: 'Wallet' }}
        lede={
          explicit
            ? 'Payments to this address show their amount and asset on chain.'
            : classic
              ? 'One address takes every asset. Payments to it hide the amount and asset on chain.'
              : 'Your WBTC address. Payments to it hide the amount on chain. Each regulated asset has its own holder address, on its Receive page.'
        }
      />
      <section className="shell section section--snug">
        <div className="split" style={{ alignItems: 'center' }}>
          <div className="split__half">
            <div className="qr-plate" key={address}>
              <Marks />
              <Qr text={address} />
            </div>
          </div>
          <div className="split__half stack-lg">
            <div role="tablist" aria-label="Address type" className="segmented">
              <button role="tab" aria-selected={!explicit} onClick={() => { setExplicit(false); setCopied(false); }}>Confidential</button>
              <button role="tab" aria-selected={explicit} onClick={() => { setExplicit(true); setCopied(false); }}>Explicit</button>
            </div>
            <div className="field">
              <span className="field__label">{explicit ? 'Explicit address' : 'Confidential address'}</span>
              <div className="address">{address}</div>
            </div>
            <div className="button-row">
              <button
                className="button button--lg button--primary"
                onClick={async () => {
                  setCopied(await copyText(address));
                }}
              >
                {copied ? 'Copied' : 'Copy address'}
              </button>
              <button className="button button--lg button--secondary" onClick={() => (navigator.share ? navigator.share({ text: address }).catch(() => undefined) : copyText(address))}>
                Share
              </button>
            </div>
            <p className="hint">{active.name} · the same key behind both addresses.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

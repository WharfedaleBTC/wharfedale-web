// Receive a regulated asset: the wallet's holder address for that deployment's covenant.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shortHash, userFacingError, type Deployment } from '@damp/domain';
import { ensureSignerHolderAddress } from '@damp/wallet-sync';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { Qr } from '../components/Qr';
import { copyText } from '../lib/clipboard';
import { Details, useSigner, useWalletGate } from './shared';

export function RegulatedReceive({ deployment }: { deployment: Deployment }) {
  const signer = useSigner();
  const gate = useWalletGate();
  const [copied, setCopied] = useState(false);
  const holder = useQuery({
    queryKey: ['damp-holder-address', deployment.deploymentId, signer.profileId],
    enabled: signer.connected && !!signer.profileId,
    queryFn: () => ensureSignerHolderAddress(deployment, signer.profileId!),
  });
  const address = holder.data?.confidentialAddress;
  return (
    <main>
      <Masthead
        no="03"
        section="Receive"
        title={`Receive ${deployment.asset.ticker}`}
        back={{ to: '/wallet', label: 'Wallet' }}
        lede={`Your holder address for ${deployment.asset.name}. It takes only this regulated asset; the sender's wallet checks it before sending.`}
      />
      <section className="shell section section--snug">
        {gate ? (
          <p className="notice">{gate}</p>
        ) : !signer.connected ? (
          <p className="hint" role="status">Opening the signer…</p>
        ) : holder.error ? (
          <p className="notice notice--danger" role="alert">{userFacingError(holder.error)}</p>
        ) : !address ? (
          <p className="hint" role="status">Deriving the holder address…</p>
        ) : (
          <div className="split" style={{ alignItems: 'center' }}>
            <div className="split__half">
              <div className="qr-plate" key={address}>
                <Marks />
                <Qr text={address} />
              </div>
            </div>
            <div className="split__half stack-lg">
              <div className="field">
                <span className="field__label">{deployment.asset.ticker} holder address</span>
                <div className="address">{address}</div>
              </div>
              <div className="button-row">
                <button className="button button--lg button--primary" onClick={async () => setCopied(await copyText(address))}>
                  {copied ? 'Copied' : 'Copy address'}
                </button>
              </div>
              <p className="hint">Network fees for sending it later are paid in WBTC from your wallet address, not from this one.</p>
              <Details label="What the sender checks">
                <dl className="dl">
                  <div><dt>Address</dt><dd>confidential, this network</dd></div>
                  <div><dt>Covenant</dt><dd>this deployment's holder program</dd></div>
                  <div><dt>Owner key</dt><dd>{shortHash(holder.data!.ownerPublicKey, 12, 10)}</dd></div>
                  <div><dt>Script</dt><dd>{shortHash(holder.data!.scriptPubkey, 12, 10)}</dd></div>
                </dl>
              </Details>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

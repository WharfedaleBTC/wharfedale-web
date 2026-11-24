import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key } from '@wharfedale/sdk';
import { Masthead } from '../components/Layout';
import { reveal } from '../components/motion';
import { useWallets, wallets } from '../lib/wallets';
import { Phrase } from './WalletNew';

function Part({ no, title, text, children }: { no: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="part" {...reveal('up')}>
      <div className="part__head">
        <span className="index-no">{no}</span>
        <h2 className="h1" style={{ marginTop: '0.75rem' }}>{title}</h2>
        <p className="hint" style={{ marginTop: '0.75rem', maxWidth: '24rem' }}>{text}</p>
      </div>
      <div className="part__body">{children}</div>
    </div>
  );
}

export function WalletBackup() {
  const { active } = useWallets();
  const [reveal_, setReveal] = useState(false);
  const navigate = useNavigate();
  if (!active) {
    return (
      <main>
        <Masthead no="03" section="Back up" title="No wallet yet" back={{ to: '/wallet', label: 'Wallet' }} lede="Create or import a wallet first." />
      </main>
    );
  }
  function download() {
    const blob = new Blob([Key.fromSecret(active!.secret).toJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${active!.name.replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <main>
      <Masthead
        no="03"
        section="Back up"
        title={`Back up ${active.name}`}
        back={{ to: '/wallet', label: 'Wallet' }}
        lede="Anyone who sees the recovery phrase can spend everything in this wallet. Reveal it only where nobody is watching."
      />
      <section className="shell section section--snug" style={{ paddingTop: 0 }}>
        <Part no="01" title="Recovery phrase" text="Twelve words that restore this wallet anywhere.">
          {!active.phrase ? (
            <p className="notice">This wallet was imported from a key, so it has no phrase. Download its key file instead.</p>
          ) : reveal_ ? (
            <Phrase phrase={active.phrase} />
          ) : (
            <div className="sealed on-dark">
              <span className="label">{active.phrase.split(' ').length} words, sealed</span>
              <button className="button button--accent" onClick={() => setReveal(true)}>Reveal phrase</button>
            </div>
          )}
        </Part>
        <Part no="02" title="Key file" text="The format the CLI and both SDKs read. It holds the derived key, not the phrase.">
          <button className="button button--lg button--secondary" onClick={download}>Download key file</button>
        </Part>
        <Part no="03" title="Remove from this browser" text="Funds stay on chain; import the wallet again with its phrase or key file.">
          <button
            className="button button--lg button--danger"
            onClick={() => {
              if (window.confirm(`Remove ${active.name} from this browser? Without its phrase or key file it can't be restored.`)) {
                wallets.remove(active.name);
                navigate('/wallet');
              }
            }}
          >
            Remove {active.name}
          </button>
        </Part>
      </section>
    </main>
  );
}

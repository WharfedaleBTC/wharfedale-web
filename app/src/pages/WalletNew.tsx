import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, generateMnemonic } from '@wharfedale/sdk';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { wallets, useWallets } from '../lib/wallets';
import { copyText } from '../lib/clipboard';

export function Phrase({ phrase }: { phrase: string }) {
  return (
    <div className="plate">
      <Marks />
      <ol className="phrase" aria-label="Recovery phrase" key={phrase}>
        {phrase.split(' ').map((w, i) => (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            <span className="w">{w}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WalletNew() {
  const { store } = useWallets();
  const [phrase, setPhrase] = useState(() => generateMnemonic(12));
  const [name, setName] = useState(() => (store.wallets.length ? `wallet ${store.wallets.length + 1}` : 'my wallet'));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  function create() {
    try {
      const key = Key.fromMnemonic(phrase);
      wallets.add({ name: name.trim(), phrase, secret: key.secretBytes().toString('hex') });
      navigate('/wallet');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main>
      <Masthead
        no="03"
        section="New wallet"
        title="Your recovery phrase"
        back={{ to: '/wallet', label: 'Wallet' }}
        lede="Write these 12 words down, in order, and keep them offline. They are the only way to restore this wallet in another browser."
      />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main stack-lg">
            <Phrase phrase={phrase} />
            <div className="button-row">
              <button
                className="button button--secondary"
                onClick={async () => {
                  setCopied(await copyText(phrase));
                }}
              >
                {copied ? 'Copied' : 'Copy words'}
              </button>
              <button
                className="button button--secondary"
                onClick={() => {
                  setPhrase(generateMnemonic(12));
                  setSaved(false);
                  setCopied(false);
                }}
              >
                New phrase
              </button>
            </div>
          </div>
          <div className="split__aside sticky stack-lg">
            <span className="label label--mark">Save it</span>
            <div className="field">
              <label htmlFor="name">Wallet name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I wrote the words down in order
            </label>
            {error && <p className="notice notice--danger">{error}</p>}
            <button className="button button--lg button--primary button--full" disabled={!saved || !name.trim()} onClick={create}>
              Create wallet <ArrowRight />
            </button>
            <p className="hint">BIP39, key at m/86′/1′/0′/0/0. Stored unencrypted in this browser: testing only.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

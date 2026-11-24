import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, isValidMnemonic } from '@wharfedale/sdk';
import { Masthead } from '../components/Layout';
import { ArrowRight } from '../components/icons';
import { wallets } from '../lib/wallets';

export function WalletImport() {
  const [tab, setTab] = useState<'phrase' | 'secret'>('phrase');
  const [text, setText] = useState('');
  const [name, setName] = useState('imported');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const phraseOk = tab === 'phrase' && isValidMnemonic(text);

  function importWallet() {
    setError(null);
    try {
      if (tab === 'phrase') {
        const key = Key.fromMnemonic(text);
        wallets.add({ name: name.trim(), phrase: text.trim().split(/\s+/).join(' ').toLowerCase(), secret: key.secretBytes().toString('hex') });
      } else {
        const t = text.trim();
        const key = t.startsWith('{') ? Key.fromJson(t) : Key.fromSecret(t);
        wallets.add({ name: name.trim(), secret: key.secretBytes().toString('hex') });
      }
      navigate('/wallet');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main>
      <Masthead no="03" section="Import" title="Import a wallet" back={{ to: '/wallet', label: 'Wallet' }} lede="From a recovery phrase, a key file, or a hex secret. It stays in this browser." />
      <section className="shell section section--snug">
        <div className="split">
          <div className="split__main stack-lg">
            <div role="tablist" aria-label="Import from" className="segmented">
              <button role="tab" aria-selected={tab === 'phrase'} onClick={() => setTab('phrase')}>Recovery phrase</button>
              <button role="tab" aria-selected={tab === 'secret'} onClick={() => setTab('secret')}>Key file or secret</button>
            </div>
            <div className="field">
              <label htmlFor="secret">{tab === 'phrase' ? '12 or 24 words, separated by spaces' : 'Key file contents ({"secret": "…"}) or 64 hex characters'}</label>
              <textarea id="secret" className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />
              {tab === 'phrase' && words > 0 && (
                <span className={phraseOk ? 'badge badge--signal' : 'badge'} style={{ alignSelf: 'flex-start' }}>
                  {words} words · {phraseOk ? 'checksum valid' : 'not a valid phrase yet'}
                </span>
              )}
              {tab === 'secret' && (
                <label className="button button--secondary" style={{ alignSelf: 'flex-start' }}>
                  Open key file…
                  <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => setText((await e.target.files?.[0]?.text()) ?? '')} />
                </label>
              )}
            </div>
          </div>
          <div className="split__aside sticky stack-lg">
            <span className="label label--mark">Name it</span>
            <div className="field">
              <label htmlFor="name">Wallet name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <p className="notice notice--danger">{error}</p>}
            <button className="button button--lg button--primary button--full" disabled={!name.trim() || !text.trim() || (tab === 'phrase' && !phraseOk)} onClick={importWallet}>
              Import <ArrowRight />
            </button>
            <p className="hint">Key files are the format the CLI and both SDKs write: {'{"secret": "<hex>"}'}.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useConfig } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { DOC_PAGES, EXAMPLES } from '../lib/examples';
import { Masthead, SectionHead } from '../components/Layout';
import { ArrowUpRight } from '../components/icons';
import { reveal } from '../components/motion';

type Lang = 'rust' | 'ts';
const LANG_KEY = 'wharfedale.docs.lang';

function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'ts' ? 'ts' : 'rust';
  } catch {
    return 'rust';
  }
}

function Code({ code, label, file }: { code: string; label: string; file: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <div className="code-head">
        <span>{file}</span>
        <button
          type="button"
          className="copy"
          data-done={copied ? '' : undefined}
          onClick={async () => {
            setCopied(await copyText(code));
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre aria-label={label} tabIndex={0} key={code} className="code-swap">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Which example is in view, for the side index. */
function useActive(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

export function Docs() {
  const docsUrl = useConfig().data?.docsUrl ?? 'https://wharfedalebtc.github.io/wharfedale/';
  // The examples name the local network's full node; show this deployment's public node instead.
  const rpc = useConfig().data?.publicRpcUrl ?? 'http://127.0.0.1:18447';
  const withRpc = (code: string) => code.split('http://127.0.0.1:18447').join(rpc);
  const [lang, setLang] = useState<Lang>(savedLang);
  const active = useActive(EXAMPLES.map((e) => e.id));
  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // not remembered; fine
    }
  };
  // Deep links to an example (/docs#send): the page renders after the browser looked for the id.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  const switcher = (
    <div role="tablist" aria-label="Language" className="segmented">
      <button role="tab" aria-selected={lang === 'rust'} onClick={() => choose('rust')}>Rust</button>
      <button role="tab" aria-selected={lang === 'ts'} onClick={() => choose('ts')}>TypeScript</button>
    </div>
  );

  return (
    <main>
      <Masthead
        no="06"
        section="Docs"
        title="Build on Wharfedale"
        lede="The node's reference documentation, and the common flows in both SDKs, ready to paste."
        aside={
          <a className="button button--lg button--primary button--full" href={docsUrl} target="_blank" rel="noreferrer">
            Open the reference <ArrowUpRight />
          </a>
        }
      />

      <section className="shell section section--snug" aria-labelledby="ex-h">
        <SectionHead
          id="ex-h"
          label="Examples"
          title="General flows"
          aside={
            <div className="stack-md">
              {switcher}
              <span className="hint">
                {lang === 'rust' ? (
                  <>
                    Crate <code>wharfedale-sdk</code>; re-exports rust-elements as <code>wharfedale_sdk::elements</code>.
                  </>
                ) : (
                  <>
                    Package <code>@wharfedale/sdk</code>, Node ≥ 22.3 or a browser bundle. Amounts in base units.
                  </>
                )}{' '}
                The node URL is the Docker network's full node.
              </span>
            </div>
          }
        />
        <div className="split" style={{ marginTop: '1rem' }}>
          <nav className="docs-nav sticky" aria-label="Examples">
            {EXAMPLES.map((e, i) => (
              <a key={e.id} href={`#${e.id}`} className="docs-nav__link" aria-current={active === e.id ? 'true' : undefined}>
                <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                {e.title}
              </a>
            ))}
          </nav>
          <ol className="docs-body">
            {EXAMPLES.map((e, i) => (
              <li key={e.id} id={e.id} className="example">
                <div {...reveal('up', 0, { display: 'flex', gap: '1.25rem', marginBottom: '1.25rem' })}>
                  <span className="index-no" style={{ paddingTop: '0.45rem' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="h1">{e.title}</h3>
                    <p className="hint" style={{ marginTop: '0.5rem', maxWidth: '42rem', fontSize: '0.9375rem' }}>{e.text}</p>
                  </div>
                </div>
                <Code code={withRpc(lang === 'rust' ? e.rust : e.ts)} file={lang === 'rust' ? 'main.rs' : 'main.ts'} label={`${e.title}, ${lang === 'rust' ? 'Rust' : 'TypeScript'}`} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell section section--flush-top" aria-labelledby="ref-h">
        <SectionHead id="ref-h" label="Reference" title="Documentation" aside="The mdBook published from the node repository. Opens in a new tab." />
        <ol className="index--cols" style={{ marginTop: '0.5rem' }}>
          {DOC_PAGES.map((p, i) => (
            <li key={p.path} {...reveal('up', (i % 2) * 60)}>
              <a className="index__row" href={docsUrl + p.path} target="_blank" rel="noreferrer">
                <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="index__title" style={{ display: 'block' }}>{p.title}</span>
                  <span className="index__text" style={{ display: 'block' }}>{p.text}</span>
                </span>
                <ArrowUpRight className="index__arrow" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

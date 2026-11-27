import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useChainInfo, useConfig } from '../lib/api';
import { useAssetView } from '../lib/assets';
import { ArrowLeft, ArrowRight } from './icons';
import { Ticker, Words, reveal, useReveal } from './motion';

export const NAV = [
  { to: '/', label: 'Network', no: '01' },
  { to: '/blocks', label: 'Explorer', no: '02' },
  { to: '/wallet', label: 'Wallet', no: '03' },
  { to: '/faucet', label: 'Faucet', no: '04' },
  { to: '/assets', label: 'Assets', no: '05' },
  { to: '/docs', label: 'Docs', no: '06' },
] as const;

type NavItem = { to: string; label: string; no: string; external?: boolean };

/**
 * The top bar's items: NAV, without Assets when there is nothing behind it (no DAMP and no
 * classicAssets), plus the lending app after Assets when the server names one.
 */
function useNavItems(): NavItem[] {
  const config = useConfig().data;
  const items: NavItem[] = NAV.filter((n) => n.to !== '/assets' || !config || config.classicAssets || config.damp);
  if (!config?.lendingUrl) return items;
  const at = Math.max(items.findIndex((n) => n.to === '/assets'), items.findIndex((n) => n.to === '/faucet')) + 1;
  return [...items.slice(0, at), { to: config.lendingUrl, label: 'Lending', no: '↗', external: true }, ...items.slice(at)];
}

function current(to: string, path: string) {
  if (to === '/') return path === '/';
  if (to === '/blocks') return path.startsWith('/block');
  return path === to || path.startsWith(`${to}/`);
}

function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className={light ? 'logo logo--light' : 'logo'} aria-label="Wharfedale, live network">
      <span className="logo__mark" aria-hidden="true">WF</span>
      <span className="logo__name">Wharfedale</span>
    </Link>
  );
}

function Header({ over, menu, setMenu }: { over: boolean; menu: boolean; setMenu: (v: boolean) => void }) {
  const chain = useChainInfo().data;
  const path = useLocation().pathname;
  const nav = useNavItems();
  return (
    <header className={over || menu ? 'site-header site-header--over' : 'site-header'}>
      <div className="site-header__bar">
        <Logo />
        <nav aria-label="Main" className="primary-nav">
          {nav.map((n) =>
            n.external ? (
              <a key={n.to} href={n.to} className="nav-link">
                {n.label}
              </a>
            ) : (
              <NavLink key={n.to} to={n.to} className="nav-link" aria-current={current(n.to, path) ? 'page' : undefined}>
                {n.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="header-tools">
          <Link to={chain ? `/block-height/${chain.blocks}` : '/blocks'} className="live" aria-label={chain ? `Latest block, height ${chain.blocks}` : 'Connecting to the node'}>
            <span className={chain ? 'live__dot' : 'live__dot live__dot--off'} aria-hidden="true" />
            {chain ? (
              <span>
                <span className="sr-only">Height </span>
                <Ticker value={chain.blocks.toLocaleString('en-US')} />
              </span>
            ) : (
              'Connecting'
            )}
          </Link>
          <Link to="/faucet" className="button button--sm button--accent header-cta">
            Get coins
          </Link>
          <button type="button" className="menu-toggle" aria-expanded={menu} aria-controls="menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(!menu)}>
            <span className="menu-toggle__bar" />
            <span className="menu-toggle__bar" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Menu({ close }: { close: () => void }) {
  const path = useLocation().pathname;
  const nav = useNavItems();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);
  return (
    <div id="menu" className="menu on-dark" role="dialog" aria-modal="true" aria-label="Menu">
      <nav aria-label="Main" className="menu__list">
        {nav.map((n, i) =>
          n.external ? (
            <a key={n.to} href={n.to} className="menu__link" style={{ '--i': i } as React.CSSProperties} onClick={close}>
              <span className="index-no">{n.no}</span>
              {n.label}
            </a>
          ) : (
            <Link key={n.to} to={n.to} className="menu__link" aria-current={current(n.to, path) ? 'page' : undefined} style={{ '--i': i } as React.CSSProperties} onClick={close}>
              <span className="index-no">{n.no}</span>
              {n.label}
            </Link>
          ),
        )}
      </nav>
      <div className="menu__foot">
        <span className="label">Test network · keys stay in this browser</span>
        <Link to="/faucet" className="button button--sm button--accent" onClick={close}>
          Get coins
        </Link>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string, boolean?][] }) {
  return (
    <div>
      <h2 className="footer-col__heading">{title}</h2>
      <ul className="footer-col__list">
        {links.map(([label, to, external]) => (
          <li key={label}>
            {external ? (
              <a className="footer-col__link" href={to} target="_blank" rel="noreferrer">
                {label} ↗
              </a>
            ) : (
              <Link className="footer-col__link" to={to}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  const config = useConfig().data;
  const chain = useChainInfo().data;
  const native = useAssetView(chain?.feeAsset);
  const docs = config?.docsUrl ?? 'https://wharfedalebtc.github.io/wharfedale/';
  const unit = config?.nativeAsset.ticker ?? '';
  return (
    <footer className="site-footer on-dark">
      <div className="shell">
        <div className="footer-cta">
          <div className="footer-cta__main">
            <span className="label label--mark" {...reveal('left')}>
              Developers
            </span>
            <p className="footer-cta__title d2" {...reveal('up', 80)}>
              Build on Wharfedale.
            </p>
          </div>
          <div className="footer-cta__aside stack-lg" {...reveal('up', 160)}>
            <p className="footer-cta__body">Rust and TypeScript SDKs, an Esplora-compatible REST API, confidential assets and Simplicity contracts.</p>
            <div className="button-row">
              <Link to="/docs" className="button button--lg button--accent">
                Read the docs <ArrowRight />
              </Link>
              <Link to="/blocks" className="button button--lg button--outline-light">
                Explorer
              </Link>
            </div>
          </div>
        </div>
        <div className="footer-columns">
          <div className="footer-columns__identity">
            <Logo light />
            <p className="footer-columns__text">
              A private L1: Malachite BFT consensus, the Elements transaction format with confidential assets, and Simplicity contracts.
            </p>
          </div>
          <FooterCol title="Network" links={[['Live network', '/'], ['Explorer', '/blocks'], ['Latest block', chain ? `/block-height/${chain.blocks}` : '/blocks']]} />
          <FooterCol title="Wallet" links={[['Wallet', '/wallet'], ['New wallet', '/wallet/new'], ['Import', '/wallet/import'], ['Faucet', '/faucet'], ['Assets', '/assets']]} />
          <FooterCol title="Developers" links={[['Examples', '/docs'], ['Reference', docs, true], ['RPC and Esplora', `${docs}rpc.html`, true], ['SDKs', `${docs}sdk.html`, true]]} />
        </div>
        <dl className="footer-stats">
          <div>
            <dt className="footer-stats__term">Chain</dt>
            <dd className="footer-stats__value">{chain?.chain ?? '…'}</dd>
          </div>
          <div>
            <dt className="footer-stats__term">Height</dt>
            <dd className="footer-stats__value">{chain ? <Ticker value={chain.blocks.toLocaleString('en-US')} /> : '…'}</dd>
          </div>
          <div>
            <dt className="footer-stats__term">Native asset</dt>
            <dd className="footer-stats__value">{native ? `${native.name} · ${native.unit}` : '…'}</dd>
          </div>
          <div>
            <dt className="footer-stats__term">Faucet</dt>
            <dd className="footer-stats__value">
              {config?.faucet ? `${config.faucet.amount.toLocaleString('en-US')} ${unit} / ${config.faucet.cooldownMinutes} min` : config ? 'off' : '…'}
            </dd>
          </div>
        </dl>
        <div className="footer-legal">
          <p className="footer-legal__text">
            A test network. Wallets live unencrypted in this browser's storage: never put real value in them. Transactions are built and signed in the page; the
            server never sees a key.
          </p>
          <button type="button" className="text-button" style={{ color: 'var(--paper-70)' }} onClick={() => window.scrollTo({ top: 0 })}>
            Back to top ↑
          </button>
        </div>
      </div>
      <svg className="footer-mark" viewBox="0 0 1000 132" preserveAspectRatio="none" aria-hidden="true" {...reveal('up')}>
        <text x="0" y="128" textLength="1000" lengthAdjust="spacingAndGlyphs">
          WHARFEDALE
        </text>
      </svg>
    </footer>
  );
}

export function Layout() {
  const path = useLocation().pathname;
  const home = path === '/';
  const [menu, setMenu] = useState(false);
  const [over, setOver] = useState(home);
  useReveal();

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!home) return setOver(false);
    const onScroll = () => {
      const hero = document.getElementById('hero');
      setOver(window.scrollY < (hero?.offsetHeight ?? window.innerHeight) - 72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [home]);

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Header over={over} menu={menu} setMenu={setMenu} />
      {menu && <Menu close={() => setMenu(false)} />}
      <div id="content" className={home ? 'main main--bleed' : 'main'}>
        <Outlet />
      </div>
      <Footer />
      <ScrollRestoration />
    </>
  );
}

/** A page's opening: numbered marker, a headline that rises word by word, a lede, an aside, a ruled foot. */
export function Masthead({ no, section, title, lede, aside, back }: { no: string; section: string; title: string; lede?: ReactNode; aside?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="masthead shell">
      <span className="masthead__no" aria-hidden="true">
        {no}
      </span>
      <div className="masthead__grid">
        <div className="masthead__main">
          {back && <Back to={back.to} label={back.label} />}
          <span className="label label--mark" {...reveal('left')}>
            {no} — {section}
          </span>
          <h1 className="masthead__title d2">
            <Words text={title} />
          </h1>
          {lede && (
            <div className="masthead__lede lead" {...reveal('up', 220)}>
              {lede}
            </div>
          )}
        </div>
        {aside && (
          <div className="masthead__aside" {...reveal('up', 320)}>
            {aside}
          </div>
        )}
      </div>
      <div className="masthead__rule" aria-hidden="true" />
    </header>
  );
}

/** A section's heading: marker, title, an optional aside, a hairline under it. */
export function SectionHead({ label, title, aside, id }: { label: string; title: string; aside?: ReactNode; id?: string }) {
  return (
    <div className="section-head">
      <div className="section-head__main">
        <span className="label label--mark" {...reveal('left')}>
          {label}
        </span>
        <h2 className="section-head__title d3" id={id} {...reveal('up', 80)}>
          {title}
        </h2>
      </div>
      {aside && (
        <div className="section-head__aside" {...reveal('up', 160)}>
          {aside}
        </div>
      )}
    </div>
  );
}

export function Back({ to, label }: { to: string; label: string }) {
  return (
    <div>
      <Link to={to} className="back">
        <ArrowLeft />
        {label}
      </Link>
    </div>
  );
}


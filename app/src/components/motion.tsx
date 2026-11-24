// Motion: scroll reveals, word-by-word headlines, ticking numbers. Everything renders in place
// when the visitor prefers reduced motion (the hidden states hang off `.js-motion`).
import { useEffect, useState, type CSSProperties } from 'react';

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion) document.documentElement.classList.add('js-motion');

/** Marks every `[data-reveal]` element "in" once it scrolls into view, including ones rendered later. */
export function useReveal() {
  useEffect(() => {
    if (reducedMotion) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.dataset.reveal = `${el.dataset.reveal ?? ''} in`;
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    const scan = () =>
      document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-watched])').forEach((el) => {
        el.dataset.watched = '';
        io.observe(el);
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}

/** Reveal props with a stagger delay. */
export function reveal(kind: 'up' | 'left' | 'right' | 'scale' | 'clip' | 'rule' = 'up', delay = 0, style?: CSSProperties) {
  return { 'data-reveal': kind, style: { ...style, '--reveal-delay': `${delay}ms` } as CSSProperties };
}

/** A headline whose words rise into place, one beat apart. Replays when the text changes. */
export function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    setShown(false);
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, [text]);
  const words = text.split(' ');
  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="words" data-shown={shown ? '' : undefined} aria-hidden="true">
        {words.map((w, i) => (
          <span key={`${i}-${w}`}>
            <span className="words__mask">
              <span className="words__word" style={{ '--d': `${delay + i * 70}ms` } as CSSProperties}>
                {w}
              </span>
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </>
  );
}

/** A value that rolls up into place each time it changes. */
export function Ticker({ value }: { value: string }) {
  return (
    <span className="ticker">
      <span key={value} className="ticker__v">
        {value}
      </span>
    </span>
  );
}

/** Registration marks at a plate's four corners. */
export function Marks() {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
        <span key={p} className={`mark mark--${p}`} aria-hidden="true" />
      ))}
    </>
  );
}

/** Ticks once a second, for "n s ago" labels. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

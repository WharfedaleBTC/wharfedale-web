// The live network as an isometric scene: nodes stand on a floor grid around a ring, links run
// along the floor, and each new block sends pulses out from the validator that proposed it.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { NetworkGraph } from '../lib/api';
import { DARK, NodeGlyph, footprint, glyphTop, iso, type NodeKind, type NodeState, type Pt } from './NodeGlyph';
import { reducedMotion } from './motion';

type Node = NetworkGraph['nodes'][number];

export function nodeState(n: Node, tip: number | null): NodeState {
  if (!n.online) return 'offline';
  if (!n.configured) return 'unpolled';
  if (n.height !== null && tip !== null && tip - n.height > 1) return 'lagging';
  return 'ok';
}

export const nodeKind = (n: Node): NodeKind => (n.role === 'full' ? 'full' : 'validator');
const rank = (n: Node) => (n.role === 'validator' ? 0 : n.role === 'full' ? 1 : 2);
export const orderNodes = (nodes: Node[]) => [...nodes].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

function meta(n: Node, tip: number | null): { text: string; warn: boolean } {
  if (!n.online) return { text: 'NOT ANSWERING', warn: true };
  if (n.height === null) return { text: 'PEER', warn: false };
  const behind = tip !== null ? tip - n.height : 0;
  return behind > 1 ? { text: `${behind} BEHIND`, warn: true } : { text: n.height.toLocaleString('en-US'), warn: false };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function NetworkScene({ graph, proposer, blockId }: { graph: NetworkGraph; proposer?: string | null; blockId?: string }) {
  const id = useId().replace(/:/g, '');
  const order = useMemo(() => orderNodes(graph.nodes), [graph.nodes]);
  const key = order.map((n) => n.id).join(',');
  const n = order.length;
  const R = n <= 1 ? 0 : Math.max(150, 46 * n);

  const pos = useMemo(() => {
    const m = new Map<string, Pt>();
    order.forEach((node, i) => {
      const a = -0.75 * Math.PI + (i * 2 * Math.PI) / Math.max(n, 1);
      m.set(node.id, iso(R * Math.cos(a), R * Math.sin(a)));
    });
    return m;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const adj = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of graph.edges) {
      m.set(e.source, [...(m.get(e.source) ?? []), e.target]);
      m.set(e.target, [...(m.get(e.target) ?? []), e.source]);
    }
    return m;
  }, [graph.edges]);

  const half = R * Math.SQRT2 * Math.cos(Math.PI / 6) + 84;
  const vb = { x: -half, y: -(R * Math.SQRT1_2) - 104, w: 2 * half, h: R * Math.SQRT2 + 104 + 76 };
  const L = Math.ceil((R + 80) / 40) * 40;
  const grid = useMemo(() => {
    const lines: string[] = [];
    for (let k = -L; k <= L; k += 40) {
      const [a, b, c, d] = [iso(k, -L), iso(k, L), iso(-L, k), iso(L, k)];
      lines.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}M${c[0].toFixed(1)} ${c[1].toFixed(1)}L${d[0].toFixed(1)} ${d[1].toFixed(1)}`);
    }
    return lines.join('');
  }, [L]);
  const orbit = useMemo(
    () =>
      Array.from({ length: 96 }, (_, i) => {
        const a = (i / 96) * 2 * Math.PI;
        return iso(R * Math.cos(a), R * Math.sin(a)).map((v) => v.toFixed(1)).join(',');
      }).join(' '),
    [R],
  );

  // Pulses: from the proposer to its peers, then on to anyone it doesn't reach directly.
  const layer = useRef<SVGGElement>(null);
  const src = proposer ? order.find((x) => x.address === proposer) : undefined;
  useEffect(() => {
    const g = layer.current;
    if (reducedMotion || !blockId || !src || !g) return;
    const first = adj.get(src.id) ?? [];
    const reached = new Set([src.id, ...first]);
    const shots: [string, string, number][] = first.map((t) => [src.id, t, 0]);
    for (const a of first) for (const b of adj.get(a) ?? []) if (!reached.has(b)) (reached.add(b), shots.push([a, b, 320]));
    for (const [from, to, delay] of shots) {
      const [a, b] = [pos.get(from), pos.get(to)];
      if (!a || !b) continue;
      const at = (t: number) => `translate(${a[0] + (b[0] - a[0]) * t}px, ${a[1] + (b[1] - a[1]) * t}px)`;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('r', '3');
      c.setAttribute('class', 'scene__pulse');
      g.appendChild(c);
      const anim = c.animate(
        [
          { transform: at(0), opacity: 0 },
          { transform: at(0.12), opacity: 1, offset: 0.12 },
          { transform: at(0.88), opacity: 1, offset: 0.88 },
          { transform: at(1), opacity: 0 },
        ],
        { duration: 620, delay, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' },
      );
      anim.onfinish = () => c.remove();
      anim.oncancel = () => c.remove();
    }
  }, [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover ? order.find((x) => x.id === hover) : undefined;
  const hp = hovered ? pos.get(hovered.id) : undefined;
  const depth = [...order].sort((a, b) => (pos.get(a.id)?.[1] ?? 0) - (pos.get(b.id)?.[1] ?? 0));

  return (
    <div className="scene">
      <svg className="scene__svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={`Network graph: ${n} nodes, ${graph.edges.length} links`}>
        <defs>
          <radialGradient id={`${id}-fade`}>
            <stop offset="0.35" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id={`${id}-mask`}>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id}-fade)`} />
          </mask>
        </defs>
        <path className="scene__floor" d={grid} mask={`url(#${id}-mask)`} />
        {R > 0 && <polygon className="scene__orbit" points={orbit} />}
        {graph.edges.map((e, i) => {
          const [a, b] = [pos.get(e.source), pos.get(e.target)];
          if (!a || !b) return null;
          const full = [e.source, e.target].some((x) => graph.nodes.find((m) => m.id === x)?.role === 'full');
          const [p, q] = i % 2 ? [b, a] : [a, b];
          return (
            <g key={`${e.source}|${e.target}`}>
              {full ? (
                <line className="scene__edge scene__edge--full" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              ) : (
                <line className="scene__edge" pathLength={1} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} style={{ animationDelay: `${200 + i * 60}ms` }} />
              )}
              <line className="scene__flow" x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} style={{ animationDuration: `${2.2 + (i % 4) * 0.6}s` }} />
            </g>
          );
        })}
        <g ref={layer} />
        {depth.map((node) => {
          const p = pos.get(node.id)!;
          const kind = nodeKind(node);
          const m = meta(node, graph.tip);
          const i = order.indexOf(node);
          return (
            <g key={node.id} transform={`translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`}>
              <g
                className="scene__node"
                style={{ animationDelay: `${120 + i * 90}ms` }}
                tabIndex={0}
                role="img"
                aria-label={`${node.name}, ${node.role === 'full' ? 'full node' : node.role}, ${m.text.toLowerCase()}`}
                onMouseEnter={() => setHover(node.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(node.id)}
                onBlur={() => setHover(null)}
              >
                <polygon className="scene__ring" points={footprint(kind, 16)} />
                {src?.id === node.id && blockId && <polygon key={blockId} className="scene__halo" points={footprint(kind, 12)} />}
                <g className="scene__body">
                  <NodeGlyph kind={kind} state={nodeState(node, graph.tip)} tone={DARK} />
                </g>
                <text className="scene__name" x={0} y={44} textAnchor="middle">
                  {node.name.toUpperCase()}
                </text>
                <text className={m.warn ? 'scene__meta scene__meta--warn' : 'scene__meta'} x={0} y={59} textAnchor="middle">
                  {m.text}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      {hovered && hp && (
        <div className="scene__tip" style={{ left: `${((hp[0] - vb.x) / vb.w) * 100}%`, top: `${((hp[1] - glyphTop(nodeKind(hovered)) - 6 - vb.y) / vb.h) * 100}%` }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong className="h3">{hovered.name}</strong>
            <span className={hovered.role === 'validator' ? 'badge badge--signal' : 'badge'}>{hovered.role === 'full' ? 'full node' : hovered.role}</span>
          </div>
          <dl className="dl" style={{ marginTop: '0.5rem' }}>
            <div>
              <dt>Height</dt>
              <dd>{hovered.height?.toLocaleString('en-US') ?? (hovered.online ? 'not polled' : 'offline')}</dd>
            </div>
            <div>
              <dt>Peers</dt>
              <dd>{hovered.peers ?? (adj.get(hovered.id)?.length ?? 0)}</dd>
            </div>
            {hovered.mempool !== null && (
              <div>
                <dt>Mempool</dt>
                <dd>{hovered.mempool} tx</dd>
              </div>
            )}
            <div>
              <dt>Peer id</dt>
              <dd>…{hovered.id.slice(-10)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

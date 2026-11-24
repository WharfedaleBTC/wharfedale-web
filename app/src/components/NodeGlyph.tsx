// Translucent isometric servers. Faces are washes of the tone colour, edges are hairlines, and the
// edges behind the box show through as dashes: glass, not metal. A validator is a three-unit rack,
// a full node a tower.

const C = Math.cos(Math.PI / 6);
export type Pt = [number, number];
type P3 = [number, number, number];

/** Isometric projection: x runs down-right, y down-left, z up. */
export const iso = (x: number, y: number, z = 0): Pt => [(x - y) * C, (x + y) * 0.5 - z];
const pts = (...ps: P3[]) => ps.map((p) => iso(...p).map((v) => v.toFixed(1)).join(',')).join(' ');

export interface Tone {
  edge: string;
  hidden: string;
  top: string;
  left: string;
  right: string;
  detail: string;
  floor: string;
  led: string;
  warn: string;
}

export const DARK: Tone = {
  edge: 'rgb(255 255 255 / 0.72)',
  hidden: 'rgb(255 255 255 / 0.24)',
  top: 'rgb(255 255 255 / 0.16)',
  left: 'rgb(255 255 255 / 0.07)',
  right: 'rgb(255 255 255 / 0.03)',
  detail: 'rgb(255 255 255 / 0.42)',
  floor: 'rgb(205 235 63 / 0.08)',
  led: '#CDEB3F',
  warn: '#E8A838',
};

export const LIGHT: Tone = {
  edge: 'rgb(7 42 29 / 0.78)',
  hidden: 'rgb(7 42 29 / 0.26)',
  top: 'rgb(7 42 29 / 0.10)',
  left: 'rgb(7 42 29 / 0.05)',
  right: 'rgb(7 42 29 / 0.02)',
  detail: 'rgb(7 42 29 / 0.45)',
  floor: 'rgb(7 42 29 / 0.06)',
  led: '#0F4530',
  warn: '#A76A00',
};

export type NodeState = 'ok' | 'lagging' | 'offline' | 'unpolled';
export type NodeKind = 'validator' | 'full';

function Box({ x, y, z, w, d, h, tone, dashed }: { x: number; y: number; z: number; w: number; d: number; h: number; tone: Tone; dashed?: boolean }) {
  const [x1, y1, z1] = [x + w, y + d, z + h];
  const dash = dashed ? '3 3' : undefined;
  return (
    <g strokeWidth={1} strokeLinejoin="round">
      <polyline points={pts([x, y1, z], [x, y, z], [x1, y, z])} fill="none" stroke={tone.hidden} strokeDasharray="2 3" />
      <polyline points={pts([x, y, z], [x, y, z1])} fill="none" stroke={tone.hidden} strokeDasharray="2 3" />
      <polygon points={pts([x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1])} fill={tone.left} stroke={tone.edge} strokeDasharray={dash} />
      <polygon points={pts([x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1])} fill={tone.right} stroke={tone.edge} strokeDasharray={dash} />
      <polygon points={pts([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1])} fill={tone.top} stroke={tone.edge} strokeDasharray={dash} />
    </g>
  );
}

function Led({ at, state, tone, delay }: { at: P3; state: NodeState; tone: Tone; delay: number }) {
  const [cx, cy] = iso(...at);
  if (state === 'offline') return <circle cx={cx} cy={cy} r={1.8} fill="none" stroke={tone.hidden} />;
  return <circle className="led" cx={cx} cy={cy} r={1.9} fill={state === 'lagging' ? tone.warn : tone.led} style={{ animationDelay: `${delay}ms` }} />;
}

/** The footprint, a little larger than the box, on the floor. */
export function footprint(kind: NodeKind, pad = 8) {
  const [w, d] = kind === 'validator' ? [64, 44] : [30, 46];
  return pts([-w / 2 - pad, -d / 2 - pad, 0], [w / 2 + pad, -d / 2 - pad, 0], [w / 2 + pad, d / 2 + pad, 0], [-w / 2 - pad, d / 2 + pad, 0]);
}

/** Height of the glyph's top above its floor point, in screen units. */
export const glyphTop = (kind: NodeKind) => (kind === 'validator' ? 74 : 82);

export function NodeGlyph({ kind, state, tone }: { kind: NodeKind; state: NodeState; tone: Tone }) {
  const dashed = state === 'unpolled';
  const opacity = state === 'offline' ? 0.35 : state === 'unpolled' ? 0.7 : 1;
  if (kind === 'full') {
    const [w, d, h] = [30, 46, 62];
    const [x, y] = [-w / 2, -d / 2];
    const y1 = y + d;
    return (
      <g opacity={opacity}>
        <polygon points={footprint('full')} fill={tone.floor} />
        <Box x={x} y={y} z={0} w={w} d={d} h={h} tone={tone} dashed={dashed} />
        {Array.from({ length: 8 }, (_, k) => (
          <polyline key={k} points={pts([x + 6, y1, 16 + k * 5], [x + w - 6, y1, 16 + k * 5])} fill="none" stroke={tone.detail} strokeWidth={0.8} />
        ))}
        <polygon points={pts([x + w, y + 7, 7], [x + w, y1 - 7, 7], [x + w, y1 - 7, h - 7], [x + w, y + 7, h - 7])} fill="none" stroke={tone.detail} strokeWidth={0.6} strokeOpacity={0.6} />
        <Led at={[x + w / 2, y1, 8]} state={state} tone={tone} delay={0} />
      </g>
    );
  }
  const [w, d, h, gap] = [64, 44, 12, 5];
  const [x, y] = [-w / 2, -d / 2];
  const [x1, y1] = [x + w, y + d];
  const top = 3 * h + 2 * gap;
  return (
    <g opacity={opacity}>
      <polygon points={footprint('validator')} fill={tone.floor} />
      {/* Rack posts at the three visible corners. */}
      {([[x, y1], [x1, y1], [x1, y]] as const).map(([px, py], k) => (
        <polyline key={k} points={pts([px, py, 0], [px, py, top])} fill="none" stroke={tone.detail} strokeWidth={0.8} />
      ))}
      {[0, 1, 2].map((i) => {
        const z = i * (h + gap);
        return (
          <g key={i}>
            <Box x={x} y={y} z={z} w={w} d={d} h={h} tone={tone} dashed={dashed} />
            <polygon points={pts([x + 7, y1, z + 3.5], [x + 27, y1, z + 3.5], [x + 27, y1, z + 8.5], [x + 7, y1, z + 8.5])} fill="none" stroke={tone.detail} strokeWidth={0.8} />
            <polygon points={pts([x + 31, y1, z + 3.5], [x + 51, y1, z + 3.5], [x + 51, y1, z + 8.5], [x + 31, y1, z + 8.5])} fill="none" stroke={tone.detail} strokeWidth={0.8} />
            <Led at={[x + 57.5, y1, z + 6]} state={state} tone={tone} delay={i * 420} />
          </g>
        );
      })}
      {[1, 2, 3, 4, 5].map((k) => (
        <polyline key={k} points={pts([x + 6, y + k * 7, top], [x1 - 6, y + k * 7, top])} fill="none" stroke={tone.detail} strokeWidth={0.6} strokeOpacity={0.6} />
      ))}
    </g>
  );
}

/** A glyph in its own small SVG, for lists. */
export function NodeIcon({ kind, state, size = 56 }: { kind: NodeKind; state: NodeState; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-56 -86 112 116" aria-hidden="true">
      <NodeGlyph kind={kind} state={state} tone={LIGHT} />
    </svg>
  );
}

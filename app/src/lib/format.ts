export const short = (s: string, head = 8, tail = 8): string => (s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`);

export function formatAmount(base: number, precision = 0): string {
  const v = base / 10 ** precision;
  return v.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

/** "250.5" with precision 2 → 25050 base units; throws on bad input. */
export function parseAmount(text: string, precision = 0): number {
  const t = text.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error('enter a number');
  const [whole, frac = ''] = t.split('.');
  if (frac.length > precision) throw new Error(`at most ${precision} decimal places`);
  const n = Number(whole) * 10 ** precision + Number(frac.padEnd(precision, '0') || 0);
  if (!Number.isSafeInteger(n)) throw new Error('amount too large');
  return n;
}

export function ago(unix: number, now = Date.now()): string {
  const s = Math.max(0, Math.round(now / 1000 - unix));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

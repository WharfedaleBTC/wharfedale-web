import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A QR code of an address; bech32 addresses are encoded upper-case (alphanumeric mode, denser). */
export function Qr({ text, size = 240 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text.toUpperCase().startsWith('WF') ? text.toUpperCase() : text, 'Alphanumeric');
    qr.make();
    const n = qr.getModuleCount();
    const rects: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: rects.join('') };
  }, [text]);
  return (
    <svg role="img" aria-label="QR code of the address" width={size} height={size} viewBox={`0 0 ${cells.n} ${cells.n}`} shapeRendering="crispEdges">
      <rect width={cells.n} height={cells.n} fill="#FFFFFF" />
      <path d={cells.d} fill="#0A0F0C" />
    </svg>
  );
}

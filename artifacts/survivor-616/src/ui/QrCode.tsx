import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** A QR code drawn as one SVG path, made on the device with no network. White tiles on a dark card for scanning. */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
      }
      return { path: d, count: n };
    } catch {
      return { path: '', count: 0 };
    }
  }, [value]);
  if (!path) return null;
  const view = count + 4;
  return (
    <svg viewBox={`0 0 ${view} ${view}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges" className="bg-white">
      <path d={path} fill="#0b0b12" />
    </svg>
  );
}

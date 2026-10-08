import { useEffect, useRef } from 'react';

import type { DropStyle } from '@/game/data/dropPacks';
import type { Pickup, PickupKind } from '@/game/engine/world';
import { drawPickupClassic } from '@/game/render/draw';
import { drawStyledPickup } from '@/game/render/pickupArtStyles';

const SAMPLE: ReadonlyArray<{ kind: PickupKind; value: number }> = [
  { kind: 'xp', value: 2 },
  { kind: 'xp', value: 25 },
  { kind: 'health', value: 18 },
  { kind: 'cred', value: 5 },
  { kind: 'loot-box', value: 1 },
  { kind: 'relic-vault-chest', value: 1 },
  { kind: 'card-pack', value: 1 },
  { kind: 'prism-quartz', value: 1 },
  { kind: 'water-flask', value: 1 },
  { kind: 'silicon-alloy', value: 1 },
];
const W = 300;
const H = 56;

/** Live strip of sample drops in one pack, animated unless the player prefers reduced motion. */
export function DropPackPreview({ style, label }: { style: DropStyle; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    const start = performance.now();
    const draw = (time: number) => {
      const now = still ? 4000 : time - start + 600;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#10131a';
      ctx.fillRect(0, 0, W, H);
      SAMPLE.forEach((entry, i) => {
        const pickup: Pickup = { uid: i + 7, kind: entry.kind, x: 15 + i * 30, y: H / 2 + 2, vx: 0, vy: 0, value: entry.value, bornAt: 0 };
        ctx.save();
        if (style === 'classic') drawPickupClassic(ctx, pickup, now);
        else drawStyledPickup(ctx, pickup, now, style, false, false);
        ctx.restore();
      });
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [style]);
  return <canvas ref={ref} role="img" aria-label={label} style={{ width: '100%', maxWidth: W, height: 'auto', aspectRatio: `${W} / ${H}`, imageRendering: style === 'pixel' ? 'pixelated' : 'auto' }} className="border border-white/10" />;
}

/**
 * BoardScreen -- Turbo Crown Blitz on the Monroe Loop (Lok Party Slice 3).
 *
 * Draws and paces the pure board engine (lokBoard.ts). Human choices are big cream buttons at
 * thumb height (fired on pointerdown); bots think for a beat so turns read like a show.
 * A 30-second minigame closes each round, rotating the Lok Drop, Ring Run Rush, Roof Rumble and Roof Collapse.
 */

import { press } from './press';
import { useEffect, useRef } from 'react';
import { type ItemId } from './lokBoard';
import { ESPRESSO } from './boardShared';

export function PartyButton({ children, onPress, tone = 'cream', big = false }: { children: React.ReactNode; onPress: () => void; tone?: 'cream' | 'gold' | 'lane' | 'plain'; big?: boolean }) {
  const bg = { cream: '#efe5d0', gold: '#ffcf3c', lane: '#38f2ff', plain: 'transparent' }[tone];
  return (
    <button
      type="button"
      {...press(onPress)}
      className={`flex flex-1 flex-col items-center justify-center rounded-xl border-[3px] font-black transition-transform active:translate-y-[3px] ${big ? 'min-h-[64px] text-lg' : 'min-h-[44px] text-sm'}`}
      style={{ background: bg, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: tone === 'plain' ? 'none' : `0 3px 0 ${ESPRESSO}` }}
    >
      {children}
    </button>
  );
}

export function ItemBadge({ item }: { item: ItemId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawItemIcon(ctx, item, c.width / 2, c.height / 2, 1);
  }, [item]);
  return <canvas ref={ref} width={36} height={28} style={{ width: 36, height: 28 }} aria-hidden="true" />;
}

/** Original item icons, drawn in about a 34 x 24 box at scale 1. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, k: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1020';
  switch (item) {
    case 'double-dice':
      for (const [dx, col] of [
        [-7, '#ffcb3c'],
        [6, '#ff9a2f'],
      ] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(dx - 7, -7 + (dx > 0 ? 3 : -2), 14, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a1020';
        ctx.fillRect(dx - 1.5, -1.5 + (dx > 0 ? 3 : -2), 3, 3);
      }
      break;
    case 'custom-dice':
      ctx.fillStyle = '#38d5ff';
      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -3);
      ctx.lineTo(4, 4);
      ctx.lineTo(-3, 4);
      ctx.stroke();
      break;
    case 'swap-mirror':
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(5, -3);
      ctx.lineTo(2, -6);
      ctx.moveTo(5, 3);
      ctx.lineTo(-5, 3);
      ctx.lineTo(-2, 6);
      ctx.stroke();
      break;
    case 'glitch-trap':
      ctx.fillStyle = '#ff3fa4';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 5 : 10;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'crown-radar':
      ctx.strokeStyle = '#5fe36f';
      for (const r of [4, 8, 12]) {
        ctx.beginPath();
        ctx.arc(-6, 6, r, -Math.PI / 2, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffcf3c';
      ctx.beginPath();
      ctx.arc(-6, 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}


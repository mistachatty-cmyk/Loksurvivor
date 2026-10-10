/**
 * Procedural art for hideout props, drawn on the strip canvas in the same style as
 * the rigs: plain rectangles and arcs, no bitmaps. A new prop look is one `case` here
 * plus its `PropArt` name in `data/hideoutProps.ts`.
 *
 * Everything is drawn around (x, groundY) in "prop units" scaled by `s`, so a prop is
 * about 30 units tall regardless of the strip's height.
 */

import type { PropArt } from '@/game/data/hideoutProps';

export interface PropDrawOptions {
  art: PropArt;
  x: number;
  groundY: number;
  /** Pixels per prop unit. */
  s: number;
  accent: string;
  /** True when using it would pay out (draws the pulsing marker). */
  ready: boolean;
  /** True while the operator stands close enough to use it. */
  near: boolean;
  now: number;
  reduceMotion: boolean;
  /** Progress 0..1 through the "just used" reaction; undefined when idle. */
  useAge?: number;
}

/** The rough half-width of a prop in prop units, so taps and the reach check agree with the art. */
export const PROP_HALF_WIDTH_UNITS = 14;
/** The rough height of a prop in prop units. */
export const PROP_HEIGHT_UNITS = 32;

const INK = '#0b0b12';
const WOOD = '#3b2f2a';
const WOOD_LIGHT = '#5a463d';
const METAL = '#5b6477';
const GLASS = 'rgba(190, 235, 255, 0.22)';

export function drawProp(ctx: CanvasRenderingContext2D, o: PropDrawOptions): void {
  const { art, x, groundY, s, accent, now, reduceMotion } = o;
  const t = reduceMotion ? 0 : now;
  const reacting = o.useAge !== undefined && !reduceMotion;
  const fx = reacting ? o.useAge! : 0;
  // Peaks mid-reaction, so lids, doors and glows ease out and back.
  const burst = reacting ? Math.sin(Math.min(1, fx) * Math.PI) : 0;
  ctx.save();
  ctx.translate(x, groundY);

  // Ground shadow.
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 1, 13 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const box = (bx: number, by: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(bx * s, -(by + h) * s, w * s, h * s);
  };

  switch (art) {
    case 'crate':
      box(-12, 0, 24, 18, WOOD);
      // The lid pops up when it is opened.
      box(-12, 14 + burst * 7, 24, 4, WOOD_LIGHT);
      box(-12, 0, 24, 2, INK);
      box(-2, 4, 4, 9, accent);
      box(-12, 7, 24, 1.5, INK);
      break;
    case 'bell': {
      box(-1.5, 0, 3, 28, WOOD_LIGHT);
      box(-9, 25, 18, 3, WOOD);
      const swing = Math.sin(t / 420) * (o.ready ? 0.12 : 0.03) + (reacting ? Math.sin(t / 55) * 0.55 * (1 - fx) * (1 - fx) : 0);
      ctx.save();
      ctx.translate(0, -22 * s);
      ctx.rotate(swing);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-6 * s, 8 * s);
      ctx.quadraticCurveTo(-6 * s, -2 * s, 0, -4 * s);
      ctx.quadraticCurveTo(6 * s, -2 * s, 6 * s, 8 * s);
      ctx.closePath();
      ctx.fill();
      box(-1.5, -12, 3, 3, INK);
      ctx.restore();
      break;
    }
    case 'lamp': {
      box(-1.5, 0, 3, 24, METAL);
      box(-5, 0, 10, 2, METAL);
      const flicker = reduceMotion ? 1 : 0.85 + Math.sin(t / 180) * 0.08 + Math.sin(t / 77) * 0.05;
      const glow = ctx.createRadialGradient(0, -27 * s, 1 * s, 0, -27 * s, 20 * s);
      glow.addColorStop(0, accent);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = Math.min(1, 0.5 * flicker + burst * 0.5);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -27 * s, 20 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -27 * s, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'scope': {
      ctx.strokeStyle = METAL;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, -16 * s); ctx.lineTo(-8 * s, 0);
      ctx.moveTo(0, -16 * s); ctx.lineTo(8 * s, 0);
      ctx.moveTo(0, -16 * s); ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -17 * s);
      ctx.rotate(-0.7);
      box(-3, -2.5, 20, 5, '#8a6a3b');
      box(14, -3.5, 5, 7, accent);
      ctx.restore();
      break;
    }
    case 'jar': {
      ctx.fillStyle = GLASS;
      ctx.fillRect(-8 * s, -22 * s, 16 * s, 22 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1 * s;
      ctx.strokeRect(-8 * s, -22 * s, 16 * s, 22 * s);
      box(-9, 22, 18, 3, METAL);
      for (let i = 0; i < 5; i += 1) {
        const phase = reduceMotion ? i : t / 260 + i * 1.7;
        const px = Math.sin(phase * 1.3 + i) * 4.5;
        const py = 4 + ((i * 3.7 + (reduceMotion ? 0 : t / 90)) % 16);
        ctx.fillStyle = i % 2 === 0 ? accent : '#fff';
        ctx.fillRect((px - 0.7) * s, -(py) * s, 1.6 * s, 1.6 * s);
      }
      break;
    }
    case 'chest': {
      // The Lucky Chest: dark wood with gold bands and a lid that swings up when it is opened.
      box(-12, 0, 24, 11, '#4a2f1d');
      box(-12, 0, 24, 2, INK);
      box(-12, 5, 24, 2, accent);
      const lid = burst * 9;
      if (burst > 0.05) {
        const glow = ctx.createRadialGradient(0, -12 * s, 1 * s, 0, -12 * s, 24 * s);
        glow.addColorStop(0, accent);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = burst * 0.8;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -12 * s, 24 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      box(-12, 11 + lid, 24, 6, '#5a3a22');
      box(-12, 14 + lid, 24, 2, accent);
      box(-2.5, 7, 5, 5, accent);
      break;
    }
    case 'stash':
      box(-12, 0, 24, 3, METAL);
      for (let i = 0; i < 5; i += 1) box(-10 + i * 5, 3, 1.4, 9, METAL);
      box(-9, 3, 11, 9, '#2f3d34');
      box(-4, 10, 5, 3, accent);
      break;
    case 'seat':
      box(-14, 0, 28, 2, INK);
      box(-13, 2, 3, 8, WOOD);
      box(10, 2, 3, 8, WOOD);
      box(-14, 9, 28, 5, accent);
      box(-14, 14, 28, 2, WOOD_LIGHT);
      break;
    case 'jukebox': {
      box(-10, 0, 20, 26, '#2a1f35');
      ctx.fillStyle = '#2a1f35';
      ctx.beginPath();
      ctx.arc(0, -26 * s, 10 * s, Math.PI, 0);
      ctx.fill();
      const pulse = reduceMotion ? 0.7 : Math.min(1, 0.55 + Math.abs(Math.sin(t / 380)) * 0.4 + burst * 0.4);
      ctx.globalAlpha = pulse;
      box(-7, 10, 14, 12, accent);
      ctx.globalAlpha = 1;
      box(-7, 3, 14, 3, INK);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.arc(0, -26 * s, 7 * s, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'cat': {
      ctx.fillStyle = '#2c2a35';
      ctx.beginPath();
      ctx.ellipse(0, -6 * s, 9 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8 * s, -11 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5 * s, -15 * s); ctx.lineTo(6.5 * s, -20 * s); ctx.lineTo(8.5 * s, -15 * s);
      ctx.moveTo(8.5 * s, -15 * s); ctx.lineTo(11 * s, -20 * s); ctx.lineTo(12 * s, -14 * s);
      ctx.fill();
      ctx.strokeStyle = '#2c2a35';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(-8 * s, -4 * s);
      ctx.quadraticCurveTo(-15 * s, -8 * s - Math.sin(t / 500) * 4 * s, -13 * s, -15 * s);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(9.5 * s, -12.5 * s, 1.6 * s, 1.6 * s);
      ctx.fillRect(6 * s, -12.5 * s, 1.6 * s, 1.6 * s);
      break;
    }
    case 'door':
      box(-8, 0, 16, 30, '#1d2230');
      // The panel swings away from you as it opens.
      box(-6.5, 1.5, 13 * (1 - burst * 0.7), 27, '#2b3347');
      box(3 * (1 - burst * 0.7), 13, 2, 3, accent);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(-2.5 * s, -20 * s); ctx.lineTo(1 * s, -16 * s); ctx.lineTo(-2.5 * s, -12 * s);
      ctx.stroke();
      break;
    case 'npc':
      // The character is drawn by the strip with `drawRig`; this only keeps the ground shadow.
      break;
  }

  // Just used: a ring that spreads, and a little glyph that floats up (music from the
  // jukebox, a heart from the cat, a spark from anything else).
  if (reacting && fx < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - fx) * 0.7;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.ellipse(0, -6 * s, (8 + fx * 22) * s, (5 + fx * 12) * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1 - fx;
    ctx.fillStyle = accent;
    ctx.font = `bold ${Math.round(9 * s)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const glyph = art === 'jukebox' || art === 'bell' ? '♪' : art === 'cat' ? '♥' : '✦';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillText(glyph, (i - 1) * 9 * s + Math.sin(fx * 6 + i * 2) * 3 * s, -(PROP_HEIGHT_UNITS * 0.6 + fx * 22 + i * 4) * s);
    }
    ctx.restore();
  }

  // "Ready" marker: a small pulsing diamond above anything that would pay out right now.
  if (o.ready) {
    const lift = reduceMotion ? 0 : Math.sin(t / 300) * 1.5;
    ctx.fillStyle = accent;
    ctx.globalAlpha = o.near ? 1 : 0.8;
    ctx.beginPath();
    const cy = -(PROP_HEIGHT_UNITS + 6 + lift) * s;
    ctx.moveTo(0, cy - 3 * s); ctx.lineTo(3 * s, cy); ctx.lineTo(0, cy + 3 * s); ctx.lineTo(-3 * s, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

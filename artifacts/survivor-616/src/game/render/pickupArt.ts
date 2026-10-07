/**
 * Enhanced drop art. Pure Canvas2D, fully procedural, and a pure function of
 * (now - bornAt, uid) so it never touches simulation state. `drawPickups` in
 * draw.ts chooses between this and the original ("classic") drawings via the
 * Drop style setting.
 */
import type { Pickup, PickupKind } from '../engine/world';

export type DropStyle = 'enhanced' | 'classic';

const TAU = Math.PI * 2;
const SPAWN_MS = 380;

/** Trail / pickup-burst colour per kind, also used by the engine burst. */
export const PICKUP_COLOR: Record<PickupKind, string> = {
  xp: '#6ee7ff',
  health: '#7dffb2',
  cred: '#ffd166',
  sweep: '#ffffff',
  'loot-box': '#60a5fa',
  'card-pack': '#f0abfc',
  coin: '#e8d48a',
  'glitch-cache': '#22d3ee',
  'relic-vault-chest': '#f59e0b',
  'firefly-amber-chest': '#fbbf24',
  'mimic-chest': '#dc2626',
  'phosphor-ore': '#fbbf24',
  'silicon-alloy': '#38bdf8',
  'cyber-resin': '#c084fc',
  'prism-quartz': '#f43f5e',
  'water-flask': '#38bdf8',
  'rootglass-cell': '#5eead4',
};

interface Tier {
  base: string;
  light: string;
  dark: string;
  size: number;
}
const XP_TIERS: readonly Tier[] = [
  { base: '#4fb3c9', light: '#b6f1ff', dark: '#1f6f86', size: 4 },
  { base: '#6ee7ff', light: '#e0fbff', dark: '#2a9bb8', size: 6 },
  { base: '#ffb347', light: '#fff0c4', dark: '#c26d12', size: 8 },
  { base: '#e879f9', light: '#fdf0ff', dark: '#9b2bb0', size: 11 },
];
function xpTier(value: number): number {
  return value >= 20 ? 3 : value >= 10 ? 2 : value >= 4 ? 1 : 0;
}

function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, lift: number) {
  const k = 1 - Math.min(1, lift / 22) * 0.4;
  ctx.save();
  ctx.globalAlpha = 0.32 * k;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * k, rx * 0.34 * k, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function glow(ctx: CanvasRenderingContext2D, on: boolean, color: string, blur: number) {
  if (!on) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

/** Diagonal highlight band sweeping across a shape's bounding box. */
function glintBand(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, phase: number, color = '#ffffff') {
  const t = phase % 1;
  if (t > 0.45) return;
  const cx = x - hw + (t / 0.45) * hw * 2;
  ctx.save();
  ctx.globalAlpha = 0.65 * Math.sin((t / 0.45) * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, hw * 0.28);
  ctx.beginPath();
  ctx.moveTo(cx - hh * 0.4, y + hh);
  ctx.lineTo(cx + hh * 0.4, y - hh);
  ctx.stroke();
  ctx.restore();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, color = '#ffffff') {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
  ctx.fill();
}

/** Four-facet cut gem; `squash` (0..1) narrows it as if rotating. */
function facetGem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tier: Tier, squash: number) {
  const hw = s * 0.8 * (0.35 + 0.65 * squash);
  poly(ctx, [[x, y - s], [x + hw, y], [x, y + s], [x - hw, y]], tier.base);
  poly(ctx, [[x, y - s], [x - hw, y], [x, y]], tier.light); // upper-left lit
  poly(ctx, [[x, y], [x + hw, y], [x, y + s]], tier.dark); // lower-right shade
  ctx.save();
  ctx.globalAlpha = 0.55;
  poly(ctx, [[x, y - s], [x + hw, y], [x, y]], tier.light);
  ctx.restore();
}

function chestBody(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  body: string, lid: string, trim: string, open: number,
) {
  const lidH = h * 0.38;
  ctx.fillStyle = body;
  ctx.fillRect(x - w / 2, y - h / 2 + lidH * 0.6, w, h - lidH * 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - w / 2, y + h / 2 - h * 0.18, w, h * 0.18);
  ctx.fillStyle = trim;
  ctx.fillRect(x - w / 2, y - h / 2 + lidH * 0.6, w, 1.5);
  ctx.fillRect(x - w * 0.34, y - h / 2 + lidH * 0.6, 2, h - lidH * 0.6);
  ctx.fillRect(x + w * 0.34 - 2, y - h / 2 + lidH * 0.6, 2, h - lidH * 0.6);
  // Lid, hinged at the back and lifting by `open` px.
  ctx.save();
  ctx.translate(x, y - h / 2 + lidH * 0.6);
  ctx.rotate(-open * 0.05);
  ctx.fillStyle = lid;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(0, -lidH * 1.5, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, -1);
  ctx.quadraticCurveTo(0, -lidH * 1.3, w / 2 - 2, -1);
  ctx.quadraticCurveTo(0, -lidH * 0.9, -w / 2 + 2, -1);
  ctx.fill();
  ctx.restore();
}

function keyhole(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 1.1, y, 2.2, 4);
}

/**
 * Draws one pickup. Caller has already `save()`d the context and handles
 * `restore()`. `lite` skips shadowBlur (balanced quality).
 */
export function drawEnhancedPickup(ctx: CanvasRenderingContext2D, p: Pickup, now: number, lite: boolean) {
  const age = now - p.bornAt;
  const phase = (p.uid * 1.713) % TAU;
  const t = age / 1000 + phase;
  const bobAmp = 2.2;
  const bob = Math.sin(t * 4.2) * bobAmp;

  // Spawn: arc up, land, and settle with one small bounce.
  let hop = 0;
  let pop = 1;
  if (age < SPAWN_MS) {
    const u = age / SPAWN_MS;
    hop = Math.sin(u * Math.PI) * 14 * (1 - u * 0.5) + (u > 0.65 ? Math.sin((u - 0.65) / 0.35 * Math.PI) * 3 : 0);
    pop = 0.3 + 0.7 * Math.min(1, u * 2.2);
  }
  const lift = Math.max(0, -bob) + hop;
  const x = p.x;
  const y = p.y + bob - hop;
  const gl = !lite;
  const color = PICKUP_COLOR[p.kind];

  // Magnet streak while being dragged in.
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 70) {
    const len = Math.min(16, speed * 0.05);
    const nx = p.vx / speed;
    const ny = p.vy / speed;
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, speed / 500);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - nx * len, y - ny * len);
    ctx.stroke();
    ctx.restore();
  }

  groundShadow(ctx, p.x, p.y + 7, p.kind === 'xp' ? XP_TIERS[xpTier(p.value)]!.size + 2 : 9, lift);
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.translate(-x, -y);

  switch (p.kind) {
    case 'xp': {
      const ti = xpTier(p.value);
      const tier = XP_TIERS[ti]!;
      const spin = 0.55 + 0.45 * Math.abs(Math.cos(t * 2.4));
      const s = tier.size * (ti >= 2 ? 1 + Math.sin(t * 5) * 0.06 : 1);
      glow(ctx, gl, tier.light, tier.size * 1.6);
      facetGem(ctx, x, y, s, tier, ti === 0 ? 1 : spin);
      ctx.shadowBlur = 0;
      if (ti >= 1) glintBand(ctx, x, y, s * 0.7, s, t * 0.7, '#ffffff');
      if (ti === 3) {
        for (let i = 0; i < 3; i += 1) {
          const a = t * 2.2 + (i * TAU) / 3;
          sparkle(ctx, x + Math.cos(a) * (s + 5), y + Math.sin(a) * (s + 3), 2.2, 0.6 + 0.4 * Math.sin(t * 8 + i));
        }
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = `hsl(${(now / 6) % 360} 90% 70%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.8, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 0.8, y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'health': {
      const beat = Math.max(Math.sin(t * 7), 0) ** 3 * 0.18 + Math.max(Math.sin(t * 7 - 1.2), 0) ** 3 * 0.1;
      const s = 1 + beat;
      glow(ctx, gl, '#7dffb2', 12 + beat * 40);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.roundRect(x - 7 * s, y - 7 * s, 14 * s, 14 * s, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7dffb2';
      ctx.beginPath();
      ctx.roundRect(x - 6 * s, y - 6 * s, 12 * s, 11 * s, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1.8 * s, y - 5 * s, 3.6 * s, 10 * s);
      ctx.fillRect(x - 5 * s, y - 1.8 * s, 10 * s, 3.6 * s);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 5 * s, y - 5.5 * s, 7 * s, 1.4);
      break;
    }
    case 'cred':
    case 'coin': {
      const isCoin = p.kind === 'coin';
      const sx = Math.abs(Math.cos(t * (isCoin ? 1.8 : 3.2)));
      const rx = 6.2 * (0.2 + 0.8 * sx);
      const rim = isCoin ? '#7c5f18' : '#b45309';
      const face = isCoin ? '#e8d48a' : '#ffd166';
      glow(ctx, gl, isCoin ? '#fde68a' : '#ffd166', 12);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(x, y, rx + 1, 7, 0, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, 6, 0, 0, TAU);
      ctx.fill();
      if (sx > 0.45) {
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.2;
        if (isCoin) {
          ctx.beginPath(); // stamped key glyph
          ctx.arc(x - rx * 0.3, y, 1.8, 0, TAU);
          ctx.moveTo(x - rx * 0.3 + 1.8, y);
          ctx.lineTo(x + rx * 0.5, y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(x, y, rx * 0.62, 3.6, 0, 0, TAU);
          ctx.stroke();
        }
      }
      glintBand(ctx, x, y, rx, 6, t * 0.5);
      break;
    }
    case 'sweep': {
      const ring = (t * 1.4) % 1;
      glow(ctx, gl, '#ffffff', 16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, 'rgba(160,220,255,0.15)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1 - ring;
      ctx.strokeStyle = '#bfe9ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 7 + ring * 12, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i += 1) {
        const a = (TAU / 4) * i + t * 1.6;
        sparkle(ctx, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 2, 0.85);
      }
      break;
    }
    case 'loot-box': {
      const cycle = t % 3.2;
      const rattle = cycle > 2.6 ? Math.sin(cycle * 60) * 0.6 + 2 : 0;
      glow(ctx, gl, '#3b82f6', 16);
      chestBody(ctx, x, y, 19, 17, '#1d4ed8', '#2563eb', '#93c5fd', rattle);
      ctx.shadowBlur = 0;
      if (rattle > 0) {
        ctx.fillStyle = 'rgba(147,197,253,0.8)';
        ctx.fillRect(x - 8, y - 6.5, 16, 1.5); // light leaking through the seam
      }
      keyhole(ctx, x, y + 0.5, '#fbbf24');
      glintBand(ctx, x, y, 9, 8, t * 0.4);
      break;
    }
    case 'card-pack': {
      ctx.rotate(0);
      const sway = Math.sin(t * 2.4) * 0.14 - 0.1;
      ctx.translate(x, y);
      ctx.rotate(sway);
      ctx.translate(-x, -y);
      glow(ctx, gl, '#f0abfc', 18);
      ctx.fillStyle = '#4a044e';
      ctx.beginPath();
      ctx.roundRect(x - 8, y - 11, 16, 22, 2.5);
      ctx.fill();
      ctx.shadowBlur = 0;
      const foil = ctx.createLinearGradient(x - 8, y - 11, x + 8, y + 11);
      const sh = (t * 0.6) % 1;
      foil.addColorStop(0, '#701a75');
      foil.addColorStop(Math.max(0.01, sh - 0.2), '#a21caf');
      foil.addColorStop(sh, '#f5d0fe');
      foil.addColorStop(Math.min(0.99, sh + 0.2), '#a21caf');
      foil.addColorStop(1, '#701a75');
      ctx.fillStyle = foil;
      ctx.beginPath();
      ctx.roundRect(x - 6.5, y - 9.5, 13, 19, 1.5);
      ctx.fill();
      ctx.fillStyle = '#fdf4ff';
      ctx.beginPath();
      ctx.arc(x, y - 1, 3.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#86198f';
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LP', x, y + 0.6);
      ctx.fillStyle = '#fdf4ff';
      ctx.fillRect(x - 4.5, y + 6, 9, 1.5);
      sparkle(ctx, x + 6, y - 8, 2.4, 0.4 + 0.6 * Math.max(0, Math.sin(t * 5)));
      break;
    }
    case 'glitch-cache': {
      const tear = Math.floor(now / 120) % 7 === 0;
      const off = tear ? ((p.uid % 3) - 1) * 3 || 2 : 0;
      glow(ctx, gl, '#22d3ee', 16);
      ctx.fillStyle = '#ef4444';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x - 10 - 1.5 - off, y - 9, 20, 18);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(x - 10 + 1.5 + off, y - 9, 20, 18);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(x - 10, y - 9, 20, 18);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(x - 7, y - 6, 14, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let r = 0; r < 12; r += 3) ctx.fillRect(x - 7, y - 6 + r, 14, 1);
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0x', x + (tear ? off : 0), y + 3);
      if (tear) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 10 + off * 2, y - 2 + (p.uid % 4), 20, 2);
      }
      break;
    }
    case 'relic-vault-chest': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      glow(ctx, gl, '#f59e0b', 12 + pulse * 14);
      chestBody(ctx, x, y, 25, 21, '#292524', '#44403c', '#f59e0b', 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fbbf24';
      for (const [rx, ry] of [[-10, -3], [10, -3], [-10, 6], [10, 6]] as const) {
        ctx.beginPath();
        ctx.arc(x + rx, y + ry, 1, 0, TAU);
        ctx.fill();
      }
      keyhole(ctx, x, y + 1, `rgba(254,243,199,${0.65 + pulse * 0.35})`);
      for (let i = 0; i < 3; i += 1) {
        const m = (t * 0.5 + i / 3) % 1;
        sparkle(ctx, x + (i - 1) * 7, y - 10 - m * 14, 1.6, (1 - m) * 0.9, '#fde68a');
      }
      break;
    }
    case 'firefly-amber-chest': {
      glow(ctx, gl, '#fbbf24', 22);
      chestBody(ctx, x, y, 23, 19, '#78350f', '#b45309', '#fcd34d', 0);
      ctx.shadowBlur = 0;
      keyhole(ctx, x, y + 1, '#fef3c7');
      for (let i = 0; i < 4; i += 1) {
        const a = t * 2.6 + (i * TAU) / 4;
        const fx = x + Math.cos(a) * 15;
        const fy = y + Math.sin(a * 1.3) * 9 - 2;
        const flick = 0.55 + 0.45 * Math.sin(t * 9 + i * 2);
        ctx.fillStyle = `rgba(254,240,138,${0.25 * flick})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(254,249,195,${flick})`;
        ctx.fillRect(fx - 1.2, fy - 1.2, 2.4, 2.4);
      }
      break;
    }
    case 'mimic-chest': {
      const creak = Math.max(0, Math.sin(t * 2.1)) ** 2 * 3.5;
      glow(ctx, gl, '#dc2626', 10);
      chestBody(ctx, x, y, 19, 17, '#451a03', '#78350f', '#a16207', creak);
      ctx.shadowBlur = 0;
      if (creak > 0.6) {
        ctx.fillStyle = '#1c0a05';
        ctx.fillRect(x - 8, y - 6.2, 16, creak * 0.6);
        ctx.fillStyle = '#fef2f2';
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x - 7 + i * 4.5, y - 6.2);
          ctx.lineTo(x - 5 + i * 4.5, y - 6.2);
          ctx.lineTo(x - 6 + i * 4.5, y - 6.2 + Math.min(3, creak));
          ctx.fill();
        }
      }
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(x, y + 1.5, 2.6, 1.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 0.6 + Math.sin(t * 1.3), y + 0.8, 1.2, 1.6);
      break;
    }
    case 'phosphor-ore': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.6);
      glow(ctx, gl, '#fbbf24', 10 + pulse * 10);
      poly(ctx, [[x - 8, y + 6], [x - 5, y + 1], [x + 5, y + 2], [x + 8, y + 6]], '#57534e');
      ctx.shadowBlur = 0;
      poly(ctx, [[x - 3, y + 5], [x - 5, y - 3], [x - 1, y - 8], [x + 1, y + 5]], '#f59e0b');
      poly(ctx, [[x - 1, y - 8], [x + 4, y - 4], [x + 1, y + 5]], '#fbbf24');
      poly(ctx, [[x + 2, y + 5], [x + 3, y - 1], [x + 7, y - 3], [x + 6, y + 5]], '#d97706');
      ctx.fillStyle = `rgba(254,249,195,${0.4 + pulse * 0.5})`;
      ctx.fillRect(x - 1.2, y - 3, 2.4, 6);
      sparkle(ctx, x + 3, y - 7, 2, Math.max(0, Math.sin(t * 4)));
      break;
    }
    case 'silicon-alloy': {
      glow(ctx, gl, '#38bdf8', 12);
      poly(ctx, [[x - 7, y + 4], [x - 5, y - 4], [x + 7, y - 4], [x + 9, y + 4]], '#0369a1');
      ctx.shadowBlur = 0;
      poly(ctx, [[x - 5, y - 4], [x + 7, y - 4], [x + 5, y - 7], [x - 3, y - 7]], '#bae6fd');
      const g = ctx.createLinearGradient(x - 7, y, x + 9, y);
      g.addColorStop(0, '#0284c7');
      g.addColorStop(0.5, '#38bdf8');
      g.addColorStop(1, '#075985');
      poly(ctx, [[x - 7, y + 4], [x - 5, y - 4], [x + 7, y - 4], [x + 9, y + 4]], '#0284c7');
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, y - 3, 14, 6.5);
      glintBand(ctx, x, y, 8, 5, t * 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 3, y - 6.2, 5, 1);
      break;
    }
    case 'cyber-resin': {
      const sq = 1 + Math.sin(t * 4) * 0.1;
      glow(ctx, gl, '#c084fc', 14);
      ctx.fillStyle = '#6d28d9';
      ctx.beginPath();
      ctx.moveTo(x, y - 9 / sq);
      ctx.bezierCurveTo(x + 7 * sq, y - 2, x + 7 * sq, y + 7 / sq, x, y + 7 / sq);
      ctx.bezierCurveTo(x - 7 * sq, y + 7 / sq, x - 7 * sq, y - 2, x, y - 9 / sq);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y + 1, 3.2, t * 2, t * 2 + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(243,232,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(x - 2.4, y - 2.2, 1.7, 2.6, -0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'rootglass-cell': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      glow(ctx, gl, '#5eead4', 12 + pulse * 10);
      ctx.fillStyle = 'rgba(15,118,110,0.85)';
      ctx.beginPath();
      ctx.roundRect(x - 7, y - 10, 14, 20, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#99f6e4';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#134e4a';
      ctx.fillRect(x - 5, y - 11, 10, 3);
      ctx.fillRect(x - 5, y + 8, 10, 3);
      poly(ctx, [[x, y - 6], [x + 4, y], [x, y + 6], [x - 4, y]], `rgba(204,251,241,${0.6 + pulse * 0.4})`);
      ctx.strokeStyle = 'rgba(153,246,228,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x - 4 + Math.sin(t * 9) * 1.5, y - 2);
      ctx.lineTo(x + 3, y + 2 + Math.sin(t * 7));
      ctx.lineTo(x, y + 6);
      ctx.stroke();
      break;
    }
    case 'prism-quartz': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      glow(ctx, gl, '#f43f5e', 14 + pulse * 10);
      const hue = (now / 8) % 360;
      poly(ctx, [[x, y - 9], [x + 5.5, y - 4], [x + 5.5, y + 4], [x, y + 9], [x - 5.5, y + 4], [x - 5.5, y - 4]], '#be185d');
      ctx.shadowBlur = 0;
      poly(ctx, [[x, y - 9], [x - 5.5, y - 4], [x, y]], '#fda4af');
      poly(ctx, [[x, y - 9], [x + 5.5, y - 4], [x, y]], '#f472b6');
      poly(ctx, [[x, y], [x + 5.5, y + 4], [x, y + 9]], '#9d174d');
      ctx.strokeStyle = `hsl(${hue} 90% 72%)`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 5.5, y - 4);
      ctx.lineTo(x + 5.5, y + 4);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      sparkle(ctx, x - 3, y - 4, 2.8, 0.5 + 0.5 * Math.max(0, Math.sin(t * 4.5)));
      sparkle(ctx, x + 5, y + 3, 2, 0.4 + 0.6 * Math.max(0, Math.sin(t * 4.5 + 2)));
      // Rare drop: faint light shaft.
      ctx.globalAlpha = 0.14 + pulse * 0.08;
      const lg = ctx.createLinearGradient(x, y - 38, x, y);
      lg.addColorStop(0, 'rgba(244,63,94,0)');
      lg.addColorStop(1, '#fb7185');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 3, y - 38, 6, 38);
      break;
    }
    case 'water-flask': {
      const slosh = Math.sin(t * 3.4) * 1.4;
      glow(ctx, gl, '#38bdf8', 12);
      ctx.fillStyle = 'rgba(224,242,254,0.35)';
      ctx.beginPath();
      ctx.arc(x, y + 2, 6, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - 2.2, y - 6, 4.4, 5);
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y + 2, 5.6, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 9);
      ctx.lineTo(x - 7, y + 1 - slosh);
      ctx.lineTo(x + 7, y + 1 + slosh);
      ctx.lineTo(x + 7, y + 9);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y + 2, 6, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x - 2, y - 8, 4, 2.5);
      const b = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - b;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(x + Math.sin(b * 6) * 1.5, y + 4 - b * 9, 1, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

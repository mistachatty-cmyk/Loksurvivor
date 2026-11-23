/**
 * The rescue objective: a trapped survivor in an iron cage, the beacon above it, the freeing sequence,
 * the burst when the bars give way, and the edge pointer that shows where the cage is when it is off
 * screen. Everything here is procedural Canvas2D (the ally is drawn with its real rig), no bitmaps.
 *
 * All motion is a pure function of `w.now` / `rescue.progress` / `rescue.freedAt`, never wall-clock time.
 */
import { drawGlyph } from '../../ui/lokGlyphCanvas';
import { ALLIES_BY_ID, allyRig } from '@/game/data/progression';
import type { World } from '@/game/engine/world';
import { drawRig, drawShadow } from './sprite';

const IRON_DARK = '#2a2d36';
const IRON = '#7b8190';
const IRON_LIGHT = '#c4cad6';
/** How long the "bars fly apart" burst plays after the survivor is freed. */
export const RESCUE_BURST_MS = 1500;
/** The reach of the freeing ring, in world units (matches the engine's 46 trigger distance). */
export const RESCUE_RING_R = 46;

/** Where the edge pointer sits for a cage that is off screen, or null when the cage is on screen. */
export function rescuePointerPlacement(
  sx: number, sy: number, width: number, height: number, margin: number,
): { x: number; y: number; angle: number } | null {
  if (sx >= margin && sx <= width - margin && sy >= margin && sy <= height - margin) return null;
  const cx = width / 2, cy = height / 2;
  const dx = sx - cx, dy = sy - cy;
  if (dx === 0 && dy === 0) return null;
  const k = Math.min((width / 2 - margin) / Math.abs(dx || 1e-6), (height / 2 - margin) / Math.abs(dy || 1e-6));
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) };
}

export function drawRescue(ctx: CanvasRenderingContext2D, w: World): void {
  const r = w.rescue;
  if (r.status === 'pending') return;
  if (r.status === 'freed') {
    if (r.freedAt !== undefined && w.now - r.freedAt < RESCUE_BURST_MS) drawBurst(ctx, w, (w.now - r.freedAt) / RESCUE_BURST_MS);
    return;
  }
  const ally = r.allyId ? ALLIES_BY_ID[r.allyId] : undefined;
  const glow = ally?.palette.glow ?? '#ffe08a';
  const p = r.progress;
  const freeing = r.status === 'freeing';
  const pulse = 0.5 + Math.sin(w.now / 240) * 0.5;
  const x = r.x, y = r.y;

  ctx.save();
  // Beacon: a soft light column so the cage reads from across the map.
  const column = ctx.createLinearGradient(0, y - 150, 0, y);
  column.addColorStop(0, 'rgba(0,0,0,0)');
  column.addColorStop(1, glow);
  ctx.globalAlpha = 0.10 + pulse * 0.08 + p * 0.18;
  ctx.fillStyle = column;
  ctx.fillRect(x - 16 - p * 8, y - 150, 32 + p * 16, 150);
  ctx.globalAlpha = 1;

  // Ground: shadow, a glowing pad and the freeing ring with rotating tick marks.
  drawShadow(ctx, x, y + 6, 26);
  ctx.globalAlpha = 0.16 + pulse * 0.1 + p * 0.2;
  const pad = ctx.createRadialGradient(x, y + 4, 4, x, y + 4, RESCUE_RING_R);
  pad.addColorStop(0, glow);
  pad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pad;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, RESCUE_RING_R, RESCUE_RING_R * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35 + pulse * 0.2;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 9]);
  ctx.lineDashOffset = -w.now / 30;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, RESCUE_RING_R, RESCUE_RING_R * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Progress arc: thick, bright, grows clockwise from the top while the player stands in the ring.
  if (p > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, RESCUE_RING_R + 5, (RESCUE_RING_R + 5) * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, RESCUE_RING_R + 5, (RESCUE_RING_R + 5) * 0.7, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  const shakeX = freeing ? Math.sin(w.now / 38) * (0.8 + p * 1.6) : Math.sin(w.now / 700) * 0.5;
  const spread = p * 5;            // bars bow outward as the lock gives
  const top = y - 40, bottom = y + 6, half = 17;

  // Back bars (dim), then the survivor, then the front bars, so the person sits inside the cage.
  ctx.translate(shakeX, 0);
  ctx.fillStyle = IRON_DARK;
  for (let i = -2; i <= 2; i += 1) ctx.fillRect(x + i * 7 - 1, top + 3, 2, bottom - top - 6);

  if (ally) {
    const bob = Math.sin(w.now / (freeing ? 90 : 520)) * (freeing ? 1.4 : 0.8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - half + 1, top + 2, half * 2 - 2, bottom - top);
    ctx.clip();
    drawRig(ctx, allyRig(ally), ally.palette, 'idle', w.now, x, y + 4 + bob, 1, 2.3, { outline: true });
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(20,16,24,0.85)';
    ctx.fillRect(x - 7, y - 24, 14, 26);
  }

  // Front bars: lit edge, shadow edge; they bow apart and warm to the ally's glow as progress rises.
  for (let i = -3; i <= 3; i += 1) {
    const bx = x + i * 5.6 + Math.sign(i) * spread * (Math.abs(i) / 3);
    ctx.fillStyle = IRON_DARK;
    ctx.fillRect(bx - 1.6, top, 3.2, bottom - top);
    ctx.fillStyle = p > 0.01 ? mix(IRON_LIGHT, glow, Math.min(1, p * 1.4)) : IRON_LIGHT;
    ctx.fillRect(bx - 1.6, top, 1.4, bottom - top);
  }
  // Top and base plates with corner studs.
  ctx.fillStyle = IRON_DARK;
  ctx.fillRect(x - half - 3, top - 4, half * 2 + 6, 6);
  ctx.fillRect(x - half - 3, bottom - 2, half * 2 + 6, 6);
  ctx.fillStyle = IRON;
  ctx.fillRect(x - half - 3, top - 4, half * 2 + 6, 2);
  ctx.fillRect(x - half - 3, bottom - 2, half * 2 + 6, 2);
  ctx.fillStyle = IRON_LIGHT;
  for (const sx of [-half, half]) { ctx.fillRect(x + sx - 1, top - 3, 2, 2); ctx.fillRect(x + sx - 1, bottom - 1, 2, 2); }

  // Chain across the bars and the padlock that cracks, then drops away, as the cage opens.
  ctx.strokeStyle = IRON;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(x - half - 2, y - 14);
  ctx.quadraticCurveTo(x, y - 8 + p * 6, x + half + 2, y - 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = p > 0.6 ? glow : IRON_LIGHT;
  drawGlyph(ctx, 'lock', x, y - 11 + p * 4, 11 + Math.sin(w.now / 55) * p * 1.5);

  ctx.translate(-shakeX, 0);
  // A pulsing warning mark over the cage until someone steps into the ring.
  if (!freeing) {
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = glow;
    drawGlyph(ctx, 'warn', x, top - 14 - pulse * 3, 12);
  }
  // Sparks off the lock while it works.
  if (freeing) {
    ctx.fillStyle = glow;
    for (let i = 0; i < 4; i += 1) {
      const a = w.now / 90 + i * 1.6, d = 6 + ((w.now / 40 + i * 9) % 14);
      ctx.globalAlpha = 1 - d / 22;
      ctx.fillRect(x + Math.cos(a) * d - 1, y - 11 + Math.sin(a) * d - 1, 2, 2);
    }
  }
  ctx.restore();
}

/** The cage bars fly apart, a ring expands and the freed survivor's glow drifts up. `t` runs 0 to 1. */
function drawBurst(ctx: CanvasRenderingContext2D, w: World, t: number): void {
  const r = w.rescue;
  const ally = r.allyId ? ALLIES_BY_ID[r.allyId] : undefined;
  const glow = ally?.palette.glow ?? '#ffe08a';
  const fade = 1 - t;
  ctx.save();
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 4 * fade + 1;
  ctx.beginPath();
  ctx.ellipse(r.x, r.y + 4, 20 + t * 90, (20 + t * 90) * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = fade;
  for (let i = -3; i <= 3; i += 1) {
    const dir = i === 0 ? 0.3 : Math.sign(i);
    const bx = r.x + i * 5.6 + dir * t * 46;
    const by = r.y - 17 - t * 26 + t * t * 70;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(dir * t * 3.2 + i * 0.2);
    ctx.fillStyle = IRON_LIGHT;
    ctx.fillRect(-1.6, -17, 3.2, 34);
    ctx.restore();
  }
  ctx.fillStyle = glow;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2, d = t * (30 + (i % 3) * 14);
    ctx.fillRect(r.x + Math.cos(a) * d - 1.5, r.y - 14 + Math.sin(a) * d * 0.8 - t * 26 - 1.5, 3, 3);
  }
  ctx.globalAlpha = fade * 0.8;
  drawGlyph(ctx, 'spark', r.x, r.y - 30 - t * 34, 16 + t * 6);
  ctx.restore();
}

/** Screen space: when the cage is off screen, an arrow on the nearest edge points toward it. */
export function drawRescuePointer(
  ctx: CanvasRenderingContext2D, w: World, width: number, height: number, zoom: number,
): void {
  const r = w.rescue;
  if (r.status !== 'available' && r.status !== 'freeing') return;
  const sx = (r.x - w.camera.x) * zoom + width / 2;
  const sy = (r.y - w.camera.y) * zoom + height / 2;
  const place = rescuePointerPlacement(sx, sy, width, height, 34);
  if (!place) return;
  const ally = r.allyId ? ALLIES_BY_ID[r.allyId] : undefined;
  const glow = ally?.palette.glow ?? '#ffe08a';
  const beat = 0.7 + Math.sin(w.now / 200) * 0.3;
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.globalAlpha = beat;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = glow;
  drawGlyph(ctx, 'lock', 0, 0, 14);
  ctx.rotate(place.angle);
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(18, -6);
  ctx.lineTo(18, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function parseHex(hex: string): number[] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

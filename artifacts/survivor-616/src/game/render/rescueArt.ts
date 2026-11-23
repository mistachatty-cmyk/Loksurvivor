/**
 * The rescue objective: a survivor held in one of ARCHON-616's digitization relays (hard-light bars, a siphon
 * mast pulling their Soul Sparks away, glitching as they drain; see docs LORE.md). Legacy name: the cage, the beacon above it, the freeing sequence,
 * the burst when the bars give way, and the edge pointer that shows where the cage is when it is off
 * screen. Everything here is procedural Canvas2D (the ally is drawn with its real rig), no bitmaps.
 *
 * All motion is a pure function of `w.now` / `rescue.progress` / `rescue.freedAt`, never wall-clock time.
 */
import { drawGlyph } from '../../ui/lokGlyphCanvas';
import { ALLIES_BY_ID, allyRig } from '@/game/data/progression';
import { rescueSiphon, type World } from '@/game/engine/world';
import { drawRig, drawShadow } from './sprite';

const IRON_DARK = '#2a2d36';
const IRON = '#7b8190';
const IRON_LIGHT = '#c4cad6';
/** ARCHON-616's colour: the hard-light bars of a digitization relay. */
const ARCHON = '#38e1ff';
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
  const siphon = rescueSiphon(w);
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

  // Reactive: the survivor notices you. Within 240 units the cage rattles harder and the survivor faces you.
  const near = Math.max(0, 1 - Math.hypot(w.player.x - x, w.player.y - y) / 240);
  const facing: 1 | -1 = w.player.x >= x ? 1 : -1;
  const shakeX = freeing ? Math.sin(w.now / 38) * (0.8 + p * 1.6) : Math.sin(w.now / (260 - near * 160)) * (0.5 + near * 1.3);
  // Hype mark and rising dust while someone works the lock.
  const strobe = p > 0.82 ? (Math.sin(w.now / 40) > 0 ? 1 : 0) : 0;
  // Quarter pips on the arc light up as the lock progresses.
  if (p > 0) {
    for (let q = 1; q <= 4; q += 1) {
      const a = -Math.PI / 2 + (q / 4) * Math.PI * 2;
      const lit = p >= q / 4 - 0.001;
      ctx.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.28)';
      const px = x + Math.cos(a) * (RESCUE_RING_R + 5), py = y + 4 + Math.sin(a) * (RESCUE_RING_R + 5) * 0.7;
      ctx.fillRect(px - 2, py - 2, 4, 4);
      if (lit && p < q / 4 + 0.06) { ctx.globalAlpha = 1 - (p - q / 4) / 0.06; ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.strokeRect(px - 6, py - 6, 12, 12); ctx.globalAlpha = 1; }
    }
  }
  if (freeing) {
    ctx.fillStyle = 'rgba(210,200,190,0.45)';
    for (let i = 0; i < 6; i += 1) {
      const life = ((w.now / 22 + i * 17) % 100) / 100;
      ctx.globalAlpha = (1 - life) * 0.5;
      const dx = (i - 2.5) * 9 + Math.sin(i * 3 + w.now / 200) * 3;
      ctx.fillRect(x + dx - 2, y + 4 - life * 20, 4 - life * 2, 4 - life * 2);
    }
    ctx.globalAlpha = 1;
  }
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
    const rig = allyRig(ally);
    const anim = freeing ? 'hurt' : near > 0.35 ? 'walk' : 'idle';
    if (siphon < 0.06) {
      drawRig(ctx, rig, ally.palette, anim, w.now, x, y + 4 + bob, facing, 2.3, { outline: true, flash: strobe === 1 });
    } else {
      // Glitching as ARCHON drains them: horizontal slices tear sideways, harder the longer they are held,
      // and a cyan ghost lags behind. Slice offsets step every 110 ms so it reads as stutter, not wobble.
      const step = Math.floor(w.now / 110);
      for (let band = 0; band < 4; band += 1) {
        const off = (noise(step * 7 + band) - 0.5) * 9 * siphon * (freeing ? 0.4 : 1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - half, top + band * 11, half * 2, 11);
        ctx.clip();
        ctx.globalAlpha = 1 - siphon * 0.35;
        drawRig(ctx, rig, ally.palette, anim, w.now, x + off, y + 4 + bob, facing, 2.3, { outline: true, flash: strobe === 1 });
        ctx.globalAlpha = 0.25 * siphon;
        drawRig(ctx, rig, ally.palette, anim, w.now, x + off - 3, y + 4 + bob, facing, 2.3, { tint: { color: ARCHON, alpha: 0.6 } });
        ctx.restore();
      }
    }
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
    const edge = p > 0.01 ? mix(ARCHON, glow, Math.min(1, p * 1.4)) : ARCHON;
    ctx.fillStyle = edge;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(bx - 1.6, top, 1.4, bottom - top);
    // A scanline runs up each bar, staggered, so the hold reads as live hard light.
    const sy = bottom - ((w.now / 18 + i * 13) % (bottom - top + 12));
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 1.6, Math.max(top, sy), 3.2, 3);
    ctx.globalAlpha = 1;
  }
  if (strobe) {   // last stretch: the whole cage flashes white-hot
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - half - 3, top - 4, half * 2 + 6, bottom - top + 10);
    ctx.globalAlpha = 1;
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
  // Siphon mast: Soul Sparks stream up it toward ARCHON. Freeing reverses the flow back into the survivor.
  const mx = x + half + 9;
  ctx.fillStyle = IRON_DARK;
  ctx.fillRect(mx - 1.5, top - 26, 3, bottom - top + 26);
  ctx.fillStyle = IRON;
  ctx.fillRect(mx - 1.5, top - 26, 1, bottom - top + 26);
  ctx.fillStyle = ARCHON;
  ctx.fillRect(mx - 4, top - 30, 8, 3);
  ctx.fillRect(mx - 1, top - 34, 2, 4);
  const draining = !freeing;
  const rate = 4 + Math.round(siphon * 6);
  for (let i = 0; i < rate; i += 1) {
    const life = ((w.now / (draining ? 26 : 20) + i * (100 / rate)) % 100) / 100;
    const t = draining ? life : 1 - life;
    ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
    ctx.fillStyle = i % 3 === 0 ? '#fff' : glow;
    ctx.fillRect(mx - 1 - Math.sin(i * 2.3 + w.now / 300) * 2, bottom - 8 - t * (bottom - top + 22), 2, 2);
  }
  ctx.globalAlpha = 1;
  // Soul Spark meter beside the mast: how much of them is left. Pulses red near deletion.
  const left = 1 - siphon;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx + 5, top, 4, bottom - top);
  ctx.fillStyle = siphon > 0.8 && Math.sin(w.now / 70) > 0 ? '#ff4d6d' : glow;
  ctx.fillRect(mx + 5.5, top + (bottom - top) * siphon + 0.5, 3, Math.max(1, (bottom - top) * left - 1));
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
  // Light pillar punches up and thins out.
  ctx.globalAlpha = fade * fade * 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(r.x - 14 * fade, r.y - 190, 28 * fade, 196);
  // Ground cracks radiating from the cage.
  ctx.globalAlpha = Math.min(1, fade * 1.6) * 0.7;
  ctx.strokeStyle = '#0b0b10';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + 0.4, len = 16 + t * 30 + (i % 3) * 5;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + 6);
    ctx.lineTo(r.x + Math.cos(a) * len * 0.5 + (i % 2 ? 3 : -3), r.y + 6 + Math.sin(a) * len * 0.35);
    ctx.lineTo(r.x + Math.cos(a) * len, r.y + 6 + Math.sin(a) * len * 0.7);
    ctx.stroke();
  }
  // Confetti in the survivor's own colours, with gravity.
  ctx.globalAlpha = fade;
  const accent = ally?.palette.accent ?? '#c9a26a';
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2 + i, sp = 40 + (i % 5) * 16;
    const px = r.x + Math.cos(a) * sp * t, py = r.y - 14 + Math.sin(a) * sp * 0.6 * t - 60 * t * (1 - t) * 2 + t * t * 80;
    ctx.fillStyle = i % 2 ? glow : accent;
    ctx.save(); ctx.translate(px, py); ctx.rotate(t * 9 + i); ctx.fillRect(-2, -1, 4, 2); ctx.restore();
  }
  // The survivor springs out, hops once and then runs for the player (a ghost that fades as they join you).
  if (ally) {
    const hop = Math.abs(Math.sin(t * Math.PI * 2.5)) * 14 * (1 - t);
    const run = t * t * Math.sign(w.player.x - r.x || 1) * 26;
    ctx.globalAlpha = Math.min(1, fade * 1.5);
    drawRig(ctx, allyRig(ally), ally.palette, t < 0.5 ? 'idle' : 'walk', w.now, r.x + run, r.y + 4 - hop, w.player.x >= r.x ? 1 : -1, 2.3, { outline: true });
  }
  ctx.globalAlpha = fade;
  ctx.globalAlpha = fade * 0.8;
  drawGlyph(ctx, 'spark', r.x, r.y - 30 - t * 34, 16 + t * 6);
  ctx.restore();
}

/** Screen space: when the cage is off screen, an arrow on the nearest edge points toward it. */
export function drawRescuePointer(
  ctx: CanvasRenderingContext2D, w: World, width: number, height: number, zoom: number,
): void {
  const r = w.rescue;
  // Screen flash on release, then a colour wash on the edges while the lock works.
  const allyGlow = (r.allyId ? ALLIES_BY_ID[r.allyId] : undefined)?.palette.glow ?? '#ffe08a';
  if (r.status === 'freed' && r.freedAt !== undefined && w.now - r.freedAt < 220) {
    ctx.save();
    ctx.globalAlpha = (1 - (w.now - r.freedAt) / 220) * 0.55;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (r.status === 'freeing' && r.progress > 0) {
    const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4, width / 2, height / 2, Math.max(width, height) * 0.75);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, allyGlow);
    ctx.save();
    ctx.globalAlpha = r.progress * (0.22 + Math.sin(w.now / 90) * 0.05);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
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

/** Cheap deterministic 0..1 noise from an integer, so glitch slices stutter the same way for everyone. */
function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

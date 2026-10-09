/**
 * Painted backdrop for the hideout strip: each room gets its own skyline or wall,
 * lamps that breathe, and a floor with a lit pool under the operator, instead of
 * actors floating over a flat dark band. Plain Canvas2D shapes like the rigs and
 * props -- no bitmaps. Everything is a pure function of `now` (ms) plus the music
 * energy, so it needs no state and a still frame under reduced motion is exact.
 *
 * Add a room look by adding a `case` to `drawBackdrop` and a biome to `HideoutBiome`.
 */

import type { HideoutBiome } from '@/game/types';

export interface SceneryOptions {
  biome: HideoutBiome;
  accent: string;
  w: number;
  h: number;
  groundY: number;
  now: number;
  /** 0..1 smoothed loudness of whatever is playing; 0 when silent. */
  energy: number;
  /** 0..1 position within the current beat. */
  beatPhase: number;
  /** Where the operator stands, for the light pool. */
  lightX: number;
  reduceMotion: boolean;
}

/** A cheap deterministic 0..1 hash so windows and stars keep their place frame to frame. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** Window rows on a building slab; a few flicker, one in a while goes dark. */
function windows(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  seed: number, color: string, t: number,
) {
  const cols = Math.max(1, Math.floor(w / 9));
  const rows = Math.max(1, Math.floor(h / 12));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const id = seed * 31 + r * 7 + c;
      if (hash(id) < 0.42) continue;
      const flick = hash(id + 9) < 0.18 ? 0.55 + 0.45 * Math.sin(t / (500 + hash(id) * 900) + id) : 1;
      ctx.fillStyle = rgba(color, 0.55 * flick);
      ctx.fillRect(x + 3 + c * 9, y + 4 + r * 12, 4, 6);
    }
  }
}

/** Two parallax skyline layers; `drift` is a slow sideways breathing, not a scroll. */
function skyline(
  ctx: CanvasRenderingContext2D, o: SceneryOptions, far: string, near: string, lit: string,
) {
  const { w, groundY, now } = o;
  const t = o.reduceMotion ? 0 : now;
  const layers: Array<{ color: string; minH: number; spanH: number; width: number; drift: number; seed: number }> = [
    { color: far, minH: 0.22, spanH: 0.22, width: 34, drift: 0.0006, seed: 3 },
    { color: near, minH: 0.18, spanH: 0.3, width: 46, drift: 0.0012, seed: 11 },
  ];
  for (const layer of layers) {
    const shift = Math.sin(t * layer.drift) * 5;
    for (let x = -layer.width, i = 0; x < w + layer.width; x += layer.width, i += 1) {
      const bh = (layer.minH + hash(i + layer.seed) * layer.spanH) * groundY;
      ctx.fillStyle = layer.color;
      ctx.fillRect(x + shift, groundY - bh, layer.width - 2, bh);
      if (layer.seed === 11) windows(ctx, x + shift, groundY - bh, layer.width - 2, bh, i, lit, t);
    }
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, o: SceneryOptions) {
  const { biome, accent, w, groundY, now } = o;
  const t = o.reduceMotion ? 0 : now;
  switch (biome) {
    case 'sanctum': {
      // Warm bar room: shuttered windows with rain-blur light and an awning edge.
      skyline(ctx, o, '#0e1522', '#131c2c', '#fcd34d');
      ctx.fillStyle = 'rgba(8,10,16,0.55)';
      ctx.fillRect(0, 0, w, groundY * 0.2);
      for (let x = 14; x < w; x += 58) {
        ctx.fillStyle = rgba('#f59e0b', 0.06 + 0.03 * Math.sin(t / 900 + x));
        ctx.fillRect(x, 0, 6, groundY * 0.2);
      }
      break;
    }
    case 'rooftop': {
      // Night sky with stars, a slow marker lamp and a water-tower silhouette.
      for (let i = 0; i < 46; i += 1) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 1100 + i * 2.3));
        ctx.fillStyle = `rgba(226,242,255,${0.2 + 0.5 * tw * hash(i + 40)})`;
        ctx.fillRect(hash(i) * w, hash(i + 90) * groundY * 0.5, 1.5, 1.5);
      }
      skyline(ctx, o, '#0a1220', '#0f1b2c', '#7dd3fc');
      const tx = w * 0.82;
      ctx.fillStyle = '#0a121d';
      ctx.fillRect(tx - 14, groundY * 0.22, 28, 18);
      ctx.fillRect(tx - 12, groundY * 0.22 + 18, 3, groundY * 0.5);
      ctx.fillRect(tx + 9, groundY * 0.22 + 18, 3, groundY * 0.5);
      const blink = Math.sin(t / 700) > 0.55 ? 1 : 0.18;
      ctx.fillStyle = rgba(accent, blink);
      ctx.beginPath();
      ctx.arc(tx, groundY * 0.22 - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cellar': {
      // Brick wall, a run of pipes and glowing glass growths that slowly breathe.
      ctx.fillStyle = '#120d0c';
      ctx.fillRect(0, 0, w, groundY);
      for (let row = 0, y = 4; y < groundY; row += 1, y += 12) {
        for (let x = (row % 2) * 14 - 14; x < w; x += 28) {
          ctx.fillStyle = `rgba(${48 + hash(row * 50 + x) * 14},${30},${26},0.55)`;
          ctx.fillRect(x + 1, y, 26, 10);
        }
      }
      ctx.fillStyle = '#26323a';
      ctx.fillRect(0, groundY * 0.18, w, 7);
      ctx.fillStyle = '#3a4a54';
      ctx.fillRect(0, groundY * 0.18, w, 2);
      for (let i = 0; i < 6; i += 1) {
        const gx = ((i + 0.5) / 6) * w + (hash(i) - 0.5) * 30;
        const breathe = 0.5 + 0.5 * Math.sin(t / 1400 + i * 1.7);
        const gy = groundY * (0.5 + hash(i + 5) * 0.25);
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 26);
        grad.addColorStop(0, rgba(accent, 0.35 * breathe + 0.1));
        grad.addColorStop(1, rgba(accent, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 26, gy - 26, 52, 52);
        ctx.fillStyle = rgba(accent, 0.6 + 0.3 * breathe);
        ctx.beginPath();
        ctx.moveTo(gx - 3, gy + 7);
        ctx.lineTo(gx, gy - 7);
        ctx.lineTo(gx + 3, gy + 7);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'alley': {
      // Fire escape, stacked crates and a service lamp throwing a swaying cone.
      skyline(ctx, o, '#0d0b0a', '#14100e', '#fb923c');
      ctx.strokeStyle = '#1c1714';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const ex = w * 0.12 + i * 22;
        ctx.beginPath();
        ctx.moveTo(ex, groundY * 0.3 + i * 14);
        ctx.lineTo(ex + 22, groundY * 0.3 + i * 14 + 14);
        ctx.stroke();
      }
      const lx = w * 0.7;
      const sway = o.reduceMotion ? 0 : Math.sin(t / 1300) * 4;
      ctx.strokeStyle = '#2a2420';
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx + sway, groundY * 0.2);
      ctx.stroke();
      const cone = ctx.createLinearGradient(0, groundY * 0.2, 0, groundY);
      cone.addColorStop(0, rgba(accent, 0.22));
      cone.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lx + sway - 4, groundY * 0.2);
      ctx.lineTo(lx + sway + 4, groundY * 0.2);
      ctx.lineTo(lx + sway + 46, groundY);
      ctx.lineTo(lx + sway - 46, groundY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'archive': {
      // Neon-sleeve shopfront: shuttered bays and a buzzing sign that stutters now and then.
      ctx.fillStyle = '#0d0b1c';
      ctx.fillRect(0, 0, w, groundY);
      for (let x = 10; x < w - 40; x += 74) {
        ctx.fillStyle = '#15122b';
        ctx.fillRect(x, groundY * 0.28, 60, groundY * 0.5);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let s = 0; s < 6; s += 1) ctx.fillRect(x, groundY * 0.28 + s * 9, 60, 3);
      }
      const stutter = !o.reduceMotion && Math.sin(t / 53) * Math.sin(t / 2300) > 0.93 ? 0.3 : 1;
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12 * stutter;
      ctx.strokeStyle = rgba(accent, 0.85 * stutter);
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.08, groundY * 0.1, 70, 16);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

/** The floor: a darker band, a lit pool under the operator and a faint beat-driven rim. */
function drawFloor(ctx: CanvasRenderingContext2D, o: SceneryOptions) {
  const { w, h, groundY, accent, lightX, energy, beatPhase } = o;
  const floor = ctx.createLinearGradient(0, groundY - 2, 0, h);
  floor.addColorStop(0, 'rgba(6,6,10,0.7)');
  floor.addColorStop(1, 'rgba(6,6,10,0.95)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, groundY - 2, w, h - groundY + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, groundY - 2, w, 1);
  const pulse = energy > 0.04 ? energy * (1 - beatPhase) * 0.5 : 0;
  const radius = 90 + pulse * 40;
  ctx.save();
  ctx.translate(lightX, groundY);
  ctx.scale(1, 0.32);
  const flat = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  flat.addColorStop(0, rgba(accent, 0.2 + pulse));
  flat.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = flat;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Drifting dust in the light, denser when music plays. Drawn in front of the backdrop. */
function drawDust(ctx: CanvasRenderingContext2D, o: SceneryOptions) {
  if (o.reduceMotion) return;
  const { w, groundY, now, accent, energy } = o;
  const count = 14 + Math.round(energy * 14);
  ctx.fillStyle = rgba(accent, 0.35);
  for (let i = 0; i < count; i += 1) {
    const speed = 0.004 + hash(i) * 0.008;
    const x = ((hash(i + 3) * w + now * speed) % (w + 20)) - 10;
    const y = groundY * (0.15 + 0.8 * ((hash(i + 7) + Math.sin(now / 2600 + i) * 0.04 + 1) % 1));
    const a = 0.25 + 0.5 * Math.abs(Math.sin(now / 1700 + i * 1.9));
    ctx.globalAlpha = a * 0.7;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
}

/** Everything that sits behind the actors. */
export function drawSceneryBack(ctx: CanvasRenderingContext2D, o: SceneryOptions): void {
  drawBackdrop(ctx, o);
  drawFloor(ctx, o);
  drawDust(ctx, o);
}

/** Soft vignette over the finished frame so the edges fall away into the page. */
export function drawSceneryFront(ctx: CanvasRenderingContext2D, o: SceneryOptions): void {
  const side = ctx.createLinearGradient(0, 0, o.w, 0);
  side.addColorStop(0, 'rgba(0,0,0,0.45)');
  side.addColorStop(0.18, 'rgba(0,0,0,0)');
  side.addColorStop(0.82, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, o.w, o.h);
}

/** Small footstep puff colour, per biome floor. */
export function dustColorFor(biome: HideoutBiome): string {
  switch (biome) {
    case 'cellar': return '#6b7280';
    case 'archive': return '#a78bfa';
    case 'rooftop': return '#94a3b8';
    case 'alley': return '#a8a29e';
    default: return '#cbd5e1';
  }
}

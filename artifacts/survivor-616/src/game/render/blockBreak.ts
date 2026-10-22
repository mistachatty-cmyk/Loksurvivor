/**
 * Glass and ice blocks: how they look whole, how they crack, and how they shatter.
 *
 * Everything here is a pure function of (seed, hit marks, damage, brokenAt, now), so nothing is stored
 * in the simulation and the same block always breaks the same way:
 *
 *  - Cracks are grown from each real hit point as layered networks (deep fracture lines, branches,
 *    hairlines, and for glass a spider web of rings) and drawn in four passes (depth shadow, glow,
 *    bright core, dark fracture) so they read as cut into the surface. New cracks grow outward over
 *    ~170 ms, and the block flashes and shakes on each hit.
 *  - Breaking plays in frames: a white flash with the full web lit (0-80 ms), the block splitting into
 *    a jittered triangle tiling that flies out from the hit point with drag, spin and a lifted arc,
 *    a shock ring, glints, and frost mist (ice) or glass dust, then shards settling and fading.
 *
 * Canvas2D only, no bitmaps. Shapes are cached per seed because they are built from small RNG loops.
 */

export type BlockMaterial = 'glass' | 'ice';

export const BLOCK_FX_LINGER_MS = 2400;

export function blockMaterialOf(kind: string): BlockMaterial | undefined {
  return kind === 'glass-block' ? 'glass' : kind === 'ice-block' ? 'ice' : undefined;
}

// ---------------------------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------------------------

function hash32(a: number, b = 0, c = 0): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------------------------
// Crack networks (normalised to the block: -0.5..0.5 on both axes)
// ---------------------------------------------------------------------------------------------

export interface CrackSeg {
  x0: number; y0: number; x1: number; y1: number;
  /** 0 = deep fracture, 1 = branch / web ring, 2 = hairline. */
  layer: 0 | 1 | 2;
  /** 0..1: how far into a crack's growth this segment appears. */
  order: number;
}

const crackCache = new Map<string, CrackSeg[]>();
const CRACK_CACHE_LIMIT = 240;

/** Grows one crack network from an impact point. Deterministic in (seed, material, origin). */
export function buildCrackNetwork(seed: number, material: BlockMaterial, ox: number, oy: number): CrackSeg[] {
  const key = `${material}:${seed}:${Math.round(ox * 40)}:${Math.round(oy * 40)}`;
  const cached = crackCache.get(key);
  if (cached) return cached;
  const rng = rngFrom(hash32(seed, Math.round(ox * 997), Math.round(oy * 991)));
  const glass = material === 'glass';
  const rays = (glass ? 6 : 4) + Math.floor(rng() * (glass ? 4 : 3));
  const segs: CrackSeg[] = [];
  const rayPoints: Array<Array<[number, number]>> = [];
  for (let i = 0; i < rays; i += 1) {
    let angle = (i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    let x = ox;
    let y = oy;
    const steps = (glass ? 4 : 3) + Math.floor(rng() * 3);
    const points: Array<[number, number]> = [[x, y]];
    for (let k = 0; k < steps; k += 1) {
      const len = (glass ? 0.1 : 0.14) + rng() * (glass ? 0.12 : 0.16);
      angle += (rng() - 0.5) * (glass ? 0.75 : 0.45);
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      const order = (k + 1) / steps;
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, layer: 0, order });
      if (k > 0 && rng() < (glass ? 0.55 : 0.42)) {
        let ba = angle + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.7);
        let bx = nx;
        let by = ny;
        const bn = 2 + Math.floor(rng() * 2);
        for (let j = 0; j < bn; j += 1) {
          ba += (rng() - 0.5) * 0.6;
          const bl = 0.05 + rng() * 0.08;
          segs.push({ x0: bx, y0: by, x1: bx + Math.cos(ba) * bl, y1: by + Math.sin(ba) * bl, layer: 1, order: Math.min(1, order + ((j + 1) / bn) * 0.12) });
          bx += Math.cos(ba) * bl;
          by += Math.sin(ba) * bl;
        }
      }
      if (rng() < 0.6) {
        const count = 1 + Math.floor(rng() * 2);
        for (let h = 0; h < count; h += 1) {
          const ha = angle + (rng() - 0.5) * 2.4;
          const hl = 0.03 + rng() * 0.045;
          segs.push({ x0: nx, y0: ny, x1: nx + Math.cos(ha) * hl, y1: ny + Math.sin(ha) * hl, layer: 2, order: Math.min(1, order + 0.1) });
        }
      }
      x = nx;
      y = ny;
      points.push([x, y]);
      if (Math.abs(x) > 0.62 || Math.abs(y) > 0.62) break;
    }
    rayPoints.push(points);
  }
  if (glass) {
    // Spider-web rings: join neighbouring rays at the same depth, sagging a little between them.
    for (let ring = 1; ring <= 3; ring += 1) {
      for (let i = 0; i < rays; i += 1) {
        const a = rayPoints[i]![ring];
        const b = rayPoints[(i + 1) % rays]![ring];
        if (!a || !b) continue;
        const mx = (a[0] + b[0]) / 2 + (rng() - 0.5) * 0.04;
        const my = (a[1] + b[1]) / 2 + (rng() - 0.5) * 0.04;
        const order = clamp(ring / 4 + 0.15, 0.2, 1);
        segs.push({ x0: a[0], y0: a[1], x1: mx, y1: my, layer: 1, order });
        segs.push({ x0: mx, y0: my, x1: b[0], y1: b[1], layer: 1, order });
      }
    }
  } else {
    // Ice splits along a couple of long, clean fault lines as well as the radial cracks.
    const faults = 1 + Math.floor(rng() * 2);
    for (let f = 0; f < faults; f += 1) {
      const a = rng() * Math.PI;
      const off = (rng() - 0.5) * 0.24;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const cx = ox + -dy * off;
      const cy = oy + dx * off;
      const half = 0.5 + rng() * 0.25;
      const parts = 4;
      for (let p = 0; p < parts; p += 1) {
        const t0 = -half + (p / parts) * half * 2;
        const t1 = -half + ((p + 1) / parts) * half * 2;
        const wob0 = (rng() - 0.5) * 0.04;
        const wob1 = (rng() - 0.5) * 0.04;
        segs.push({
          x0: cx + dx * t0 + -dy * wob0, y0: cy + dy * t0 + dx * wob0,
          x1: cx + dx * t1 + -dy * wob1, y1: cy + dy * t1 + dx * wob1,
          layer: 0, order: clamp(0.35 + Math.abs(t1) / (half * 1.6), 0.3, 1),
        });
      }
    }
  }
  if (crackCache.size >= CRACK_CACHE_LIMIT) {
    const first = crackCache.keys().next().value;
    if (first !== undefined) crackCache.delete(first);
  }
  crackCache.set(key, segs);
  return segs;
}

// ---------------------------------------------------------------------------------------------
// Shatter tiling
// ---------------------------------------------------------------------------------------------

export type ShardTriangle = [number, number, number, number, number, number];

const tilingCache = new Map<string, ShardTriangle[]>();

/** Splits the block (-0.5..0.5) into a jittered triangle tiling. The triangles always cover it exactly. */
export function shardTiling(seed: number, gx: number, gy: number): ShardTriangle[] {
  const key = `${seed}:${gx}:${gy}`;
  const cached = tilingCache.get(key);
  if (cached) return cached;
  const corner = (i: number, j: number): [number, number] => {
    const bx = i / gx - 0.5;
    const by = j / gy - 0.5;
    if (i === 0 || j === 0 || i === gx || j === gy) return [bx, by];
    const r = rngFrom(hash32(seed, i * 31 + 7, j * 17 + 3));
    return [bx + (r() - 0.5) * (0.7 / gx), by + (r() - 0.5) * (0.7 / gy)];
  };
  const tris: ShardTriangle[] = [];
  for (let j = 0; j < gy; j += 1) {
    for (let i = 0; i < gx; i += 1) {
      const a = corner(i, j);
      const b = corner(i + 1, j);
      const c = corner(i + 1, j + 1);
      const d = corner(i, j + 1);
      if (hash32(seed, i, j) & 1) {
        tris.push([a[0], a[1], b[0], b[1], c[0], c[1]], [a[0], a[1], c[0], c[1], d[0], d[1]]);
      } else {
        tris.push([a[0], a[1], b[0], b[1], d[0], d[1]], [b[0], b[1], c[0], c[1], d[0], d[1]]);
      }
    }
  }
  if (tilingCache.size >= 60) {
    const first = tilingCache.keys().next().value;
    if (first !== undefined) tilingCache.delete(first);
  }
  tilingCache.set(key, tris);
  return tris;
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

export interface BlockArt {
  material: BlockMaterial;
  /** Ground-plane centre of the block and its footprint, like every other obstacle. */
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  /** 0 (new) .. 1 (about to break). */
  damage: number;
  /** Flattened world-space hit points (x, y, x, y, ...), oldest first. */
  marks?: readonly number[];
  lastHitAt?: number;
  lastHitX?: number;
  lastHitY?: number;
  brokenAt?: number;
  now: number;
  quality: 'high' | 'balanced' | 'performance';
  motionEnabled: boolean;
  /** Ice only: moving fast enough to be leaving a trail. */
  sliding?: boolean;
}

const BLOCK_HEIGHT = 16;
const CRACK_GROW_MS = 170;

const PALETTE = {
  glass: {
    sideTop: 'rgba(76,178,206,0.88)', sideBottom: 'rgba(14,64,86,0.92)',
    faceA: 'rgba(120,214,238,0.62)', faceB: 'rgba(24,96,122,0.72)', base: '#0b2a38',
    edge: 'rgba(235,252,255,0.95)', inner: 'rgba(120,230,255,0.5)', shard: ['rgba(170,236,252,0.62)', 'rgba(130,214,240,0.6)', 'rgba(206,246,255,0.58)', 'rgba(98,190,222,0.6)'],
    flash: '#e9fcff', ring: '#bff4ff',
  },
  ice: {
    sideTop: 'rgba(150,208,236,0.98)', sideBottom: 'rgba(54,118,170,0.98)',
    faceA: '#eefbff', faceB: '#8ccbee', base: '#6cb4dc',
    edge: 'rgba(255,255,255,0.95)', inner: 'rgba(190,236,255,0.6)', shard: ['#e5f8ff', '#c9ecfb', '#f4fdff', '#a9dcf4'],
    flash: '#ffffff', ring: '#d8f4ff',
  },
} as const;

function tracePoly(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

/** Draws one glass or ice block in whatever state it is in (whole, cracked, or shattering). */
export function drawBlockMaterial(ctx: CanvasRenderingContext2D, art: BlockArt): void {
  if (art.brokenAt !== undefined) {
    drawShatter(ctx, art);
    return;
  }
  drawWhole(ctx, art);
}

function drawWhole(ctx: CanvasRenderingContext2D, art: BlockArt) {
  const { material, x: cx, y: cy, w, h, now, seed } = art;
  const pal = PALETTE[material];
  const hitAge = art.lastHitAt === undefined ? Infinity : now - art.lastHitAt;
  const shake = art.motionEnabled && hitAge < 140 ? Math.sin(hitAge * 0.95) * 2.2 * (1 - hitAge / 140) : 0;
  const left = cx - w / 2 + shake;
  const top = cy - h / 2 - BLOCK_HEIGHT;

  // Ground shadow.
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#000000';
  ctx.fillRect(left + 10, cy - h / 2 + h + 10, w, Math.max(5, h * 0.18));
  ctx.restore();

  ctx.save();
  // Side face.
  const side = ctx.createLinearGradient(0, top + h, 0, top + h + BLOCK_HEIGHT);
  side.addColorStop(0, pal.sideTop);
  side.addColorStop(1, pal.sideBottom);
  ctx.fillStyle = side;
  ctx.fillRect(left, top + h, w, BLOCK_HEIGHT);
  // Bright lip along the front edge and a few vertical glints down the side.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(left, top + h, w, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 1; i < 4; i += 1) ctx.fillRect(left + (w * i) / 4 + Math.sin(seed + i) * 3, top + h + 2, 1.5, BLOCK_HEIGHT - 4);

  // Top face.
  ctx.fillStyle = pal.base;
  ctx.fillRect(left, top, w, h);
  const face = ctx.createLinearGradient(left, top, left + w, top + h);
  face.addColorStop(0, pal.faceA);
  face.addColorStop(1, pal.faceB);
  ctx.fillStyle = face;
  ctx.fillRect(left, top, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();
  if (material === 'glass') {
    // Two soft diagonal reflection bands, plus a glint that sweeps across now and then.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (const [offset, width] of [[0.18, 0.1], [0.42, 0.05]] as const) {
      ctx.beginPath();
      ctx.moveTo(left + w * offset, top);
      ctx.lineTo(left + w * (offset + width), top);
      ctx.lineTo(left + w * (offset + width) - h * 0.55, top + h);
      ctx.lineTo(left + w * offset - h * 0.55, top + h);
      ctx.closePath();
      ctx.fill();
    }
    const sweep = ((now / 2800 + (seed % 9) / 9) % 1) * 1.6 - 0.3;
    if (sweep > -0.1 && sweep < 1.1) {
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(left + w * sweep, top);
      ctx.lineTo(left + w * (sweep + 0.07), top);
      ctx.lineTo(left + w * (sweep + 0.07) - h * 0.5, top + h);
      ctx.lineTo(left + w * sweep - h * 0.5, top + h);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Frost swirls, trapped bubbles and a bevelled highlight.
    const r = rngFrom(hash32(seed, 11));
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(left + w * (0.15 + r() * 0.7), top + h * (0.15 + r() * 0.7), w * (0.1 + r() * 0.14), h * (0.07 + r() * 0.1), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc(left + w * (0.1 + r() * 0.8), top + h * (0.12 + r() * 0.76), 0.9 + r() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + 3, top + h - 4);
    ctx.lineTo(left + 3, top + 3);
    ctx.lineTo(left + w - 4, top + 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,98,150,0.4)';
    ctx.beginPath();
    ctx.moveTo(left + w - 3, top + 5);
    ctx.lineTo(left + w - 3, top + h - 3);
    ctx.lineTo(left + 5, top + h - 3);
    ctx.stroke();
    // A twinkle that wanders across the block, quicker when it is sliding.
    const tw = (Math.sin(now / (art.sliding ? 90 : 520) + seed) + 1) / 2;
    if (tw > 0.82) drawStar(ctx, left + w * (0.25 + ((seed % 5) / 5) * 0.5), top + h * 0.3, 3 + tw * 3, (tw - 0.82) * 5);
  }

  drawCracks(ctx, art, left, top);
  // Hit flash: the whole face blanches for a moment.
  if (hitAge < 110) {
    ctx.fillStyle = pal.flash;
    ctx.globalAlpha = 0.5 * (1 - hitAge / 110);
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Outline: bright edge and an inner line so the block reads against any floor.
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 1, top + 1, w - 2, h - 2);
  ctx.strokeStyle = pal.inner;
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 4, top + 4, w - 8, h - 8);

  // Impact ripple at the point that was hit.
  if (hitAge < 280 && art.lastHitX !== undefined && art.lastHitY !== undefined) {
    const px = clamp(art.lastHitX, left, left + w);
    const py = clamp(art.lastHitY - BLOCK_HEIGHT, top, top + h);
    const k = hitAge / 280;
    ctx.globalAlpha = 0.75 * (1 - k);
    ctx.strokeStyle = pal.flash;
    ctx.lineWidth = 2 - k;
    ctx.beginPath();
    ctx.ellipse(px, py, 4 + k * 24, (4 + k * 24) * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.22, y - r * 0.22);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.22, y + r * 0.22);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.22, y + r * 0.22);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.22, y - r * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The hit points to grow cracks from: the recorded ones, else the last hit, else a centred star. */
function crackOrigins(art: BlockArt): Array<[number, number]> {
  const { x: cx, y: cy, w, h } = art;
  const origins: Array<[number, number]> = [];
  const marks = art.marks ?? [];
  for (let i = 0; i + 1 < marks.length; i += 2) {
    origins.push([clamp((marks[i]! - cx) / w, -0.46, 0.46), clamp((marks[i + 1]! - cy) / h, -0.46, 0.46)]);
  }
  if (origins.length === 0 && art.damage > 0) {
    if (art.lastHitX !== undefined && art.lastHitY !== undefined) {
      origins.push([clamp((art.lastHitX - cx) / w, -0.46, 0.46), clamp((art.lastHitY - cy) / h, -0.46, 0.46)]);
    } else {
      origins.push([0, 0]);
    }
  }
  return origins;
}

function drawCracks(ctx: CanvasRenderingContext2D, art: BlockArt, left: number, top: number, forceFull = false) {
  const origins = crackOrigins(art);
  if (origins.length === 0) return;
  const { w, h, now, material } = art;
  const hitAge = art.lastHitAt === undefined ? Infinity : now - art.lastHitAt;
  const baseReveal = forceFull ? 1 : clamp(0.38 + art.damage * 0.85, 0, 1);
  const stepSize = 0.2;
  const segsByLayer: Array<Array<[number, number, number, number]>> = [[], [], []];
  const quality = art.quality;
  origins.forEach(([ox, oy], index) => {
    const newest = index === origins.length - 1;
    const reveal = newest && !forceFull ? Math.min(baseReveal, hitAge / CRACK_GROW_MS) : baseReveal;
    for (const seg of buildCrackNetwork(art.seed, material, ox, oy)) {
      if (quality === 'performance' && seg.layer === 2) continue;
      const p = clamp((reveal - (seg.order - stepSize)) / stepSize, 0, 1);
      if (p <= 0) continue;
      segsByLayer[seg.layer]!.push([
        left + (seg.x0 + 0.5) * w, top + (seg.y0 + 0.5) * h,
        left + (seg.x0 + (seg.x1 - seg.x0) * p + 0.5) * w, top + (seg.y0 + (seg.y1 - seg.y0) * p + 0.5) * h,
      ]);
    }
  });
  const stroke = (layers: number[], color: string, lw: number, dx = 0, dy = 0) => {
    ctx.beginPath();
    for (const layer of layers) for (const [x0, y0, x1, y1] of segsByLayer[layer]!) { ctx.moveTo(x0 + dx, y0 + dy); ctx.lineTo(x1 + dx, y1 + dy); }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Frost / bruising around each hit: whitening that deepens with damage.
  const bruise = clamp(art.damage * 0.5, 0, 0.45);
  if (bruise > 0.02) {
    for (const [ox, oy] of origins) {
      const gx = left + (ox + 0.5) * w;
      const gy = top + (oy + 0.5) * h;
      const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, Math.max(w, h) * 0.42);
      g.addColorStop(0, material === 'ice' ? `rgba(255,255,255,${bruise})` : `rgba(220,248,255,${bruise * 0.8})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(left, top, w, h);
    }
  }
  // 1. depth: a dark, offset copy so the cracks look cut into the surface.
  stroke([0, 1], 'rgba(4,16,30,0.55)', 2.6, 0.8, 1.1);
  // 2. glow, strongest right after a hit (and always a little on ice).
  const glow = Math.max(material === 'ice' ? 0.16 : 0.08, hitAge < 420 ? 0.5 * (1 - hitAge / 420) : 0);
  ctx.globalAlpha = glow;
  stroke([0, 1], '#9be7ff', 4);
  ctx.globalAlpha = 1;
  // 3. bright core, thinner for each finer layer.
  stroke([0], 'rgba(244,253,255,0.96)', 1.5);
  stroke([1], 'rgba(230,250,255,0.82)', 1.1);
  if (quality !== 'performance') stroke([2], 'rgba(230,250,255,0.55)', 0.7);
  // 4. dark fracture running down the middle of the main cracks.
  stroke([0], 'rgba(5,32,50,0.85)', 0.55, -0.3, -0.3);
  // Chips at each impact point.
  for (const [ox, oy] of origins) drawStar(ctx, left + (ox + 0.5) * w, top + (oy + 0.5) * h, 3.4 + art.damage * 3, 0.85);
  ctx.restore();
}

// --- Shatter ---------------------------------------------------------------------------------

function drawShatter(ctx: CanvasRenderingContext2D, art: BlockArt) {
  const { material, x: cx, y: cy, w, h, now, seed } = art;
  const brokenAt = art.brokenAt!;
  const t = now - brokenAt;
  if (t < 0 || t > BLOCK_FX_LINGER_MS) return;
  const pal = PALETTE[material];
  const topCx = cx;
  const topCy = cy - BLOCK_HEIGHT;
  const motion = art.motionEnabled;

  // Frame 1 (0-80 ms): the block is still there, every crack lit, flashing white.
  if (t < 80) {
    drawWhole(ctx, { ...art, brokenAt: undefined, damage: 1, lastHitAt: brokenAt });
    const full = { ...art, damage: 1 };
    ctx.save();
    drawCracks(ctx, full, cx - w / 2, topCy - h / 2, true);
    ctx.globalAlpha = 0.85 * (1 - t / 80);
    ctx.fillStyle = pal.flash;
    ctx.fillRect(cx - w / 2, topCy - h / 2, w, h);
    ctx.restore();
  }

  const originList = crackOrigins({ ...art, damage: 1 });
  const origin = originList[originList.length - 1] ?? [0, 0];
  const gx = art.quality === 'performance' ? 3 : art.quality === 'balanced' ? 4 : 5;
  const gy = art.quality === 'performance' ? 2 : art.quality === 'balanced' ? 3 : 4;
  const tris = shardTiling(seed, gx, gy);
  const s = Math.max(0, (t - 60) / 1000);
  const settle = clamp((t - 1500) / (BLOCK_FX_LINGER_MS - 1500), 0, 1);
  const alpha = 1 - settle;
  const shards = tris.length;

  // Soft floor shadows first, so the shards sit on top of them.
  if (s > 0) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.18 * alpha;
    for (let i = 0; i < shards; i += 2) {
      const tri = tris[i]!;
      const geo = shardMotion(seed, i, tri, origin, w, h, s, motion);
      ctx.beginPath();
      ctx.ellipse(topCx + geo.cx + geo.dx, cy + geo.cy + geo.dy, 5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (s > 0) {
    ctx.save();
    ctx.lineJoin = 'round';
    for (let i = 0; i < shards; i += 1) {
      const tri = tris[i]!;
      const geo = shardMotion(seed, i, tri, origin, w, h, s, motion);
      ctx.save();
      ctx.translate(topCx + geo.cx + geo.dx, topCy + geo.cy + geo.dy - geo.z);
      ctx.rotate(geo.rot);
      const lx = (tri[0] - geo.ncx) * w;
      const ly = (tri[1] - geo.ncy) * h;
      const pts: Array<[number, number]> = [
        [lx, ly],
        [(tri[2] - geo.ncx) * w, (tri[3] - geo.ncy) * h],
        [(tri[4] - geo.ncx) * w, (tri[5] - geo.ncy) * h],
      ];
      ctx.globalAlpha = alpha;
      // Thickness: a darker copy dropped slightly below the shard.
      ctx.save();
      ctx.translate(0, 2.5);
      tracePoly(ctx, pts);
      ctx.fillStyle = material === 'glass' ? 'rgba(14,70,94,0.75)' : 'rgba(70,134,186,0.9)';
      ctx.fill();
      ctx.restore();
      tracePoly(ctx, pts);
      ctx.fillStyle = pal.shard[(seed + i) % pal.shard.length]!;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // One bright facet along the longest-lit edge.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(pts[0]![0] * 0.55 + pts[1]![0] * 0.45, pts[0]![1] * 0.55 + pts[1]![1] * 0.45);
      ctx.lineTo(pts[2]![0] * 0.6, pts[2]![1] * 0.6);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Shock ring from the impact point (two rings, the second a beat behind).
  const ox = topCx + origin[0] * w;
  const oy = topCy + origin[1] * h;
  for (let ring = 0; ring < 2; ring += 1) {
    const rt = t - ring * 70;
    if (rt < 0 || rt > 320) continue;
    const k = rt / 320;
    ctx.save();
    ctx.globalAlpha = (ring ? 0.5 : 0.85) * (1 - k);
    ctx.strokeStyle = ring ? pal.ring : '#ffffff';
    ctx.lineWidth = 3.2 * (1 - k) + 0.6;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 6 + k * Math.max(w, h) * 0.85, (6 + k * Math.max(w, h) * 0.85) * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Glints: bright stars that flicker on shards while they fly.
  if (art.quality !== 'performance' && s > 0 && t < 1500) {
    const r = rngFrom(hash32(seed, 91));
    for (let i = 0; i < 6; i += 1) {
      const idx = Math.floor(r() * shards);
      const geo = shardMotion(seed, idx, tris[idx]!, origin, w, h, s, motion);
      const tw = Math.pow((Math.sin(t / 46 + i * 2.1) + 1) / 2, 2);
      drawStar(ctx, topCx + geo.cx + geo.dx, topCy + geo.cy + geo.dy - geo.z, 3 + tw * 4, tw * (1 - t / 1500));
    }
  }

  if (material === 'ice') {
    // Frost mist rolling out of the break, and snow motes drifting up.
    for (let i = 0; i < 4; i += 1) {
      const mt = t - i * 45;
      if (mt < 0 || mt > 1000) continue;
      const k = mt / 1000;
      const r = rngFrom(hash32(seed, 200 + i));
      const mx = topCx + (r() - 0.5) * w * 0.7;
      const my = topCy + (r() - 0.5) * h * 0.5 - k * 12;
      const radius = (0.35 + k * 0.7) * Math.max(w, h) * 0.7;
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, radius);
      g.addColorStop(0, `rgba(225,246,255,${0.4 * (1 - k)})`);
      g.addColorStop(1, 'rgba(225,246,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (art.quality !== 'performance' && motion) {
      const r = rngFrom(hash32(seed, 300));
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i += 1) {
        const k = clamp((t - 80 - i * 25) / 900, 0, 1);
        if (k <= 0 || k >= 1) { r(); r(); continue; }
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.fillRect(topCx + (r() - 0.5) * w * 1.2 + Math.sin(i + t / 220) * 5, topCy + (r() - 0.5) * h - k * 34, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
  } else if (t < 520 && art.quality !== 'performance') {
    // Glass dust: tiny bright flecks thrown out of the break.
    const r = rngFrom(hash32(seed, 400));
    ctx.fillStyle = '#e8fbff';
    for (let i = 0; i < 14; i += 1) {
      const a = r() * Math.PI * 2;
      const sp = 24 + r() * 52;
      const k = t / 520;
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.fillRect(ox + Math.cos(a) * sp * k * 1.4, oy + Math.sin(a) * sp * k * 0.9 - k * 8, 1.7, 1.7);
    }
    ctx.globalAlpha = 1;
  }
}

/** Where a shard is `s` seconds after the break. All motion is analytic, so draws can happen in any order. */
function shardMotion(
  seed: number, index: number, tri: ShardTriangle, origin: [number, number], w: number, h: number, s: number, motion: boolean,
): { cx: number; cy: number; ncx: number; ncy: number; dx: number; dy: number; z: number; rot: number } {
  const ncx = (tri[0] + tri[2] + tri[4]) / 3;
  const ncy = (tri[1] + tri[3] + tri[5]) / 3;
  const r = rngFrom(hash32(seed, index, 77));
  let vx = (ncx - origin[0]) * w;
  let vy = (ncy - origin[1]) * h;
  const dist = Math.hypot(vx, vy) || 1;
  vx /= dist;
  vy /= dist;
  // Shards nearest the impact are thrown hardest.
  const speed = (motion ? 1 : 0.35) * (40 + r() * r() * 230 + r() * 60) * (1.15 - Math.min(0.5, dist / Math.max(w, h)));
  const travel = speed * (1 - Math.exp(-s * 3.4)) / 3.4;
  const vz = 160 + r() * 150;
  const gravity = 560;
  const landed = (2 * vz) / gravity;
  const sc = Math.min(s, landed);
  const z = motion ? Math.max(0, vz * sc - 0.5 * gravity * sc * sc) : 0;
  const spin = (r() - 0.5) * 14 * (motion ? 1 : 0.2);
  return {
    cx: ncx * w, cy: ncy * h, ncx, ncy,
    dx: vx * travel, dy: vy * travel * 0.8, z, rot: spin * Math.min(s, landed + 0.15),
  };
}

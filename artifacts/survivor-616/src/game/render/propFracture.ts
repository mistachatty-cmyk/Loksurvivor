import { PropTextureCache } from './propTextureCache';
import { buildCrackNetwork, shardTiling } from './blockBreak';
import { propNoise, type PropDamageVisual, type PropMaterial } from './breakableFx';

export const PROP_FRACTURE_LINGER_MS = 2200;
type Quality = 'performance' | 'balanced' | 'high';
export interface FracturedProp extends PropDamageVisual {
  cacheKey: string;
  quality: Quality;
  marks?: readonly number[];
  /** Extra room for tall silhouettes and the side faces of raised props. */
  padding?: number;
}
type Point = readonly [number, number];
export interface PropPiece { points: Point[]; cx: number; cy: number }

const pieceCache = new Map<string, PropPiece[]>();

/** Wood separates along boards, metal along panels; brittle material uses the ice/glass tiling. */
export function propPieces(seed: number, material: PropMaterial, quality: Quality): PropPiece[] {
  const key = `${seed}:${material}:${quality}`;
  const cached = pieceCache.get(key);
  if (cached) return cached;
  const cols = quality === 'performance' ? 2 : quality === 'balanced' ? 3 : 4;
  const rows = material === 'wood' ? (quality === 'performance' ? 3 : 5) : quality === 'high' ? 3 : 2;
  const polygons: Point[][] = material === 'wood' || material === 'metal'
    ? Array.from({ length: cols * rows }, (_, i) => {
      const x = (i % cols) / cols - 0.5, y = Math.floor(i / cols) / rows - 0.5;
      return [[x, y], [x + 1 / cols, y], [x + 1 / cols, y + 1 / rows], [x, y + 1 / rows]];
    })
    : shardTiling(seed, cols, rows).map(t => [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]]]);
  const pieces = polygons.map(points => ({ points, cx: points.reduce((v, p) => v + p[0], 0) / points.length, cy: points.reduce((v, p) => v + p[1], 0) / points.length }));
  if (pieceCache.size >= 96) pieceCache.delete(pieceCache.keys().next().value!);
  pieceCache.set(key, pieces);
  return pieces;
}

const textures = new PropTextureCache<HTMLCanvasElement | undefined>();
function textureFor(art: FracturedProp, paint: (ctx: CanvasRenderingContext2D, snapshot?: boolean) => void, padding: number) {
  if (typeof document === 'undefined') return undefined;
  const key = `${art.cacheKey}:${art.seed}:${art.w}:${art.h}:${padding}:${art.material}:${art.quality}:${art.brokenAt ?? 'damage'}`;
  return textures.getOrCreate(key, art.now, () => {
    const canvas = document.createElement('canvas');
    const width = art.w + padding * 2, height = art.h + padding * 2;
    const resolution = Math.min(1.5, 192 / Math.max(width, height));
    canvas.width = Math.max(1, Math.ceil(width * resolution)); canvas.height = Math.max(1, Math.ceil(height * resolution));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.scale(canvas.width / width, canvas.height / height);
    ctx.translate(width / 2 - art.x, height / 2 - art.y);
    paint(ctx, true);
    // The fractures travel with the painted pieces instead of disappearing at the break.
    if (art.brokenAt !== undefined) drawNetwork(ctx, { ...art, damageRatio: 1, motionEnabled: false });
    return canvas;
  });
}

const EDGE: Record<PropMaterial, string> = { wood: '#e8b67b', stone: '#cbd5e1', metal: '#a5bbc9', glass: '#d5faff', organic: '#88b896' };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function path(ctx: CanvasRenderingContext2D, piece: PropPiece, w: number, h: number) {
  ctx.beginPath();
  piece.points.forEach(([x, y], i) => i ? ctx.lineTo((x - piece.cx) * w, (y - piece.cy) * h) : ctx.moveTo((x - piece.cx) * w, (y - piece.cy) * h));
  ctx.closePath();
}

/** Draw the original artwork as connected pieces, then split, lift, tumble and settle those same pieces. */
export function drawFracturedProp(ctx: CanvasRenderingContext2D, art: FracturedProp, paint: (ctx: CanvasRenderingContext2D, snapshot?: boolean) => void) {
  const broken = art.brokenAt !== undefined;
  const age = broken ? Math.max(0, art.now - art.brokenAt!) : 0;
  if (broken && age >= PROP_FRACTURE_LINGER_MS) return;
  const motion = art.motionEnabled !== false;
  const damage = clamp(art.damageRatio);
  const separated = broken || damage >= 0.43;
  const padding = art.padding ?? 18;
  const width = art.w + padding * 2, height = art.h + padding * 2;
  const texture = separated ? textureFor(art, paint, padding) : undefined;
  ctx.save();
  if (texture && !broken) {
    // A damaged object keeps one grounded footprint; it is never cut into the artwork.
    ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.24;
    ctx.beginPath(); ctx.ellipse(art.x + 4, art.y + art.h * 0.5 + 10, art.w * 0.44, Math.max(3, art.h * 0.1), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const hitAge = art.lastHitAt === undefined ? Infinity : art.now - art.lastHitAt;
  if (!broken && motion && hitAge >= 0 && hitAge < 140) {
    const recoil = 1 - hitAge / 140;
    ctx.translate(Math.sin(hitAge * 0.12) * recoil * 2.2, Math.cos(hitAge * 0.1) * recoil * 0.8);
  }
  if (!texture) paint(ctx);
  else {
    const pieces = propPieces(art.seed, art.material, art.quality);
    const seconds = Math.max(0, age - 45) / 1000;
    const travel = motion ? 1 - Math.exp(-seconds * 3.6) : 0.8;
    const collapse = broken ? travel : Math.max(0, damage - 0.43) * 0.045;
    const alpha = broken ? 1 - clamp((age - 1450) / 750) : 1;
    const hitX = art.lastHitX ?? art.x, hitY = art.lastHitY ?? art.y;
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i]!;
      const rnd = propNoise(art.seed ^ Math.imul(i + 1, 0x45d9f3b));
      const dx = piece.cx * width, dy = piece.cy * height;
      const angle = Math.atan2(art.y + dy - hitY, art.x + dx - hitX);
      const spread = collapse * Math.min(width, height) * (0.2 + rnd * 0.55);
      const lift = broken && motion ? Math.sin(clamp(seconds / (0.55 + rnd * 0.45)) * Math.PI) * art.h * (0.22 + rnd * 0.55) : 0;
      const sink = broken ? collapse * art.h * (art.material === 'metal' ? 0.38 : 0.24) : 0;
      const px = art.x + dx + Math.cos(angle) * spread;
      const py = art.y + dy + Math.sin(angle) * spread * 0.45 + sink;
      if (broken) {
        ctx.globalAlpha = alpha * 0.18; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(px, py + 14, Math.max(2, width / 14), 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py - lift);
      const turn = (rnd - 0.5) * (art.material === 'metal' ? 0.9 : 2.6);
      ctx.rotate(broken ? turn * travel : turn * collapse);
      if (broken) ctx.scale(1, 1 - (motion ? clamp((age - 600) / 650) : 1) * (art.material === 'metal' ? 0.45 : 0.3));
      // The dropped side face gives fragments thickness rather than a flat confetti look.
      ctx.save(); ctx.translate(0, broken ? 2.5 : 1); path(ctx, piece, width, height); ctx.clip(); ctx.drawImage(texture, -width / 2 - dx, -height / 2 - dy, width, height); ctx.restore();
      ctx.save(); path(ctx, piece, width, height); ctx.clip();
      ctx.drawImage(texture, -width / 2 - dx, -height / 2 - dy, width, height);
      ctx.restore();
      // Keep empty margins transparent: no synthetic square outlines around the silhouette.
      ctx.restore();
    }
  }
  if (!broken) drawNetwork(ctx, art);
  if (broken && motion && age < 520 && art.material !== 'glass') {
    ctx.fillStyle = EDGE[art.material];
    for (let i = 0; i < (art.quality === 'performance' ? 2 : 5); i += 1) {
      const t = age / 520;
      ctx.globalAlpha = (1 - t) * 0.09;
      ctx.beginPath(); ctx.ellipse(art.x + (i - 2) * art.w * t * 0.18, art.y + art.h * 0.3 - t * 10, Math.max(1, art.w * (0.04 + t * 0.14)), Math.max(1, art.h * (0.03 + t * 0.06)), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawNetwork(ctx: CanvasRenderingContext2D, art: FracturedProp) {
  if (art.damageRatio <= 0) return;
  const origins: Point[] = [];
  const marks = art.marks ?? [];
  for (let i = Math.max(0, marks.length - 6); i + 1 < marks.length; i += 2) origins.push([clamp((marks[i]! - art.x) / art.w, -0.46, 0.46), clamp((marks[i + 1]! - art.y) / art.h, -0.46, 0.46)]);
  if (!origins.length) origins.push([clamp(((art.lastHitX ?? art.x) - art.x) / art.w, -0.46, 0.46), clamp(((art.lastHitY ?? art.y) - art.y) / art.h, -0.46, 0.46)]);
  const age = art.lastHitAt === undefined ? Infinity : Math.max(0, art.now - art.lastHitAt);
  ctx.save();
  ctx.beginPath(); ctx.rect(art.x - art.w / 2, art.y - art.h / 2, art.w, art.h); ctx.clip();
  const passes = [{ color: '#030810b0', width: 3.2, offset: 0.8 }, { color: EDGE[art.material], width: 1.2, offset: -0.6 }, { color: '#0b111ee6', width: 0.65, offset: 0 }];
  for (const pass of passes) {
    ctx.beginPath();
    origins.forEach(([ox, oy], i) => {
      const reveal = Math.min(0.25 + art.damageRatio * 0.8, art.motionEnabled === false || i < origins.length - 1 ? 1 : age / 170);
      for (const seg of buildCrackNetwork(art.seed, art.material === 'glass' ? 'glass' : 'ice', ox, oy)) {
        if (art.quality === 'performance' && seg.layer === 2) continue;
        const p = clamp((reveal - seg.order + 0.18) / 0.18);
        if (!p) continue;
        ctx.moveTo(art.x + seg.x0 * art.w + pass.offset, art.y + seg.y0 * art.h + pass.offset);
        ctx.lineTo(art.x + (seg.x0 + (seg.x1 - seg.x0) * p) * art.w + pass.offset, art.y + (seg.y0 + (seg.y1 - seg.y0) * p) * art.h + pass.offset);
      }
    });
    ctx.strokeStyle = pass.color; ctx.lineWidth = pass.width; ctx.stroke();
  }
  ctx.restore();
}

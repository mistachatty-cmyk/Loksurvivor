/**
 * Draws a sprite rig to a 2D canvas, one pixel rectangle at a time.
 *
 * Frames are selected from the rig's animation clips by elapsed time, so
 * every actor animates frame-by-frame rather than being tweened.
 */

import type { AnimName, FrameDelta, SpritePalette, SpriteRig } from '@/game/types';

export interface DrawRigOptions {
  /** Flash the whole silhouette white (hit reaction). */
  flash?: boolean;
  /** 0..1 -- eats away pixels for the depixelating death sequence. */
  dissolve?: number;
  /** Draw a dark 1px outline behind every part. */
  outline?: boolean;
  /** Global alpha applied to the sprite. */
  alpha?: number;
  /** Extra tint drawn over the sprite at this alpha. */
  tint?: { color: string; alpha: number };
}

function frameIndex(rig: SpriteRig, anim: AnimName, elapsedMs: number): number {
  const clip = rig.anims[anim];
  const count = clip.frames.length;
  if (count === 0) return 0;
  const raw = Math.floor(elapsedMs / clip.frameMs);
  if (clip.loop === false) {
    return Math.min(raw, count - 1);
  }
  return ((raw % count) + count) % count;
}

/** Cheap deterministic hash so the dissolve pattern is stable per cell. */
function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawPartsSlow(
  ctx: CanvasRenderingContext2D,
  rig: SpriteRig,
  palette: SpritePalette,
  delta: FrameDelta,
  screenX: number,
  screenY: number,
  facing: 1 | -1,
  scale: number,
  flash: boolean,
  dissolve: number,
  outline: boolean,
  tint: DrawRigOptions['tint'],
) {
  const parts = rig.parts;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const d = delta[part.key];
    const px = part.x + (d?.dx ?? 0) * (facing === 1 ? 1 : -1);
    const py = part.y + (d?.dy ?? 0);
    const pw = Math.max(1, part.w + (d?.dw ?? 0));
    const ph = Math.max(1, part.h + (d?.dh ?? 0));

    // Sprite space: origin at the feet, +y up. Flip horizontally on facing.
    const left = facing === 1 ? px : -px - pw;
    const x = Math.round(screenX + left * scale);
    const y = Math.round(screenY - (py + ph) * scale);
    const w = Math.max(1, Math.round(pw * scale));
    const h = Math.max(1, Math.round(ph * scale));

    if (dissolve > 0) {
      // Break the rectangle into cells and drop them as the sequence runs.
      const cell = Math.max(2, Math.round(scale));
      for (let cy = 0; cy < h; cy += cell) {
        for (let cx = 0; cx < w; cx += cell) {
          if (hash2(x + cx, y + cy) < dissolve) continue;
          ctx.fillStyle = flash ? '#ffffff' : palette[part.color];
          ctx.fillRect(x + cx, y + cy, Math.min(cell, w - cx), Math.min(cell, h - cy));
        }
      }
      continue;
    }

    if (outline) {
      ctx.fillStyle = palette.ink;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    }
    ctx.fillStyle = flash ? '#ffffff' : palette[part.color];
    ctx.fillRect(x, y, w, h);

    if (tint) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * tint.alpha;
      ctx.fillStyle = tint.color;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = prev;
    }
  }
}

/**
 * Baking a rig's parts to an offscreen canvas once per (rig, palette, anim,
 * frame, outline, flash) combination and blitting it with `drawImage`
 * replaces per-part `fillRect` calls with one blit -- the same trick this
 * file's `paintSoftCloud`/`softBlob` neighbor in draw.ts already uses for
 * gradients. A swarm of visible rig-drawing enemies was previously N actors
 * times ~8-12 fillRect calls every frame; the closed set of (anim, frame)
 * combinations per enemy type is what makes caching safe here, since a rig
 * is shared data (one object per enemy/character definition), not per-instance.
 *
 * Deliberately NOT cached: `dissolve` (continuously varies per death frame)
 * and `tint` (a translucent recolor overlay whose color/alpha varies by
 * status effect) fall back to `drawPartsSlow` above, unchanged. Both are
 * transient/rare relative to the steady walk/attack/idle case this exists for.
 */
const BAKE_SCALE = 4;

interface BakedFrame {
  canvas: HTMLCanvasElement;
  /** Where local (0,0) -- the sprite's screenX/screenY anchor -- lands in the canvas, in canvas pixels. */
  originX: number;
  originY: number;
}

const rigCache = new WeakMap<SpriteRig, WeakMap<SpritePalette, Map<string, BakedFrame | null>>>();

function bakeFrame(
  rig: SpriteRig,
  palette: SpritePalette,
  delta: FrameDelta,
  outline: boolean,
  flash: boolean,
): BakedFrame | null {
  if (typeof document === 'undefined') return null;

  const parts = rig.parts;
  // Facing=1 canonical bake; facing=-1 is a horizontal mirror at blit time
  // (mirroring the whole canvas around the origin column reproduces the
  // `-px - pw` formula `drawPartsSlow` uses for a flipped left edge).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rects: Array<{ x: number; y: number; w: number; h: number; color: keyof SpritePalette }> = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const d = delta[part.key];
    const px = part.x + (d?.dx ?? 0);
    const py = part.y + (d?.dy ?? 0);
    const pw = Math.max(1, part.w + (d?.dw ?? 0));
    const ph = Math.max(1, part.h + (d?.dh ?? 0));
    const x = px * BAKE_SCALE;
    const y = -(py + ph) * BAKE_SCALE;
    const w = Math.max(1, Math.round(pw * BAKE_SCALE));
    const h = Math.max(1, Math.round(ph * BAKE_SCALE));
    const pad = outline ? 1 : 0;
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    maxX = Math.max(maxX, x + w + pad);
    maxY = Math.max(maxY, y + h + pad);
    rects.push({ x: Math.round(x), y: Math.round(y), w, h, color: part.color });
  }
  if (rects.length === 0 || !Number.isFinite(minX)) return null;

  const originX = Math.round(-minX);
  const originY = Math.round(-minY);
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const bctx = canvas.getContext('2d');
  if (!bctx) return null;

  for (const r of rects) {
    const x = r.x + originX;
    const y = r.y + originY;
    if (outline) {
      bctx.fillStyle = palette.ink;
      bctx.fillRect(x - 1, y - 1, r.w + 2, r.h + 2);
    }
    bctx.fillStyle = flash ? '#ffffff' : palette[r.color];
    bctx.fillRect(x, y, r.w, r.h);
  }

  return { canvas, originX, originY };
}

function getBakedFrame(
  rig: SpriteRig,
  palette: SpritePalette,
  anim: AnimName,
  index: number,
  delta: FrameDelta,
  outline: boolean,
  flash: boolean,
): BakedFrame | null {
  let byPalette = rigCache.get(rig);
  if (!byPalette) {
    byPalette = new WeakMap();
    rigCache.set(rig, byPalette);
  }
  let byKey = byPalette.get(palette);
  if (!byKey) {
    byKey = new Map();
    byPalette.set(palette, byKey);
  }
  const key = `${anim}|${index}|${outline ? 1 : 0}|${flash ? 1 : 0}`;
  if (byKey.has(key)) return byKey.get(key)!;
  const baked = bakeFrame(rig, palette, delta, outline, flash);
  // Cap so a pathological caller (rig data authored with per-instance-unique
  // objects instead of shared definitions) can't grow this without bound.
  if (byKey.size < 512) byKey.set(key, baked);
  return baked;
}

export function drawRig(
  ctx: CanvasRenderingContext2D,
  rig: SpriteRig,
  palette: SpritePalette,
  anim: AnimName,
  elapsedMs: number,
  screenX: number,
  screenY: number,
  facing: 1 | -1,
  scale: number,
  options: DrawRigOptions = {},
) {
  const { flash = false, dissolve = 0, outline = false, alpha = 1, tint } = options;
  const clip = rig.anims[anim];
  const index = frameIndex(rig, anim, elapsedMs);
  const delta: FrameDelta = clip.frames[index] ?? {};

  const previousAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = previousAlpha * alpha;

  if (dissolve > 0 || tint) {
    drawPartsSlow(ctx, rig, palette, delta, screenX, screenY, facing, scale, flash, dissolve, outline, tint);
    ctx.globalAlpha = previousAlpha;
    return;
  }

  const baked = getBakedFrame(rig, palette, anim, index, delta, outline, flash);
  if (!baked) {
    // No `document` (e.g. a non-browser test importing this module) -- the
    // per-part path works anywhere a CanvasRenderingContext2D exists.
    drawPartsSlow(ctx, rig, palette, delta, screenX, screenY, facing, scale, flash, dissolve, outline, tint);
    ctx.globalAlpha = previousAlpha;
    return;
  }

  const k = scale / BAKE_SCALE;
  ctx.save();
  ctx.translate(screenX, screenY);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.drawImage(baked.canvas, -baked.originX * k, -baked.originY * k, baked.canvas.width * k, baked.canvas.height * k);
  ctx.restore();

  ctx.globalAlpha = previousAlpha;
}

/** Soft contact shadow drawn under an actor. */
const SHADOW_BAKE_SIZE = 64;
let shadowBlob: HTMLCanvasElement | null | undefined;

function getShadowBlob(): HTMLCanvasElement | null {
  if (shadowBlob !== undefined) return shadowBlob;
  if (typeof document === 'undefined') {
    shadowBlob = null;
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SHADOW_BAKE_SIZE;
  canvas.height = SHADOW_BAKE_SIZE;
  const bctx = canvas.getContext('2d');
  if (!bctx) {
    shadowBlob = null;
    return null;
  }
  const r = SHADOW_BAKE_SIZE / 2;
  const gradient = bctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = gradient;
  bctx.beginPath();
  bctx.arc(r, r, r, 0, Math.PI * 2);
  bctx.fill();
  shadowBlob = canvas;
  return canvas;
}

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
) {
  const blob = getShadowBlob();
  if (!blob) return;
  // The non-uniform vertical scale gives the ellipse shape for free, same
  // trick as `paintSoftCloud`'s soft blobs in draw.ts.
  ctx.drawImage(
    blob,
    screenX - radius,
    screenY - radius * 0.42,
    radius * 2,
    radius * 0.42 * 2,
  );
}

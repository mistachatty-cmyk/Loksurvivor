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
  const delta: FrameDelta = clip.frames[frameIndex(rig, anim, elapsedMs)] ?? {};

  const previousAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = previousAlpha * alpha;

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

  ctx.globalAlpha = previousAlpha;
}

/**
 * Every actor -- up to MAX_ENEMIES of them -- draws one of these every
 * frame. A fresh createRadialGradient() + ellipse fill per call is the same
 * cost class the cloud rendering hit (see softBlob() in draw.ts, ~22ms/frame
 * at scale): rasterise the gradient once and reuse it. The blob is a plain
 * circle; drawImage's non-uniform destination scale (radius x, radius*0.42
 * y) stretches it into the same ellipse the old per-call gradient produced.
 */
const SHADOW_BLOB_SIZE = 64;
let shadowBlobCache: HTMLCanvasElement | null = null;

function shadowBlob(): HTMLCanvasElement | null {
  if (shadowBlobCache) return shadowBlobCache;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SHADOW_BLOB_SIZE;
  canvas.height = SHADOW_BLOB_SIZE;
  const blobCtx = canvas.getContext('2d');
  if (!blobCtx) return null;
  const r = SHADOW_BLOB_SIZE / 2;
  const gradient = blobCtx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  blobCtx.fillStyle = gradient;
  blobCtx.fillRect(0, 0, SHADOW_BLOB_SIZE, SHADOW_BLOB_SIZE);
  shadowBlobCache = canvas;
  return canvas;
}

/** Soft contact shadow drawn under an actor. */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
) {
  const blob = shadowBlob();
  if (!blob) return;
  ctx.drawImage(blob, screenX - radius, screenY - radius * 0.42, radius * 2, radius * 0.84);
}

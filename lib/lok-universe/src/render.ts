// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
import { RARITY_COLORS, type CardArtRecipe, type RegistryRarity } from "./types";

/**
 * Framework-free canvas renderer for card art recipes, so a platform can draw
 * ANY world's cards with no engine of its own (plain <canvas>, React, Next,
 * whatever). Static frame only; a platform with a real animation engine for a
 * recipe kind (616's rig renderer) may draw it better and should.
 * Returns false when the recipe kind is unknown -- caller draws its fallback.
 */

type Ctx = CanvasRenderingContext2D;
interface RigPart { key: string; x: number; y: number; w: number; h: number; color: string; z?: number }
interface RigLike { parts: RigPart[]; anims?: { idle?: { frames?: Array<Record<string, { dx?: number; dy?: number; dw?: number; dh?: number }>> } } }

export interface DrawOptions {
  /** Draw the model as a flat silhouette in this colour (locked cards). */
  silhouette?: string;
}

function makeScratch(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: Ctx } | null {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width: w, height: h }) : null;
  const ctx = canvas?.getContext("2d") as Ctx | null | undefined;
  return canvas && ctx ? { canvas, ctx } : null;
}

function paintPixelGrid(ctx: Ctx, art: Extract<CardArtRecipe, { kind: "pixel-grid" }>, size: number) {
  const rows = art.grid.length;
  const cols = Math.max(...art.grid.map((row) => row.length));
  const cell = Math.floor(size / Math.max(rows, cols)) || 1;
  const ox = Math.floor((size - cols * cell) / 2);
  const oy = Math.floor((size - rows * cell) / 2);
  art.grid.forEach((row, y) => [...row].forEach((key, x) => {
    const color = key === "0" ? undefined : art.palette[key];
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
  }));
}

function paintRig(ctx: Ctx, art: Extract<CardArtRecipe, { kind: "sprite-rig" }>, size: number) {
  const rig = art.rig as RigLike;
  const delta = rig.anims?.idle?.frames?.[0] ?? {};
  const parts = rig.parts.filter((p) => p.key !== "shadow" && p.key !== "aura").map((p) => {
    const d = delta[p.key];
    return { ...p, x: p.x + (d?.dx ?? 0), y: p.y + (d?.dy ?? 0), w: Math.max(1, p.w + (d?.dw ?? 0)), h: Math.max(1, p.h + (d?.dh ?? 0)) };
  });
  if (!parts.length) return;
  const minX = Math.min(...parts.map((p) => p.x)), maxX = Math.max(...parts.map((p) => p.x + p.w));
  const minY = Math.min(...parts.map((p) => p.y)), maxY = Math.max(...parts.map((p) => p.y + p.h));
  const scale = Math.floor(Math.min(size / (maxX - minX), size / (maxY - minY))) || 1;
  const ox = Math.round((size - (maxX - minX) * scale) / 2 - minX * scale);
  const oy = Math.round((size + (maxY - minY) * scale) / 2 + minY * scale);
  for (const p of [...parts].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
    ctx.fillStyle = art.palette[p.color] ?? "#888";
    ctx.fillRect(ox + p.x * scale, oy - (p.y + p.h) * scale, p.w * scale, p.h * scale);
  }
}

/** Best-effort: a glowing blob in the card's own palette. Platforms with the real silhouette art should draw that instead. */
function paintSilhouetteBlob(ctx: Ctx, art: Extract<CardArtRecipe, { kind: "lokpet-silhouette" }>, size: number) {
  const body = art.palette.body ?? "#666", accent = art.palette.accent ?? "#aaa", eye = art.palette.eye ?? "#fff";
  const r = size * 0.32;
  ctx.fillStyle = art.palette.bodyDark ?? body;
  ctx.beginPath(); ctx.ellipse(size / 2, size * 0.58, r * 1.05, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(size / 2, size * 0.54, r, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(size * 0.3, size * 0.3, size * 0.1, size * 0.08); ctx.fillRect(size * 0.6, size * 0.3, size * 0.1, size * 0.08);
  ctx.fillStyle = eye;
  ctx.fillRect(size * 0.4, size * 0.5, size * 0.06, size * 0.08); ctx.fillRect(size * 0.54, size * 0.5, size * 0.06, size * 0.08);
}

/** Draw `art` into the square at (x, y) of side `size`. */
export function drawCardArt(ctx: Ctx, art: CardArtRecipe | null, x: number, y: number, size: number, opts: DrawOptions = {}): boolean {
  if (!art || (art.kind !== "pixel-grid" && art.kind !== "sprite-rig" && art.kind !== "lokpet-silhouette")) return false;
  const scratch = makeScratch(size, size);
  if (!scratch) return false;
  ctx.imageSmoothingEnabled = false;
  scratch.ctx.imageSmoothingEnabled = false;
  if (art.kind === "pixel-grid") paintPixelGrid(scratch.ctx, art, size);
  else if (art.kind === "sprite-rig") paintRig(scratch.ctx, art, size);
  else paintSilhouetteBlob(scratch.ctx, art, size);
  if (opts.silhouette) {
    scratch.ctx.globalCompositeOperation = "source-in";
    scratch.ctx.fillStyle = opts.silhouette;
    scratch.ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(scratch.canvas as CanvasImageSource, x, y);
  return true;
}

export const rarityColor = (rarity: RegistryRarity) => RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

import { LOK_GLYPH_PATHS, type LokGlyphKey } from './lokGlyphs.generated';

const cache = new Map<LokGlyphKey, Path2D>();

/** Draws a Lok Facet glyph centered on (x, y) using the context's current fillStyle. */
export function drawGlyph(ctx: CanvasRenderingContext2D, key: LokGlyphKey, x: number, y: number, size: number, outline?: { color: string; width: number }): void {
  let p = cache.get(key);
  if (!p) { p = new Path2D(LOK_GLYPH_PATHS[key]); cache.set(key, p); }
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  if (outline) { ctx.strokeStyle = outline.color; ctx.lineJoin = 'miter'; ctx.lineWidth = outline.width * (24 / size); ctx.stroke(p); }
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

/**
 * Pixel-art clean-up for the actor layer. The engine draws rotated vector projectiles and weapons with
 * anti-aliasing, which at low resolution reads as blurry smears among crisp rig pixels. This pass snaps every
 * pixel to fully opaque or fully transparent, and can add a one-cell dark outline so shapes keep their
 * silhouette over any page. Pure over `Uint32Array` (little-endian ABGR, as `ImageData` exposes it).
 */

const ALPHA_SHIFT = 24;

/**
 * Binarise alpha in place: below `threshold` becomes fully transparent, the rest fully opaque (colour kept).
 * Returns how many pixels ended up opaque.
 */
export function binariseAlpha(px: Uint32Array, threshold = 128): number {
  let opaque = 0;
  for (let i = 0; i < px.length; i += 1) {
    const v = px[i]!;
    if (v >>> ALPHA_SHIFT >= threshold) {
      px[i] = (v | 0xff000000) >>> 0;
      opaque += 1;
    } else {
      px[i] = 0;
    }
  }
  return opaque;
}

/** Fill every transparent pixel that touches an opaque one (4-neighbour) with `colour`. Reads from a copy so outlines do not chain. */
export function addOutline(px: Uint32Array, w: number, h: number, colour: number): number {
  const src = px.slice();
  let added = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (src[i]! >>> ALPHA_SHIFT !== 0) continue;
      const touch =
        (x > 0 && src[i - 1]! >>> ALPHA_SHIFT !== 0) ||
        (x < w - 1 && src[i + 1]! >>> ALPHA_SHIFT !== 0) ||
        (y > 0 && src[i - w]! >>> ALPHA_SHIFT !== 0) ||
        (y < h - 1 && src[i + w]! >>> ALPHA_SHIFT !== 0);
      if (touch) {
        px[i] = colour;
        added += 1;
      }
    }
  }
  return added;
}

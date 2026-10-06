/**
 * The hole field behind the reveal layer. Destroyed parts of a page are recorded here, in CELLS (the overlay's
 * low-res pixels, `CELL_CSS` css px each), and the renderer shows the game's own ground through them.
 *
 * Pure data, no canvas, so it is unit-tested under node. Cells are stored in lazily allocated bands of
 * `BAND_ROWS` rows (a 30,000 px page is 10,000 rows; most of it is never touched, and untouched bands cost
 * nothing). One byte per cell: bit 0 = hole, bits 1-2 = scorch level (soot on the intact page beside a crater).
 *
 * The page itself is never modified: the reveal is painted OVER it, opaque, so "restore" is just removing the
 * overlay. Hole edges are rounded outward to whole cells so no sliver of the old content peeks past the rim.
 */

export const BAND_ROWS = 256;
const HOLE = 1;
const SCORCH_SHIFT = 1;
const SCORCH_MASK = 3 << SCORCH_SHIFT;

/** Smallest rectangle of cells touched by an edit, so a renderer can re-upload only what changed. */
export interface CellBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type EdgeKind = 0 | 1 | 2;
/** 1 = rim: an intact cell directly beside a hole. 2 = inner shade: a hole cell below/right of intact content. */
export const EDGE_NONE: EdgeKind = 0;
export const EDGE_RIM: EdgeKind = 1;
export const EDGE_SHADE: EdgeKind = 2;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class HoleField {
  readonly cols: number;
  readonly rows: number;
  private readonly bands = new Map<number, Uint8Array>();
  private holes = 0;
  /** Bumped on every edit; lets a renderer skip rebuilding when nothing changed. */
  version = 0;

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, Math.floor(cols));
    this.rows = Math.max(1, Math.floor(rows));
  }

  /** Number of hole cells. */
  get holeCount(): number {
    return this.holes;
  }

  get bandCount(): number {
    return this.bands.size;
  }

  private bandFor(row: number, create: boolean): Uint8Array | undefined {
    const index = Math.floor(row / BAND_ROWS);
    let band = this.bands.get(index);
    if (!band && create) {
      band = new Uint8Array(this.cols * BAND_ROWS);
      this.bands.set(index, band);
    }
    return band;
  }

  private read(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 0;
    const band = this.bandFor(cy, false);
    return band ? band[(cy % BAND_ROWS) * this.cols + cx]! : 0;
  }

  isHole(cx: number, cy: number): boolean {
    return (this.read(cx, cy) & HOLE) !== 0;
  }

  /** 0..3: how much soot sits on this intact cell. */
  scorchLevel(cx: number, cy: number): number {
    return (this.read(cx, cy) & SCORCH_MASK) >> SCORCH_SHIFT;
  }

  private setHole(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    const band = this.bandFor(cy, true)!;
    const i = (cy % BAND_ROWS) * this.cols + cx;
    if (band[i]! & HOLE) return false;
    band[i] = (band[i]! & ~SCORCH_MASK) | HOLE; // a hole has no soot of its own
    this.holes += 1;
    return true;
  }

  /** Hole from a rectangle in (fractional) cells, rounded OUTWARD. Returns the changed cell box, or null if nothing changed. */
  addRect(x: number, y: number, w: number, h: number): CellBox | null {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.cols - 1, Math.ceil(x + w) - 1);
    const y1 = Math.min(this.rows - 1, Math.ceil(y + h) - 1);
    if (x1 < x0 || y1 < y0) return null;
    let changed = false;
    for (let cy = y0; cy <= y1; cy += 1) for (let cx = x0; cx <= x1; cx += 1) if (this.setHole(cx, cy)) changed = true;
    if (!changed) return null;
    this.version += 1;
    return { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
  }

  /** Round crater centred at (cx, cy) with radius r, all in (fractional) cells. A cell is in if its centre is within r + 0.5. */
  addCircle(cx: number, cy: number, r: number): CellBox | null {
    if (!(r > 0)) return null;
    const reach = r + 0.5;
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(this.rows - 1, Math.ceil(cy + reach));
    let box: CellBox | null = null;
    for (let y = y0; y <= y1; y += 1) {
      const dy = y + 0.5 - cy;
      const span2 = reach * reach - dy * dy;
      if (span2 < 0) continue;
      const half = Math.sqrt(span2);
      const xa = Math.max(0, Math.ceil(cx - half - 0.5));
      const xb = Math.min(this.cols - 1, Math.floor(cx + half - 0.5));
      for (let x = xa; x <= xb; x += 1) {
        if (this.setHole(x, y)) {
          box = box
            ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) }
            : { x0: x, y0: y, x1: x, y1: y };
        }
      }
    }
    if (!box) return null;
    this.version += 1;
    return { x0: box.x0 - 1, y0: box.y0 - 1, x1: box.x1 + 1, y1: box.y1 + 1 };
  }

  /**
   * Soot on the intact page around a crater: levels 3/2/1 in three rings out to `r`, thinned by a 4x4 ordered
   * dither so the page shows through. Never touches hole cells and never lowers existing soot.
   */
  addScorch(cx: number, cy: number, r: number): CellBox | null {
    if (!(r > 0)) return null;
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.rows - 1, Math.ceil(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.cols - 1, Math.ceil(cx + r));
    let changed = false;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        const level = d < r * 0.5 ? 3 : d < r * 0.75 ? 2 : 1;
        const threshold = BAYER4[(y & 3) * 4 + (x & 3)]! / 16; // 0..0.94
        if (threshold >= level / 3.4) continue;
        const band = this.bandFor(y, true)!;
        const i = (y % BAND_ROWS) * this.cols + x;
        if (band[i]! & HOLE) continue;
        const current = (band[i]! & SCORCH_MASK) >> SCORCH_SHIFT;
        if (level > current) {
          band[i] = (band[i]! & ~SCORCH_MASK) | (level << SCORCH_SHIFT);
          changed = true;
        }
      }
    }
    if (!changed) return null;
    this.version += 1;
    return { x0, y0, x1, y1 };
  }

  /** What edge treatment a cell gets: a dark/light rim just outside a hole, and an inner shade just inside (light from the top-left). */
  edgeKind(cx: number, cy: number): EdgeKind {
    const here = this.isHole(cx, cy);
    if (!here) {
      return this.isHole(cx - 1, cy) || this.isHole(cx + 1, cy) || this.isHole(cx, cy - 1) || this.isHole(cx, cy + 1) ? EDGE_RIM : EDGE_NONE;
    }
    // inside the hole: shade the cells under the top lip and inside the left lip
    return !this.isHole(cx, cy - 1) || !this.isHole(cx - 1, cy) ? EDGE_SHADE : EDGE_NONE;
  }

  clear(): void {
    this.bands.clear();
    this.holes = 0;
    this.version += 1;
  }

  /** Free bands that are entirely empty (after clear-ish edits) or far from `keepRow`, keeping at most `max` bands. */
  evict(keepRow: number, max: number): void {
    if (this.bands.size <= max) return;
    const keep = Math.floor(keepRow / BAND_ROWS);
    const order = [...this.bands.keys()].sort((a, b) => Math.abs(b - keep) - Math.abs(a - keep));
    for (const index of order) {
      if (this.bands.size <= max) break;
      const band = this.bands.get(index)!;
      let removed = 0;
      for (let i = 0; i < band.length; i += 1) if (band[i]! & HOLE) removed += 1;
      this.holes -= removed;
      this.bands.delete(index);
    }
    this.version += 1;
  }
}

/** Colours for the edge layer, as packed little-endian ABGR (what a `Uint32Array` over `ImageData` expects). */
export interface EdgePalette {
  rim: number;
  shade: number;
  scorch: number;
}

/** Pack r,g,b,a (0..255) into a little-endian ABGR uint32. */
export function packRgba(r: number, g: number, b: number, a = 255): number {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

const OPAQUE_WHITE = 0xffffffff;

/**
 * Fill two pixel buffers for the cell window whose top-left cell is (ox, oy):
 *  - `mask`:  opaque where the cell is a hole (used with `destination-in` to cut the scenery to the holes);
 *  - `edges`: rim, inner-shade and dithered soot colours (drawn over the page and over the scenery).
 * Returns how many hole cells are inside the window (0 lets the renderer skip the whole reveal pass).
 */
export function fillWindow(
  field: HoleField,
  ox: number,
  oy: number,
  w: number,
  h: number,
  mask: Uint32Array,
  edges: Uint32Array,
  palette: EdgePalette,
): number {
  mask.fill(0, 0, w * h);
  edges.fill(0, 0, w * h);
  if (field.holeCount === 0) return 0;
  let inWindow = 0;
  for (let y = 0; y < h; y += 1) {
    const cy = oy + y;
    for (let x = 0; x < w; x += 1) {
      const cx = ox + x;
      const i = y * w + x;
      if (field.isHole(cx, cy)) {
        mask[i] = OPAQUE_WHITE;
        inWindow += 1;
        if (field.edgeKind(cx, cy) === EDGE_SHADE) edges[i] = palette.shade;
        continue;
      }
      const kind = field.edgeKind(cx, cy);
      if (kind === EDGE_RIM) {
        edges[i] = palette.rim;
      } else if (field.scorchLevel(cx, cy) > 0) {
        edges[i] = palette.scorch;
      }
    }
  }
  return inWindow;
}

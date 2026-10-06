/**
 * The overlay's pixel grid and world scale. One low-res "cell" is one rig pixel, so sprites land on the grid
 * (the article's separate low-res layer). M0 spike decisions, measured in Chromium:
 *  - the cell is an INTEGER number of css px (3), never device-derived: at dpr 1.25 the browser rounds scroll
 *    to whole css px, so a 3.2 css-px cell drifts off the page, while an integer cell snaps exactly at every
 *    ratio tested (1, 1.1, 1.25, 1.5, 1.75, 2, 3);
 *  - 3 css px per cell makes the Foreman 66 px tall and, with the speed multiplier, lets him cross a 1280 px
 *    viewport in ~8.6 s (16 s before), and keeps the engine's 310-430 unit spawn ring off-screen.
 */

/** css px per low-res cell. Must stay an integer. */
export const CELL_CSS = 3;
/** World units per rig pixel: equal to `SPRITE_SCALE` in render/draw.ts (a test keeps them in step). */
export const SPRITE_UNITS = 2.05;
/** css px per world unit. The page is divided by this to get world coordinates. */
export const WORLD_K = CELL_CSS / SPRITE_UNITS;
/** Applied to the character's `stats.speed`: the Foreman's 78 u/s is slow at overlay scale. */
export const SPEED_MULT = 1.3;

export interface Size {
  w: number;
  h: number;
}

/** Round to the nearest whole cell. Scroll positions are snapped with this so canvas and page share one grid. */
export function snapToCell(cssPx: number, cell: number = CELL_CSS): number {
  return Math.round(cssPx / cell) * cell;
}

/** Low-res canvas size (in cells) that covers a css viewport. */
export function lowResSize(viewport: Size, cell: number = CELL_CSS): Size {
  return { w: Math.max(1, Math.ceil(viewport.w / cell)), h: Math.max(1, Math.ceil(viewport.h / cell)) };
}

/** `targetViewOverride` for renderWorld: world units across the low-res canvas, so 1 rig pixel = 1 cell. */
export function targetViewUnits(lowWCells: number): number {
  return lowWCells * SPRITE_UNITS;
}

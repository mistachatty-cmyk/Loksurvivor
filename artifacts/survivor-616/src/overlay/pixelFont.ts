/**
 * A 3x5 bitmap font for the overlay's damage numbers and combo banner. The overlay draws on a low-res canvas
 * where a system font would be anti-aliased mush, so text is built from whole cells instead. Digits, 'x', '!'
 * and the capitals that the overlay's own words need; anything else renders as blank space.
 */
const ROWS: Record<string, string> = {
  '0': '###,#.#,#.#,#.#,###',
  '1': '.#.,##.,.#.,.#.,###',
  '2': '###,..#,###,#..,###',
  '3': '###,..#,###,..#,###',
  '4': '#.#,#.#,###,..#,..#',
  '5': '###,#..,###,..#,###',
  '6': '###,#..,###,#.#,###',
  '7': '###,..#,.#.,.#.,.#.',
  '8': '###,#.#,###,#.#,###',
  '9': '###,#.#,###,..#,###',
  x: '...,#.#,.#.,#.#,...',
  X: '#.#,#.#,.#.,#.#,#.#',
  '!': '.#.,.#.,.#.,...,.#.',
  '+': '...,.#.,###,.#.,...',
  '%': '#.#,..#,.#.,#..,#.#',
  A: '.#.,#.#,###,#.#,#.#',
  B: '##.,#.#,##.,#.#,##.',
  C: '.##,#..,#..,#..,.##',
  D: '##.,#.#,#.#,#.#,##.',
  E: '###,#..,##.,#..,###',
  F: '###,#..,##.,#..,#..',
  G: '.##,#..,#.#,#.#,.##',
  H: '#.#,#.#,###,#.#,#.#',
  I: '###,.#.,.#.,.#.,###',
  K: '#.#,#.#,##.,#.#,#.#',
  L: '#..,#..,#..,#..,###',
  M: '#.#,###,###,#.#,#.#',
  N: '##.,#.#,#.#,#.#,#.#',
  O: '.#.,#.#,#.#,#.#,.#.',
  P: '##.,#.#,##.,#..,#..',
  R: '##.,#.#,##.,#.#,#.#',
  S: '.##,#..,.#.,..#,##.',
  T: '###,.#.,.#.,.#.,.#.',
  U: '#.#,#.#,#.#,#.#,###',
  W: '#.#,#.#,###,###,#.#',
  Y: '#.#,#.#,.#.,.#.,.#.',
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const GLYPH_GAP = 1;

const GLYPHS = new Map<string, boolean[][]>();
for (const [ch, spec] of Object.entries(ROWS)) {
  GLYPHS.set(ch, spec.split(',').map((row) => [...row].map((c) => c === '#')));
}

/** Width of `text` in cells (letters 3 wide, 1 gap between, spaces 2). */
export function measureText(text: string): number {
  let w = 0;
  for (const ch of text) w += (ch === ' ' ? 2 : GLYPH_W) + GLYPH_GAP;
  return Math.max(0, w - GLYPH_GAP);
}

/** The lit cells of `text`, relative to its top-left, in draw order. Unknown characters are blank. */
export function textCells(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += 2 + GLYPH_GAP;
      continue;
    }
    const g = GLYPHS.get(ch);
    if (g) for (let y = 0; y < GLYPH_H; y += 1) for (let gx = 0; gx < GLYPH_W; gx += 1) if (g[y]![gx]) out.push([x + gx, y]);
    x += GLYPH_W + GLYPH_GAP;
  }
  return out;
}

export function hasGlyph(ch: string): boolean {
  return ch === ' ' || GLYPHS.has(ch);
}

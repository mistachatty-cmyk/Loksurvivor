/**
 * The teardown report: what a run took down, by role, in numbers only. Nothing here names the page, quotes its
 * text or stores a URL; it is counts and areas. It rides in the report link's fragment as an optional `x`
 * object on the v1 payload, so an older hub decoder (which reads only the fields it knows) still opens the link.
 */
import type { BlockRole, PageBlock } from './pageModel';

export interface Teardown {
  /** Blocks destroyed per role. */
  roles: Partial<Record<BlockRole, number>>;
  /** Approximate words torn down (text and link blocks, by width). */
  words: number;
  /** Area torn down, css px squared. */
  px: number;
  /** Area of the single biggest block destroyed. */
  biggest: number;
  /** Best break combo. */
  combo: number;
}

const WORD_PX = 48;

export function emptyTeardown(): Teardown {
  return { roles: {}, words: 0, px: 0, biggest: 0, combo: 0 };
}

/** Add one destroyed block to the tally. */
export function tallyBlock(t: Teardown, block: Pick<PageBlock, 'role' | 'kind' | 'w' | 'h'>): void {
  t.roles[block.role] = (t.roles[block.role] ?? 0) + 1;
  const area = Math.max(0, block.w * block.h);
  t.px += area;
  t.biggest = Math.max(t.biggest, area);
  if (block.kind === 'text') t.words += Math.max(1, Math.round(block.w / WORD_PX));
}

const ROLE_ORDER: readonly BlockRole[] = ['text', 'link', 'heading', 'button', 'image', 'frame', 'input', 'box'];
const ROLE_CODE: Record<BlockRole, string> = { text: 't', link: 'l', heading: 'h', button: 'b', image: 'i', frame: 'f', input: 'n', box: 'x' };

export interface TeardownPayload {
  /** role code -> count, only roles that happened */
  r: Record<string, number>;
  w: number;
  /** px squared in thousands */
  p: number;
  /** biggest block in thousands of px squared */
  b: number;
  c: number;
}

const cap = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));

/** Compact, clamped form for the report link. */
export function teardownPayload(t: Teardown): TeardownPayload {
  const r: Record<string, number> = {};
  for (const role of ROLE_ORDER) {
    const n = t.roles[role];
    if (n) r[ROLE_CODE[role]] = cap(n, 99999);
  }
  return { r, w: cap(t.words, 9_999_999), p: cap(t.px / 1000, 99_999_999), b: cap(t.biggest / 1000, 9_999_999), c: cap(t.combo, 99999) };
}

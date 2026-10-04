/**
 * Operator detail layer.
 *
 * Operators used to be about ten flat rectangles each, so most of them read as
 * the same figure in different colors. This module adds a bank of small,
 * data-driven features -- hair, headwear, eyes, brows, mouths and beards, face
 * marks, tops, shoulders, gloves, belts, legwear, boots, accessories, back
 * items and held items -- that are stacked on top of an existing humanoid rig.
 *
 * Nothing here replaces the base rig: `applyOperatorLook` returns a new rig
 * with extra parts, reading the head/torso/leg geometry from the rig it is
 * given. Every detail reuses the existing animated part keys (`head`, `crest`,
 * `torso`, arms, legs), so idle, walk, attack and hurt clips move them with the
 * body and no animation authoring is needed.
 *
 * To add a feature, add one entry to the matching table and its id to the
 * matching `*_IDS` list (the unit tests fail if the two disagree). To add a
 * whole category, add a field to `OperatorLook` and a table; the generator
 * picks from every table automatically.
 */
import type { PartKey, SpritePalette, SpritePart, SpriteRig } from '@/game/types';

type Col = keyof SpritePalette;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry read from a humanoid rig; every feature is placed relative to this. */
export interface OperatorGeo {
  head: Rect;
  torso: Rect;
  legs: Array<Rect & { key: 'legL' | 'legR' }>;
  armL?: Rect;
  armR?: Rect;
  /** Row of the base face stripe (and where eyes go). */
  eyeY: number;
}

type Feature = (g: OperatorGeo, c: Col) => SpritePart[];

function part(key: PartKey, x: number, y: number, w: number, h: number, color: Col, z: number): SpritePart {
  return { key, x, y, w, h, color, z };
}

/* ------------------------------------------------------------------ */
/* Hair (above and around the head)                                    */
/* ------------------------------------------------------------------ */

const topRow = (g: OperatorGeo) => g.head.y + g.head.h - 1;
const headRight = (g: OperatorGeo) => g.head.x + g.head.w;

const hairline = (g: OperatorGeo, c: Col): SpritePart =>
  g.head.h >= 6 ? part('crest', g.head.x, topRow(g) - 1, g.head.w, 2, c, 6.5) : part('crest', g.head.x, topRow(g), g.head.w, 1, c, 6.5);

export const HAIR: Record<string, Feature> = {
  bald: () => [],
  crop: (g, c) => [hairline(g, c)],
  sidepart: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x, topRow(g) - 1, 2, 1, c, 6.5),
    part('crest', headRight(g) - 1, topRow(g) - 1, 1, 1, c, 6.5),
  ],
  mohawk: (g, c) => [
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 1, 2, 3, c, 6.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g), 2, 1, c, 6.5),
  ],
  afro: (g, c) => [
    part('crest', g.head.x - 3, topRow(g) - 1, g.head.w + 6, 5, c, 6.5),
    part('crest', g.head.x - 2, topRow(g) - 3, 2, 2, c, 6.5),
    part('crest', headRight(g), topRow(g) - 3, 2, 2, c, 6.5),
  ],
  longhair: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x - 1, g.head.y - 3, 2, g.head.h + 3, c, 4.5),
    part('crest', headRight(g) - 1, g.head.y - 3, 2, g.head.h + 3, c, 4.5),
  ],
  ponytail: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x - 3, topRow(g) - 3, 3, 2, c, 6.5),
    part('crest', g.head.x - 3, topRow(g) - 6, 2, 3, c, 6.5),
  ],
  locs: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x - 1, g.head.y - 2, 1, g.head.h + 1, c, 4.5),
    part('crest', g.head.x + 1, g.head.y - 3, 1, 3, c, 4.5),
    part('crest', headRight(g), g.head.y - 2, 1, g.head.h + 1, c, 4.5),
    part('crest', headRight(g) - 2, g.head.y - 3, 1, 3, c, 4.5),
  ],
  spikes: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x + 1, topRow(g) + 1, 1, 3, c, 6.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 1, 1, 4, c, 6.5),
    part('crest', headRight(g) - 2, topRow(g) + 1, 1, 3, c, 6.5),
  ],
  bun: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 1, 3, 3, c, 6.5),
  ],
  sweep: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x, topRow(g) - 1, g.head.w - 2, 1, c, 6.5),
    part('crest', g.head.x - 1, topRow(g) - 2, 2, 2, c, 6.5),
  ],
  pigtails: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x - 3, g.head.y + 1, 2, g.head.h - 1, c, 4.5),
    part('crest', headRight(g) + 1, g.head.y + 1, 2, g.head.h - 1, c, 4.5),
  ],
  widows: (g, c) => [
    part('crest', g.head.x, topRow(g), Math.floor(g.head.w / 2) - 1, 1, c, 6.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) + 1, topRow(g), Math.ceil(g.head.w / 2) - 1, 1, c, 6.5),
    part('crest', g.head.x, topRow(g) - 1, 1, 1, c, 6.5),
    part('crest', headRight(g) - 1, topRow(g) - 1, 1, 1, c, 6.5),
  ],
  fade: (g, c) => [
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 1, c, 6.5),
    part('crest', g.head.x + 2, topRow(g) + 1, g.head.w - 4, 1, c, 6.5),
  ],
  twists: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x + 1, topRow(g) + 1, 1, 2, c, 6.5),
    part('crest', g.head.x + 3, topRow(g) + 1, 1, 3, c, 6.5),
    part('crest', g.head.x + 5, topRow(g) + 1, 1, 2, c, 6.5),
    part('crest', headRight(g) - 2, topRow(g) + 1, 1, 3, c, 6.5),
  ],
  shaggy: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 2, c, 6.5),
    part('crest', g.head.x - 1, g.head.y + 1, 1, g.head.h - 2, c, 4.5),
    part('crest', headRight(g), g.head.y + 1, 1, g.head.h - 2, c, 4.5),
  ],
  undercut: (g, c) => [
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 1, c, 6.5),
    part('crest', g.head.x + 1, topRow(g) + 1, g.head.w - 3, 2, c, 6.5),
  ],
  topknot: (g, c) => [
    hairline(g, c),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 1, 2, 2, c, 6.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 3, 1, 1, c, 6.5),
  ],
  flattop: (g, c) => [part('crest', g.head.x, topRow(g), g.head.w, 3, c, 6.5)],
};

/* ------------------------------------------------------------------ */
/* Headwear                                                            */
/* ------------------------------------------------------------------ */

export const HEADWEAR: Record<string, Feature> = {
  none: () => [],
  beanie: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 2, c, 7.5),
    part('crest', g.head.x, topRow(g) + 1, g.head.w, 1, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 2, 1, 1, 'accentBright', 7.5),
  ],
  snapback: (g, c) => [
    part('crest', g.head.x, topRow(g) - 1, g.head.w, 2, c, 7.5),
    part('crest', headRight(g), topRow(g) - 1, 3, 1, 'ink', 7.6),
  ],
  bucket: (g, c) => [
    part('crest', g.head.x - 2, topRow(g) - 1, g.head.w + 4, 1, c, 7.5),
    part('crest', g.head.x, topRow(g), g.head.w, 2, c, 7.5),
  ],
  headphones: (g, c) => [
    part('crest', g.head.x, topRow(g) + 1, g.head.w, 1, 'ink', 7.5),
    part('crest', g.head.x - 2, g.head.y + 1, 2, 3, c, 7.5),
    part('crest', headRight(g), g.head.y + 1, 2, 3, c, 7.5),
  ],
  goggles: (g, c) => [
    part('crest', g.head.x, topRow(g), g.head.w, 1, 'ink', 7.5),
    part('crest', g.head.x + 1, topRow(g), 2, 2, c, 7.6),
    part('crest', headRight(g) - 3, topRow(g), 2, 2, c, 7.6),
  ],
  bandana: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 2, c, 7.5),
    part('crest', g.head.x - 3, topRow(g) - 3, 2, 3, c, 7.5),
  ],
  crown: (g, c) => [
    part('crest', g.head.x + 1, topRow(g) + 1, g.head.w - 2, 1, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) + 2, 1, 1, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 2, 2, 2, c, 7.5),
    part('crest', headRight(g) - 2, topRow(g) + 2, 1, 1, c, 7.5),
  ],
  horns: (g, c) => [
    part('crest', g.head.x - 1, topRow(g), 1, 3, c, 7.5),
    part('crest', g.head.x - 2, topRow(g) + 2, 1, 2, c, 7.5),
    part('crest', headRight(g), topRow(g), 1, 3, c, 7.5),
    part('crest', headRight(g) + 1, topRow(g) + 2, 1, 2, c, 7.5),
  ],
  antenna: (g, c) => [
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 1, 1, 4, 'ink', 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 5, 3, 2, c, 7.6),
  ],
  helmet: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 2, g.head.w + 2, 4, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) - 1, g.head.w - 2, 1, 'ink', 7.6),
  ],
  headwrap: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 3, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) + 2, g.head.w - 2, 1, c, 7.5),
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 1, 'accentBright', 7.6),
  ],
  catears: (g, c) => [
    part('crest', g.head.x, topRow(g) + 1, 2, 2, c, 7.5),
    part('crest', headRight(g) - 2, topRow(g) + 1, 2, 2, c, 7.5),
    part('crest', g.head.x, topRow(g) + 1, 1, 1, 'accentBright', 7.6),
    part('crest', headRight(g) - 1, topRow(g) + 1, 1, 1, 'accentBright', 7.6),
  ],
  fedora: (g, c) => [
    part('crest', g.head.x - 2, topRow(g) - 1, g.head.w + 4, 1, c, 7.5),
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 2, c, 7.5),
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 1, 'accentBright', 7.6),
  ],
  hardhat: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 1, c, 7.5),
    part('crest', g.head.x, topRow(g), g.head.w, 2, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 2, 1, 1, c, 7.5),
  ],
  visorcap: (g, c) => [
    part('crest', g.head.x, topRow(g), g.head.w, 1, c, 7.5),
    part('crest', g.head.x, topRow(g) - 1, g.head.w + 3, 1, 'ink', 7.6),
  ],
  hoodup: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 2, g.head.w + 2, 4, c, 7.5),
    part('crest', g.head.x + 1, g.head.y + 1, g.head.w - 2, topRow(g) - g.head.y - 2, 'skin', 7.6),
  ],
  tiara: (g, c) => [
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 1, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 1, 1, 2, 'accentBright', 7.6),
  ],
  flowers: (g, c) => [
    part('crest', g.head.x, topRow(g), 2, 2, c, 7.5),
    part('crest', g.head.x + 3, topRow(g) + 1, 2, 2, 'accentBright', 7.5),
    part('crest', headRight(g) - 2, topRow(g), 2, 2, c, 7.5),
  ],
  monocle: (g, c) => [
    part('crest', headRight(g) - 3, g.eyeY - 1, 3, 3, c, 7.4),
    part('crest', headRight(g) - 2, g.eyeY, 1, 1, 'skin', 7.5),
    part('crest', headRight(g), g.head.y - 2, 1, 3, c, 7.4),
  ],
  antlers: (g, c) => [
    part('crest', g.head.x, topRow(g) + 1, 1, 3, c, 7.5),
    part('crest', g.head.x - 1, topRow(g) + 3, 1, 2, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) + 3, 1, 1, c, 7.5),
    part('crest', headRight(g) - 1, topRow(g) + 1, 1, 3, c, 7.5),
    part('crest', headRight(g), topRow(g) + 3, 1, 2, c, 7.5),
    part('crest', headRight(g) - 2, topRow(g) + 3, 1, 1, c, 7.5),
  ],
  bubblehelm: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) + 1, g.head.w + 2, 1, c, 7.5),
    part('crest', g.head.x - 1, g.head.y - 1, 1, g.head.h + 2, c, 7.5),
    part('crest', headRight(g), g.head.y - 1, 1, g.head.h + 2, c, 7.5),
    part('crest', g.head.x - 1, g.head.y - 1, g.head.w + 2, 1, c, 7.5),
    part('crest', g.head.x, topRow(g), 1, 1, 'accentBright', 7.6),
  ],
  cone: (g, c) => [
    part('crest', g.head.x + 1, topRow(g), g.head.w - 2, 2, c, 7.5),
    part('crest', g.head.x + 2, topRow(g) + 2, Math.max(1, g.head.w - 4), 1, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) + 1, g.head.w - 2, 1, 'accentBright', 7.6),
    part('crest', g.head.x, topRow(g) - 1, g.head.w, 1, c, 7.5),
  ],
  crt: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 4, 'ink', 7.5),
    part('crest', g.head.x, topRow(g), g.head.w, 2, c, 7.6),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 3, 1, 2, 'ink', 7.5),
  ],
  filmreel: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) + 1, 3, 3, 'ink', 7.5),
    part('crest', g.head.x, topRow(g) + 2, 1, 1, c, 7.6),
    part('crest', headRight(g) - 2, topRow(g) + 1, 3, 3, 'ink', 7.5),
    part('crest', headRight(g) - 1, topRow(g) + 2, 1, 1, c, 7.6),
    part('crest', g.head.x, topRow(g), g.head.w, 1, 'ink', 7.5),
  ],
  leafcrown: (g, c) => [
    part('crest', g.head.x, topRow(g), g.head.w, 1, c, 7.5),
    part('crest', g.head.x + 1, topRow(g) + 1, 1, 2, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 1, 1, 3, c, 7.5),
    part('crest', headRight(g) - 2, topRow(g) + 1, 1, 2, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 3, 1, 1, 'accentBright', 7.6),
  ],
  minerlamp: (g, c) => [
    part('crest', g.head.x - 1, topRow(g) - 1, g.head.w + 2, 1, c, 7.5),
    part('crest', g.head.x, topRow(g), g.head.w, 2, c, 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g), 2, 2, 'glow', 7.6),
  ],
  marquee: (g, c) => {
    const bulbs: SpritePart[] = [];
    for (let i = 0; i < g.head.w + 2; i += 2) bulbs.push(part('crest', g.head.x - 1 + i, topRow(g) + 2, 1, 1, c, 7.6));
    return [part('crest', g.head.x - 1, topRow(g) + 1, g.head.w + 2, 1, 'ink', 7.5), ...bulbs];
  },
  dish: (g, c) => [
    part('crest', g.head.x + Math.floor(g.head.w / 2), topRow(g) + 1, 1, 2, 'ink', 7.5),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 2, topRow(g) + 3, 5, 1, c, 7.6),
    part('crest', g.head.x + Math.floor(g.head.w / 2) - 1, topRow(g) + 2, 3, 1, c, 7.6),
  ],
  spotlight: (g, c) => [
    part('crest', g.head.x, topRow(g), g.head.w, 1, 'ink', 7.5),
    part('crest', g.head.x + 1, topRow(g) + 1, Math.max(1, g.head.w - 2), 2, c, 7.5),
    part('crest', g.head.x + 2, topRow(g) + 3, Math.max(1, g.head.w - 4), 1, 'glow', 7.6),
  ],
};

/* ------------------------------------------------------------------ */
/* Face: eyes, brows, mouths, marks                                    */
/* ------------------------------------------------------------------ */

function eyePair(g: OperatorGeo, w: number, h: number, c: Col, dy = 0): SpritePart[] {
  const inset = Math.max(1, Math.floor(g.head.w * 0.2));
  return [
    part('head', g.head.x + inset, g.eyeY + dy, w, h, c, 6.2),
    part('head', headRight(g) - inset - w, g.eyeY + dy, w, h, c, 6.2),
  ];
}

export const EYES: Record<string, Feature> = {
  dots: (g, c) => eyePair(g, 1, 1, c),
  wide: (g, c) => eyePair(g, 2, 1, c),
  tall: (g, c) => eyePair(g, 1, 2, c),
  big: (g, c) => [...eyePair(g, 2, 2, c), ...eyePair(g, 1, 1, 'accentBright').map((p) => ({ ...p, z: 6.3 }))],
  glow: (g, c) => [...eyePair(g, 2, 1, 'glow', 0), ...eyePair(g, 1, 1, c, 1).map((p) => ({ ...p, z: 6.1 }))],
  sleepy: (g, c) => [...eyePair(g, 2, 1, c, 0), ...eyePair(g, 2, 1, 'bodyDark', 1).map((p) => ({ ...p, z: 6.1 }))],
  shades: (g, c) => [
    part('head', g.head.x, g.eyeY, g.head.w, 1, 'ink', 6.4),
    part('head', g.head.x + 1, g.eyeY - 1, 2, 1, 'ink', 6.4),
    part('head', headRight(g) - 3, g.eyeY - 1, 2, 1, 'ink', 6.4),
    part('head', g.head.x + 1, g.eyeY, 1, 1, c, 6.5),
    part('head', headRight(g) - 3, g.eyeY, 1, 1, c, 6.5),
  ],
  visor: (g, c) => [
    part('head', g.head.x, g.eyeY, g.head.w, 2, 'ink', 6.4),
    part('head', g.head.x + 1, g.eyeY, g.head.w - 2, 1, c, 6.5),
  ],
  cyclops: (g, c) => [
    part('head', g.head.x + Math.floor(g.head.w / 2) - 1, g.eyeY, 2, 2, c, 6.4),
    part('head', g.head.x + Math.floor(g.head.w / 2), g.eyeY + 1, 1, 1, 'accentBright', 6.5),
  ],
  patch: (g, c) => [
    ...eyePair(g, 1, 1, c),
    part('head', headRight(g) - 3, g.eyeY - 1, 3, 3, 'ink', 6.4),
  ],
  mismatch: (g, c) => [
    part('head', g.head.x + 1, g.eyeY, 2, 1, c, 6.2),
    part('head', headRight(g) - 2, g.eyeY, 1, 1, 'glow', 6.2),
  ],
  lashes: (g, c) => [...eyePair(g, 2, 1, c), ...eyePair(g, 1, 1, 'ink', 1).map((p) => ({ ...p, z: 6.3 }))],
  narrow: (g, c) => [
    part('head', g.head.x + 1, g.eyeY, 3, 1, c, 6.2),
    part('head', headRight(g) - 4, g.eyeY, 3, 1, c, 6.2),
  ],
  spiral: (g, c) => [...eyePair(g, 2, 2, c), ...eyePair(g, 1, 1, 'ink').map((p) => ({ ...p, z: 6.3 }))],
  hollow: (g) => eyePair(g, 2, 2, 'ink'),
  triple: (g, c) => [
    ...eyePair(g, 1, 1, c),
    part('head', g.head.x + Math.floor(g.head.w / 2), Math.min(g.eyeY + 2, topRow(g)), 1, 1, 'glow', 6.3),
  ],
  lens: (g, c) => [
    part('head', g.head.x + Math.floor(g.head.w / 2) - 1, g.eyeY - 1, 3, 3, 'ink', 6.4),
    part('head', g.head.x + Math.floor(g.head.w / 2), g.eyeY, 1, 1, c, 6.5),
  ],
};

export const BROWS: Record<string, Feature> = {
  none: () => [],
  flat: (g, c) => [
    part('head', g.head.x + 1, g.eyeY + 1, 2, 1, c, 6.3),
    part('head', headRight(g) - 3, g.eyeY + 1, 2, 1, c, 6.3),
  ],
  angry: (g, c) => [
    part('head', g.head.x + 1, g.eyeY + 1, 1, 1, c, 6.3),
    part('head', g.head.x + 2, g.eyeY + 2, 1, 1, c, 6.3),
    part('head', headRight(g) - 2, g.eyeY + 1, 1, 1, c, 6.3),
    part('head', headRight(g) - 3, g.eyeY + 2, 1, 1, c, 6.3),
  ],
  raised: (g, c) => [
    part('head', g.head.x + 1, g.eyeY + 2, 2, 1, c, 6.3),
    part('head', headRight(g) - 3, g.eyeY + 1, 2, 1, c, 6.3),
  ],
  thick: (g, c) => [
    part('head', g.head.x + 1, g.eyeY + 1, 3, 1, c, 6.3),
    part('head', headRight(g) - 4, g.eyeY + 1, 3, 1, c, 6.3),
  ],
};

export const MOUTHS: Record<string, Feature> = {
  none: () => [],
  smile: (g, c) => [
    part('head', g.head.x + 2, g.head.y + 1, g.head.w - 4, 1, c, 6.2),
    part('head', g.head.x + 1, g.head.y + 2, 1, 1, c, 6.2),
    part('head', headRight(g) - 2, g.head.y + 2, 1, 1, c, 6.2),
  ],
  flat: (g, c) => [part('head', g.head.x + 2, g.head.y + 1, g.head.w - 4, 1, c, 6.2)],
  frown: (g, c) => [
    part('head', g.head.x + 2, g.head.y + 2, g.head.w - 4, 1, c, 6.2),
    part('head', g.head.x + 1, g.head.y + 1, 1, 1, c, 6.2),
    part('head', headRight(g) - 2, g.head.y + 1, 1, 1, c, 6.2),
  ],
  fangs: (g, c) => [
    part('head', g.head.x + 2, g.head.y + 1, g.head.w - 4, 1, c, 6.2),
    part('head', g.head.x + 2, g.head.y, 1, 1, 'accentBright', 6.3),
    part('head', headRight(g) - 3, g.head.y, 1, 1, 'accentBright', 6.3),
  ],
  goldteeth: (g) => [part('head', g.head.x + 2, g.head.y + 1, g.head.w - 4, 1, 'accentBright', 6.2)],
  goatee: (g, c) => [
    part('head', g.head.x + Math.floor(g.head.w / 2) - 1, g.head.y - 1, 2, 3, c, 6.2),
  ],
  beard: (g, c) => [
    part('head', g.head.x, g.head.y - 1, g.head.w, 3, c, 6.1),
    part('head', g.head.x + 2, g.head.y + 1, g.head.w - 4, 1, 'skin', 6.2),
  ],
  mustache: (g, c) => [
    part('head', g.head.x + 1, g.head.y + 2, g.head.w - 2, 1, c, 6.2),
    part('head', g.head.x + 1, g.head.y + 1, 1, 1, c, 6.2),
    part('head', headRight(g) - 2, g.head.y + 1, 1, 1, c, 6.2),
  ],
  stubble: (g, c) => {
    const out: SpritePart[] = [];
    for (let i = 0; i < g.head.w - 1; i += 2) out.push(part('head', g.head.x + 1 + i, g.head.y, 1, 1, c, 6.2));
    for (let i = 1; i < g.head.w - 1; i += 2) out.push(part('head', g.head.x + 1 + i, g.head.y + 1, 1, 1, c, 6.2));
    return out;
  },
  mask: (g, c) => [
    part('head', g.head.x, g.head.y - 1, g.head.w, Math.max(2, Math.floor(g.head.h / 2)), c, 6.6),
  ],
};

export const MARKS: Record<string, Feature> = {
  none: () => [],
  scar: (g, c) => [
    part('head', g.head.x + 1, g.eyeY - 1, 1, 1, c, 6.4),
    part('head', g.head.x + 2, g.eyeY, 1, 1, c, 6.4),
    part('head', g.head.x + 3, g.eyeY + 1, 1, 1, c, 6.4),
  ],
  freckles: (g, c) => [
    part('head', g.head.x + 1, g.eyeY - 1, 1, 1, c, 6.1),
    part('head', g.head.x + 3, g.eyeY - 1, 1, 1, c, 6.1),
    part('head', headRight(g) - 2, g.eyeY - 1, 1, 1, c, 6.1),
    part('head', headRight(g) - 4, g.eyeY - 1, 1, 1, c, 6.1),
  ],
  warpaint: (g, c) => [part('head', g.head.x, g.eyeY - 1, g.head.w, 1, c, 6.1)],
  blush: (g, c) => [
    part('head', g.head.x, g.eyeY - 1, 2, 1, c, 6.1),
    part('head', headRight(g) - 2, g.eyeY - 1, 2, 1, c, 6.1),
  ],
  circuit: (g, c) => [
    part('head', headRight(g) - 1, g.head.y, 1, g.head.h - 1, c, 6.4),
    part('head', headRight(g) - 3, g.eyeY - 1, 2, 1, c, 6.4),
  ],
  tearline: (g, c) => [part('head', g.head.x + 1, g.head.y + 1, 1, g.eyeY - g.head.y, c, 6.1)],
  neckband: (g, c) => [part('torso', g.torso.x + 1, g.torso.y + g.torso.h - 1, g.torso.w - 2, 1, c, 3.4)],
  stripe: (g, c) => [part('head', g.head.x + Math.floor(g.head.w / 2), g.head.y, 1, g.head.h, c, 6.1)],
  bandage: (g, c) => [
    part('head', g.head.x + 1, g.eyeY, 2, 2, c, 6.4),
    part('head', g.head.x + 1, g.eyeY, 1, 1, 'ink', 6.5),
  ],
  glitchline: (g, c) => [
    part('head', g.head.x, g.eyeY - 1, 3, 1, c, 6.4),
    part('head', headRight(g) - 3, g.eyeY + 1, 3, 1, c, 6.4),
  ],
  static: (g, c) => [
    part('head', g.head.x + 1, g.eyeY - 1, 1, 1, c, 6.4),
    part('head', g.head.x + 3, g.eyeY + 1, 1, 1, c, 6.4),
    part('head', g.head.x + 2, g.head.y, 1, 1, c, 6.4),
    part('head', headRight(g) - 2, g.eyeY, 1, 1, c, 6.4),
  ],
  barcode: (g, c) => [
    part('head', g.head.x + 1, g.head.y, 1, 2, c, 6.4),
    part('head', g.head.x + 3, g.head.y, 1, 2, c, 6.4),
    part('head', g.head.x + 4, g.head.y, 1, 2, c, 6.4),
    part('head', g.head.x + 6, g.head.y, 1, 2, c, 6.4),
  ],
};

/* ------------------------------------------------------------------ */
/* Torso                                                               */
/* ------------------------------------------------------------------ */

const midX = (g: OperatorGeo) => g.torso.x + Math.floor(g.torso.w / 2);
const torsoTop = (g: OperatorGeo) => g.torso.y + g.torso.h;

export const TOPS: Record<string, Feature> = {
  plain: () => [],
  jacket: (g, c) => [
    part('torso', midX(g), g.torso.y, 1, g.torso.h, 'ink', 3.3),
    part('torso', g.torso.x, g.torso.y, 2, g.torso.h, c, 3.2),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y, 2, g.torso.h, c, 3.2),
    part('torso', g.torso.x + 2, torsoTop(g) - 2, 1, 2, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 3, torsoTop(g) - 2, 1, 2, c, 3.3),
  ],
  hoodie: (g, c) => [
    part('torso', g.torso.x + 1, g.torso.y + 1, g.torso.w - 2, 2, c, 3.2),
    part('torso', midX(g) - 1, torsoTop(g) - 3, 1, 3, 'accentBright', 3.3),
    part('torso', midX(g) + 1, torsoTop(g) - 3, 1, 3, 'accentBright', 3.3),
  ],
  harness: (g, c) => [
    part('torso', g.torso.x + 1, g.torso.y, 1, g.torso.h, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y, 1, g.torso.h, c, 3.3),
    part('torso', g.torso.x, g.torso.y + Math.floor(g.torso.h / 2), g.torso.w, 1, c, 3.3),
  ],
  tank: (g) => [
    part('torso', g.torso.x, torsoTop(g) - 2, 2, 2, 'skin', 3.3),
    part('torso', g.torso.x + g.torso.w - 2, torsoTop(g) - 2, 2, 2, 'skin', 3.3),
  ],
  armor: (g, c) => [
    part('torso', g.torso.x + 1, g.torso.y + 2, g.torso.w - 2, g.torso.h - 3, c, 3.2),
    part('torso', midX(g), g.torso.y + 2, 1, g.torso.h - 3, 'accentBright', 3.3),
  ],
  sash: (g, c) => {
    const out: SpritePart[] = [];
    const steps = Math.max(2, g.torso.h - 1);
    for (let i = 0; i < steps; i += 1) {
      const x = g.torso.x + Math.min(g.torso.w - 2, Math.floor((i * (g.torso.w - 1)) / steps));
      out.push(part('torso', x, torsoTop(g) - 1 - i, 2, 1, c, 3.3));
    }
    return out;
  },
  apron: (g, c) => [
    part('torso', g.torso.x + 2, g.torso.y, g.torso.w - 4, Math.max(2, g.torso.h - 1), c, 3.2),
    part('torso', g.torso.x + 2, torsoTop(g) - 1, 1, 1, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 3, torsoTop(g) - 1, 1, 1, c, 3.3),
  ],
  stripes: (g, c) => {
    const out: SpritePart[] = [];
    for (let y = g.torso.y + 1; y < torsoTop(g) - 1; y += 3) out.push(part('torso', g.torso.x, y, g.torso.w, 1, c, 3.2));
    return out;
  },
  tracksuit: (g, c) => [
    part('torso', g.torso.x, g.torso.y, 1, g.torso.h, c, 3.2),
    part('torso', g.torso.x + g.torso.w - 1, g.torso.y, 1, g.torso.h, c, 3.2),
    part('torso', midX(g), torsoTop(g) - 3, 1, 3, 'accentBright', 3.3),
  ],
  trench: (g, c) => [
    part('torso', g.torso.x - 1, g.torso.y - 2, g.torso.w + 2, 3, c, 3.1),
    part('torso', midX(g), g.torso.y - 2, 1, g.torso.h + 2, 'ink', 3.3),
  ],
  labcoat: (g) => [
    part('torso', g.torso.x, g.torso.y - 2, g.torso.w, g.torso.h + 1, 'accentBright', 3.1),
    part('torso', midX(g), g.torso.y - 2, 1, g.torso.h + 1, 'bodyDark', 3.3),
    part('torso', g.torso.x + 1, g.torso.y + 1, 2, 1, 'bodyDark', 3.3),
  ],
  jersey: (g, c) => [
    part('torso', g.torso.x + 2, g.torso.y + 1, g.torso.w - 4, g.torso.h - 3, c, 3.2),
    part('torso', midX(g) - 1, g.torso.y + 2, 1, g.torso.h - 5 > 0 ? g.torso.h - 5 : 1, 'ink', 3.3),
  ],
  core: (g, c) => [
    part('torso', midX(g) - 1, g.torso.y + Math.floor(g.torso.h / 2) - 1, 2, 2, c, 3.3),
    part('torso', midX(g) - 2, g.torso.y + Math.floor(g.torso.h / 2), 1, 1, 'ink', 3.3),
    part('torso', midX(g) + 1, g.torso.y + Math.floor(g.torso.h / 2), 1, 1, 'ink', 3.3),
  ],
  hazard: (g, c) => {
    const out: SpritePart[] = [];
    for (let i = 0; i < g.torso.w; i += 2) out.push(part('torso', g.torso.x + i, g.torso.y, 1, 2, c, 3.2));
    return out;
  },
  scarf: (g, c) => [
    part('torso', g.torso.x, torsoTop(g) - 1, g.torso.w, 2, c, 3.4),
    part('torso', g.torso.x + g.torso.w - 3, g.torso.y + Math.floor(g.torso.h / 2), 2, torsoTop(g) - g.torso.y - Math.floor(g.torso.h / 2), c, 3.4),
  ],
  poncho: (g, c) => [
    part('torso', g.torso.x - 1, g.torso.y, g.torso.w + 2, g.torso.h - 1, c, 3.1),
    part('torso', g.torso.x - 1, g.torso.y, g.torso.w + 2, 1, 'accentBright', 3.2),
  ],
  kimono: (g, c) => [
    part('torso', midX(g) - 1, g.torso.y, 1, g.torso.h, c, 3.3),
    part('torso', midX(g), g.torso.y, 1, g.torso.h - 1, 'ink', 3.3),
    part('torso', g.torso.x, g.torso.y + 1, g.torso.w, 1, c, 3.2),
  ],
  overalls: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, Math.max(2, Math.floor(g.torso.h / 2)), c, 3.2),
    part('torso', g.torso.x + 1, g.torso.y, 1, g.torso.h, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y, 1, g.torso.h, c, 3.3),
  ],
  bomber: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, 1, c, 3.3),
    part('torso', g.torso.x, torsoTop(g) - 1, g.torso.w, 1, c, 3.3),
    part('torso', g.torso.x + 1, g.torso.y + Math.floor(g.torso.h / 2), 2, 1, 'accentBright', 3.3),
  ],
  cropped: (g, c) => [
    part('torso', g.torso.x, g.torso.y + Math.floor(g.torso.h / 2), g.torso.w, Math.ceil(g.torso.h / 2), c, 3.2),
    part('torso', g.torso.x + 1, g.torso.y + Math.floor(g.torso.h / 2) - 1, g.torso.w - 2, 1, 'skin', 3.2),
  ],
  circuitry: (g, c) => [
    part('torso', g.torso.x + 1, g.torso.y + 1, 1, g.torso.h - 2, c, 3.3),
    part('torso', g.torso.x + 1, g.torso.y + Math.floor(g.torso.h / 2), g.torso.w - 3, 1, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y + 1, 1, Math.floor(g.torso.h / 2), c, 3.3),
  ],
  tux: (g, c) => [
    part('torso', g.torso.x, g.torso.y, 2, g.torso.h, 'ink', 3.2),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y, 2, g.torso.h, 'ink', 3.2),
    part('torso', midX(g), g.torso.y, 1, g.torso.h, 'accentBright', 3.3),
    part('torso', midX(g) - 1, torsoTop(g) - 1, 3, 1, c, 3.4),
  ],
  hivis: (g, c) => [
    part('torso', g.torso.x + 1, g.torso.y, 1, g.torso.h, c, 3.2),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y, 1, g.torso.h, c, 3.2),
    part('torso', g.torso.x, g.torso.y + Math.floor(g.torso.h / 2), g.torso.w, 1, 'accentBright', 3.3),
  ],
  foliage: (g, c) => [
    part('torso', g.torso.x, g.torso.y, 2, 2, c, 3.2),
    part('torso', g.torso.x + g.torso.w - 3, g.torso.y + 1, 3, 2, c, 3.2),
    part('torso', g.torso.x + 2, torsoTop(g) - 2, 2, 2, c, 3.3),
    part('torso', g.torso.x + g.torso.w - 2, torsoTop(g) - 1, 2, 1, 'accentBright', 3.3),
  ],
  rackmount: (g, c) => {
    const rows: SpritePart[] = [part('torso', g.torso.x + 1, g.torso.y + 1, Math.max(1, g.torso.w - 2), Math.max(1, g.torso.h - 2), 'ink', 3.2)];
    for (let y = g.torso.y + 1; y < torsoTop(g) - 1; y += 2) {
      rows.push(part('torso', g.torso.x + 2, y, Math.max(1, g.torso.w - 4), 1, 'bodyDark', 3.3));
      rows.push(part('torso', g.torso.x + 2, y, 1, 1, c, 3.4));
    }
    return rows;
  },
};

export const SHOULDERS: Record<string, Feature> = {
  none: () => [],
  pads: (g, c) => [
    part('torso', g.torso.x - 1, torsoTop(g) - 2, 2, 2, c, 4.5),
    part('torso', g.torso.x + g.torso.w - 1, torsoTop(g) - 2, 2, 2, c, 4.5),
  ],
  spikes: (g, c) => [
    part('torso', g.torso.x - 1, torsoTop(g) - 2, 2, 2, c, 4.5),
    part('torso', g.torso.x - 1, torsoTop(g), 1, 2, 'accentBright', 4.5),
    part('torso', g.torso.x + g.torso.w - 1, torsoTop(g) - 2, 2, 2, c, 4.5),
    part('torso', g.torso.x + g.torso.w, torsoTop(g), 1, 2, 'accentBright', 4.5),
  ],
  mantle: (g, c) => [part('torso', g.torso.x - 1, torsoTop(g) - 1, g.torso.w + 2, 2, c, 4.5)],
  epaulets: (g, c) => [
    part('torso', g.torso.x - 1, torsoTop(g) - 1, 3, 1, c, 4.5),
    part('torso', g.torso.x + g.torso.w - 2, torsoTop(g) - 1, 3, 1, c, 4.5),
    part('torso', g.torso.x - 1, torsoTop(g) - 2, 1, 1, 'accentBright', 4.6),
    part('torso', g.torso.x + g.torso.w, torsoTop(g) - 2, 1, 1, 'accentBright', 4.6),
  ],
  fur: (g, c) => [
    part('torso', g.torso.x - 2, torsoTop(g) - 2, g.torso.w + 4, 2, c, 4.4),
    part('torso', g.torso.x - 2, torsoTop(g) - 3, 2, 1, c, 4.4),
    part('torso', g.torso.x + g.torso.w, torsoTop(g) - 3, 2, 1, c, 4.4),
  ],
  plates: (g, c) => [
    part('torso', g.torso.x - 2, torsoTop(g) - 3, 2, 3, c, 4.5),
    part('torso', g.torso.x - 2, torsoTop(g) - 2, 1, 1, 'ink', 4.6),
    part('torso', g.torso.x + g.torso.w, torsoTop(g) - 3, 2, 3, c, 4.5),
    part('torso', g.torso.x + g.torso.w + 1, torsoTop(g) - 2, 1, 1, 'ink', 4.6),
  ],
};

/* ------------------------------------------------------------------ */
/* Arms, hands, belts, legs, feet                                      */
/* ------------------------------------------------------------------ */

function armParts(g: OperatorGeo, f: (side: 'L' | 'R', a: Rect) => SpritePart[]): SpritePart[] {
  const out: SpritePart[] = [];
  if (g.armL) out.push(...f('L', g.armL));
  if (g.armR) out.push(...f('R', g.armR));
  return out;
}

export const SLEEVES: Record<string, Feature> = {
  none: () => [],
  cuffs: (g, c) => armParts(g, (s, a) => [part(s === 'L' ? 'armL' : 'armR', a.x, a.y, a.w, 1, c, s === 'L' ? 2.5 : 4.5)]),
  gloves: (g, c) => armParts(g, (s, a) => [part(s === 'L' ? 'armL' : 'armR', a.x, a.y, a.w, 2, c, s === 'L' ? 2.5 : 4.5)]),
  bracers: (g, c) => armParts(g, (s, a) => [part(s === 'L' ? 'armL' : 'armR', a.x, a.y + 2, a.w, 2, c, s === 'L' ? 2.5 : 4.5)]),
  rolled: (g) => armParts(g, (s, a) => [part(s === 'L' ? 'armL' : 'armR', a.x, a.y, a.w, Math.max(2, Math.floor(a.h / 2)), 'skin', s === 'L' ? 2.5 : 4.5)]),
  cyber: (g, c) => armParts(g, (s, a) => [
    part(s === 'L' ? 'armL' : 'armR', a.x, a.y, a.w, a.h, 'accentBright', s === 'L' ? 2.5 : 4.5),
    part(s === 'L' ? 'armL' : 'armR', a.x, a.y + 1, a.w, 1, c, s === 'L' ? 2.6 : 4.6),
  ]),
  armband: (g, c) => (g.armR ? [part('armR', g.armR.x, g.armR.y + g.armR.h - 2, g.armR.w, 1, c, 4.5)] : []),
};

export const BELTS: Record<string, Feature> = {
  none: () => [],
  belt: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, 1, c, 3.4),
    part('torso', midX(g), g.torso.y, 1, 1, 'accentBright', 3.5),
  ],
  utility: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, 1, 'ink', 3.4),
    part('torso', g.torso.x, g.torso.y - 1, 2, 2, c, 3.5),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y - 1, 2, 2, c, 3.5),
  ],
  chainbelt: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, 1, 'ink', 3.4),
    part('torso', g.torso.x + 1, g.torso.y - 1, 1, 1, c, 3.5),
    part('torso', g.torso.x + 2, g.torso.y - 2, 1, 2, c, 3.5),
  ],
  cummerbund: (g, c) => [part('torso', g.torso.x, g.torso.y, g.torso.w, 2, c, 3.4)],
  holster: (g, c) => [
    part('torso', g.torso.x, g.torso.y, g.torso.w, 1, 'ink', 3.4),
    part('torso', g.torso.x + g.torso.w - 2, g.torso.y - 2, 2, 3, c, 3.5),
  ],
};

export const LEGWEAR: Record<string, Feature> = {
  plain: () => [],
  stripe: (g, c) => g.legs.map((l) => part(l.key, l.x + Math.floor(l.w / 2), l.y, 1, l.h, c, 1.5)),
  shorts: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y + Math.max(0, l.h - 2), l.w, 2, c, 1.5)),
  cargo: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y + Math.floor(l.h / 2), l.w, 2, c, 1.5)),
  kneepads: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y + Math.max(1, Math.floor(l.h / 2)), l.w, 1, c, 1.5)),
  cuffed: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y + 2, l.w, 1, c, 1.5)),
  patched: (g, c) => g.legs.slice(0, 1).map((l) => part(l.key, l.x, l.y + 1, Math.min(2, l.w), 2, c, 1.5)),
};

export const BOOTS: Record<string, Feature> = {
  none: () => [],
  boots: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y, l.w, Math.min(2, l.h), c, 1.6)),
  sneakers: (g, c) => g.legs.flatMap((l) => [
    part(l.key, l.x, l.y, l.w, 1, c, 1.6),
    part(l.key, l.x + l.w - 1, l.y, 1, 1, 'accentBright', 1.7),
  ]),
  heavy: (g, c) => g.legs.flatMap((l) => [
    part(l.key, l.x - 1, l.y, l.w + 2, Math.min(2, l.h), c, 1.6),
    part(l.key, l.x - 1, l.y + Math.min(2, l.h), l.w + 2, 1, 'accentBright', 1.7),
  ]),
  socks: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y + 1, l.w, 1, c, 1.6)),
  greaves: (g, c) => g.legs.map((l) => part(l.key, l.x, l.y, l.w, Math.max(2, Math.floor(l.h * 0.6)), c, 1.6)),
  hover: (g, c) => g.legs.map((l) => part('aura', l.x - 1, -1, l.w + 2, 1, c, 0.5)),
};

/* ------------------------------------------------------------------ */
/* Accessories, back items, held items                                 */
/* ------------------------------------------------------------------ */

export const ACCESSORIES: Record<string, Feature> = {
  none: () => [],
  chain: (g, c) => [
    part('torso', g.torso.x + 2, torsoTop(g) - 2, g.torso.w - 4, 1, c, 3.5),
    part('torso', midX(g), torsoTop(g) - 3, 1, 1, c, 3.5),
  ],
  earring: (g, c) => [part('head', g.head.x - 1, g.head.y + 1, 1, 2, c, 6.3)],
  headset: (g, c) => [
    part('head', g.head.x - 1, g.head.y + 1, 1, g.head.h - 1, 'ink', 6.3),
    part('head', g.head.x - 2, g.head.y, 2, 1, 'ink', 6.3),
    part('head', g.head.x - 3, g.head.y, 1, 1, c, 6.4),
  ],
  satchel: (g, c) => [
    part('torso', g.torso.x, g.torso.y + 1, g.torso.w, 1, c, 3.5),
    part('torso', g.torso.x + g.torso.w - 3, g.torso.y - 1, 3, 3, c, 3.6),
  ],
  lanyard: (g, c) => [
    part('torso', midX(g) - 1, torsoTop(g) - 3, 1, 3, c, 3.5),
    part('torso', midX(g) + 1, torsoTop(g) - 3, 1, 3, c, 3.5),
    part('torso', midX(g), g.torso.y + 1, 1, 2, 'accentBright', 3.6),
  ],
  medal: (g, c) => [
    part('torso', g.torso.x + 1, torsoTop(g) - 3, 2, 2, c, 3.5),
    part('torso', g.torso.x + 1, torsoTop(g) - 1, 1, 1, 'ink', 3.5),
  ],
  pin: (g, c) => [part('torso', g.torso.x + 1, torsoTop(g) - 2, 1, 1, c, 3.5)],
  tag: (g, c) => [
    part('torso', g.torso.x + g.torso.w - 3, g.torso.y + 1, 2, 3, c, 3.5),
  ],
  watch: (g, c) => (g.armL ? [part('armL', g.armL.x, g.armL.y + 1, g.armL.w, 1, c, 2.6)] : []),
  drone: (g, c) => [
    part('aura', g.torso.x + g.torso.w + 1, torsoTop(g) + 2, 3, 2, c, 0.6),
    part('aura', g.torso.x + g.torso.w, torsoTop(g) + 4, 5, 1, 'ink', 0.6),
  ],
  bandolier: (g, c) => {
    const out: SpritePart[] = [];
    const steps = Math.max(2, g.torso.h - 1);
    for (let i = 0; i < steps; i += 1) out.push(part('torso', g.torso.x + g.torso.w - 2 - Math.min(g.torso.w - 3, Math.floor((i * (g.torso.w - 2)) / steps)), torsoTop(g) - 1 - i, 1, 1, c, 3.5));
    return out;
  },
  bell: (g, c) => [
    part('torso', midX(g), torsoTop(g) - 2, 1, 1, 'ink', 3.5),
    part('torso', midX(g) - 1, torsoTop(g) - 4, 3, 2, c, 3.6),
  ],
  pocketwatch: (g, c) => [
    part('torso', g.torso.x + g.torso.w - 3, g.torso.y + 1, 1, 2, 'ink', 3.5),
    part('torso', g.torso.x + g.torso.w - 4, g.torso.y, 2, 2, c, 3.6),
  ],
  patch: (g, c) => [part('torso', g.torso.x + 1, g.torso.y + 1, 2, 2, c, 3.5)],
};

export const BACKS: Record<string, Feature> = {
  none: () => [],
  backpack: (g, c) => [part('torso', g.torso.x - 3, g.torso.y + 1, 3, Math.max(3, g.torso.h - 2), c, 2.2)],
  guitar: (g, c) => [
    part('torso', g.torso.x - 3, g.torso.y, 3, g.torso.h, c, 2.2),
    part('torso', g.torso.x - 2, torsoTop(g), 1, 4, 'ink', 2.2),
  ],
  cape: (g, c) => [part('torso', g.torso.x - 2, g.torso.y - 2, g.torso.w + 3, g.torso.h + 1, c, 2.1)],
  jetpack: (g, c) => [
    part('torso', g.torso.x - 3, g.torso.y + 1, 3, g.torso.h - 1, 'ink', 2.2),
    part('torso', g.torso.x - 3, g.torso.y - 1, 3, 1, c, 2.2),
  ],
  tail: (g, c) => [
    part('torso', g.torso.x - 3, g.torso.y, 3, 1, c, 2.2),
    part('torso', g.torso.x - 4, g.torso.y + 1, 2, 2, c, 2.2),
    part('torso', g.torso.x - 5, g.torso.y + 3, 1, 2, c, 2.2),
  ],
  banner: (g, c) => [
    part('torso', g.torso.x - 2, g.torso.y, 1, torsoTop(g) - g.torso.y + 6, 'ink', 2.2),
    part('torso', g.torso.x - 6, torsoTop(g) + 2, 5, 4, c, 2.2),
  ],
  wings: (g, c) => [
    part('torso', g.torso.x - 4, g.torso.y + 2, 4, 2, c, 2.2),
    part('torso', g.torso.x - 6, g.torso.y + 4, 3, 2, c, 2.2),
    part('torso', g.torso.x + g.torso.w, g.torso.y + 2, 4, 2, c, 2.2),
  ],
  tattered: (g, c) => [
    part('torso', g.torso.x - 2, g.torso.y - 3, g.torso.w + 3, g.torso.h + 2, c, 2.1),
    part('torso', g.torso.x - 1, g.torso.y - 4, 1, 1, c, 2.1),
    part('torso', g.torso.x + 3, g.torso.y - 4, 1, 1, c, 2.1),
  ],
  quiver: (g, c) => [
    part('torso', g.torso.x - 2, g.torso.y + 1, 2, g.torso.h, c, 2.2),
    part('torso', g.torso.x - 3, torsoTop(g) + 1, 1, 2, 'accentBright', 2.2),
    part('torso', g.torso.x - 1, torsoTop(g) + 1, 1, 2, 'accentBright', 2.2),
  ],
  reel: (g, c) => [
    part('torso', g.torso.x - 4, g.torso.y + 1, 4, 4, 'ink', 2.2),
    part('torso', g.torso.x - 3, g.torso.y + 2, 2, 2, c, 2.3),
  ],
  vines: (g, c) => [
    part('torso', g.torso.x - 2, g.torso.y - 1, 1, g.torso.h + 1, c, 2.2),
    part('torso', g.torso.x - 3, g.torso.y + 1, 1, 2, c, 2.2),
    part('torso', g.torso.x + g.torso.w + 1, g.torso.y, 1, g.torso.h - 1, c, 2.2),
    part('torso', g.torso.x + g.torso.w + 2, g.torso.y + 2, 1, 2, 'accentBright', 2.2),
  ],
  bubbles: (g, c) => [
    part('torso', g.torso.x - 3, torsoTop(g) - 1, 2, 2, c, 2.2),
    part('torso', g.torso.x - 5, torsoTop(g) + 1, 1, 1, c, 2.2),
    part('torso', g.torso.x + g.torso.w + 1, torsoTop(g) + 1, 2, 2, c, 2.2),
    part('torso', g.torso.x + g.torso.w + 3, torsoTop(g) - 1, 1, 1, c, 2.2),
  ],
  cables: (g, c) => [
    part('torso', g.torso.x - 1, g.torso.y, 1, g.torso.h, 'ink', 2.2),
    part('torso', g.torso.x - 2, g.torso.y - 2, 1, 3, c, 2.2),
    part('torso', g.torso.x - 3, g.torso.y - 4, 1, 3, 'ink', 2.2),
  ],
  antennaarray: (g, c) => [
    part('torso', g.torso.x - 1, torsoTop(g), 1, 4, 'ink', 2.2),
    part('torso', g.torso.x - 2, torsoTop(g) + 4, 3, 1, c, 2.3),
    part('torso', g.torso.x + g.torso.w, torsoTop(g), 1, 3, 'ink', 2.2),
    part('torso', g.torso.x + g.torso.w, torsoTop(g) + 3, 2, 1, c, 2.3),
  ],
  fireflies: (g, c) => [
    part('torso', g.torso.x - 3, torsoTop(g), 1, 1, 'glow', 8),
    part('torso', g.torso.x + g.torso.w + 2, torsoTop(g) - 2, 1, 1, 'glow', 8),
    part('torso', g.torso.x - 2, torsoTop(g) + 3, 1, 1, c, 8),
    part('torso', g.torso.x + g.torso.w + 1, torsoTop(g) + 2, 1, 1, 'glow', 8),
  ],
};

export const HELD: Record<string, Feature> = {
  none: () => [],
  mic: (g, c) => g.armR ? [
    part('armR', g.armR.x, g.armR.y - 1, 1, 3, 'ink', 4.6),
    part('armR', g.armR.x - 1, g.armR.y + 2, 3, 2, c, 4.7),
  ] : [],
  baton: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 7, 'ink', 4.6),
    part('armR', g.armR.x, g.armR.y + 6, 3, 1, c, 4.7),
  ] : [],
  wrench: (g, c) => g.armR ? [
    part('armR', g.armR.x, g.armR.y - 1, 1, 5, 'ink', 4.6),
    part('armR', g.armR.x - 1, g.armR.y + 4, 3, 2, c, 4.7),
  ] : [],
  sign: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 7, 'ink', 4.6),
    part('armR', g.armR.x - 2, g.armR.y + 5, 6, 4, c, 4.7),
  ] : [],
  can: (g, c) => g.armR ? [
    part('armR', g.armR.x, g.armR.y - 1, 2, 3, c, 4.6),
    part('armR', g.armR.x, g.armR.y + 2, 1, 1, 'accentBright', 4.7),
  ] : [],
  phone: (g, c) => g.armR ? [
    part('armR', g.armR.x, g.armR.y - 1, 2, 3, 'ink', 4.6),
    part('armR', g.armR.x, g.armR.y, 1, 2, c, 4.7),
  ] : [],
  lantern: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 4, 2, 4, 'ink', 4.6),
    part('armR', g.armR.x + 1, g.armR.y - 3, 2, 2, c, 4.7),
  ] : [],
  umbrella: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 8, 'ink', 4.6),
    part('armR', g.armR.x - 3, g.armR.y + 7, 7, 2, c, 4.7),
  ] : [],
  torch: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 4, 'ink', 4.6),
    part('armR', g.armR.x, g.armR.y + 3, 3, 2, c, 4.7),
  ] : [],
  boombox: (g, c) => g.armR ? [
    part('armR', g.armR.x - 2, g.armR.y - 1, 6, 3, 'ink', 4.6),
    part('armR', g.armR.x - 1, g.armR.y, 2, 1, c, 4.7),
    part('armR', g.armR.x + 2, g.armR.y, 1, 1, c, 4.7),
  ] : [],
  jar: (g, c) => g.armR ? [
    part('armR', g.armR.x, g.armR.y - 1, 2, 3, 'ink', 4.6),
    part('armR', g.armR.x, g.armR.y, 1, 2, 'glow', 4.7),
    part('armR', g.armR.x, g.armR.y + 2, 2, 1, c, 4.7),
  ] : [],
  clapper: (g, c) => g.armR ? [
    part('armR', g.armR.x - 1, g.armR.y - 1, 4, 2, 'ink', 4.6),
    part('armR', g.armR.x - 1, g.armR.y + 1, 4, 1, c, 4.7),
  ] : [],
  pickaxe: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 6, 'ink', 4.6),
    part('armR', g.armR.x - 1, g.armR.y + 5, 5, 1, c, 4.7),
    part('armR', g.armR.x - 1, g.armR.y + 4, 1, 1, c, 4.7),
    part('armR', g.armR.x + 3, g.armR.y + 4, 1, 1, c, 4.7),
  ] : [],
  dumbbell: (g, c) => g.armR ? [
    part('armR', g.armR.x - 2, g.armR.y, 6, 1, 'ink', 4.6),
    part('armR', g.armR.x - 2, g.armR.y - 1, 1, 3, c, 4.7),
    part('armR', g.armR.x + 3, g.armR.y - 1, 1, 3, c, 4.7),
  ] : [],
  flag: (g, c) => g.armR ? [
    part('armR', g.armR.x + 1, g.armR.y - 1, 1, 8, 'ink', 4.6),
    part('armR', g.armR.x + 2, g.armR.y + 5, 4, 3, c, 4.7),
  ] : [],
};

/* ------------------------------------------------------------------ */
/* Look model                                                          */
/* ------------------------------------------------------------------ */

export interface OperatorLook {
  hair: string;
  hairColor: Col;
  headwear: string;
  headwearColor: Col;
  eyes: string;
  eyeColor: Col;
  brows: string;
  browColor: Col;
  mouth: string;
  mouthColor: Col;
  mark: string;
  markColor: Col;
  top: string;
  topColor: Col;
  shoulders: string;
  shoulderColor: Col;
  sleeves: string;
  sleeveColor: Col;
  belt: string;
  beltColor: Col;
  legwear: string;
  legwearColor: Col;
  boots: string;
  bootsColor: Col;
  accessory: string;
  accessoryColor: Col;
  back: string;
  backColor: Col;
  held: string;
  heldColor: Col;
}

const ids = (table: Record<string, Feature>) => Object.keys(table);
export const HAIR_IDS = ids(HAIR);
export const HEADWEAR_IDS = ids(HEADWEAR);
export const EYE_IDS = ids(EYES);
export const BROW_IDS = ids(BROWS);
export const MOUTH_IDS = ids(MOUTHS);
export const MARK_IDS = ids(MARKS);
export const TOP_IDS = ids(TOPS);
export const SHOULDER_IDS = ids(SHOULDERS);
export const SLEEVE_IDS = ids(SLEEVES);
export const BELT_IDS = ids(BELTS);
export const LEGWEAR_IDS = ids(LEGWEAR);
export const BOOT_IDS = ids(BOOTS);
export const ACCESSORY_IDS = ids(ACCESSORIES);
export const BACK_IDS = ids(BACKS);
export const HELD_IDS = ids(HELD);

/** Total number of selectable features across every category; shown in docs and checked by tests. */
export const OPERATOR_FEATURE_COUNT =
  HAIR_IDS.length + HEADWEAR_IDS.length + EYE_IDS.length + BROW_IDS.length + MOUTH_IDS.length + MARK_IDS.length +
  TOP_IDS.length + SHOULDER_IDS.length + SLEEVE_IDS.length + BELT_IDS.length + LEGWEAR_IDS.length + BOOT_IDS.length +
  ACCESSORY_IDS.length + BACK_IDS.length + HELD_IDS.length;

/* ------------------------------------------------------------------ */
/* Geometry and application                                            */
/* ------------------------------------------------------------------ */

function rectOf(p: SpritePart | undefined): Rect | undefined {
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : undefined;
}

/** Reads head/torso/limb geometry from a rig, or returns null if the rig is not a humanoid. */
export function readOperatorGeo(rig: SpriteRig): OperatorGeo | null {
  const find = (key: PartKey) => rig.parts.find((p) => p.key === key);
  const head = find('head');
  const torso = find('torso');
  if (!head || !torso || head.h < 3 || head.w < 5) return null;
  const legs = rig.parts
    .filter((p): p is SpritePart & { key: 'legL' | 'legR' } => (p.key === 'legL' || p.key === 'legR') && p.y === 0)
    .map((p) => ({ key: p.key, x: p.x, y: p.y, w: p.w, h: p.h }));
  if (legs.length === 0) return null;
  const face = find('face');
  return {
    head: rectOf(head)!,
    torso: rectOf(torso)!,
    legs,
    armL: rectOf(find('armL')),
    armR: rectOf(find('armR')),
    eyeY: face ? face.y : head.y + Math.floor(head.h / 2),
  };
}

/** True when the base rig already carries headgear (hood, cap, puffs, cloud hair) around the top of the head. */
export function hasBaseHeadgear(rig: SpriteRig, geo: OperatorGeo): boolean {
  const top = geo.head.y + geo.head.h - 3;
  return rig.parts.some((p) => p.key === 'crest' && p.y + p.h >= top && p.y <= geo.head.y + geo.head.h + 3 && p.x < geo.head.x + geo.head.w + 4 && p.x + p.w > geo.head.x - 4);
}

/** True when a base part (visor, mask) already covers the face band. */
export function hasBaseFaceCover(rig: SpriteRig, geo: OperatorGeo): boolean {
  return rig.parts.some((p) => p.key === 'crest' && p.y <= geo.eyeY + 1 && p.y + p.h > geo.eyeY - 1 && p.x <= geo.head.x + 1 && p.x + p.w >= geo.head.x + geo.head.w - 1);
}

/** True when this rig is a plain humanoid that the detail layer can sit on. */
export function canDetailRig(rig: SpriteRig): boolean {
  const geo = readOperatorGeo(rig);
  return Boolean(geo) && rig.pixelHeight <= 32 && rig.parts.length <= 16;
}

function build(rig: SpriteRig, look: OperatorLook, geo: OperatorGeo): SpritePart[] {
  const extra: SpritePart[] = [];
  const headgear = hasBaseHeadgear(rig, geo);
  const faceCovered = hasBaseFaceCover(rig, geo);
  if (!headgear) {
    extra.push(...HAIR[look.hair]!(geo, look.hairColor));
    extra.push(...HEADWEAR[look.headwear]!(geo, look.headwearColor));
  }
  if (!faceCovered) {
    extra.push(...EYES[look.eyes]!(geo, look.eyeColor));
    extra.push(...BROWS[look.brows]!(geo, look.browColor));
    extra.push(...MOUTHS[look.mouth]!(geo, look.mouthColor));
    extra.push(...MARKS[look.mark]!(geo, look.markColor));
  }
  extra.push(...TOPS[look.top]!(geo, look.topColor));
  extra.push(...SHOULDERS[look.shoulders]!(geo, look.shoulderColor));
  extra.push(...SLEEVES[look.sleeves]!(geo, look.sleeveColor));
  extra.push(...BELTS[look.belt]!(geo, look.beltColor));
  extra.push(...LEGWEAR[look.legwear]!(geo, look.legwearColor));
  extra.push(...BOOTS[look.boots]!(geo, look.bootsColor));
  extra.push(...ACCESSORIES[look.accessory]!(geo, look.accessoryColor));
  extra.push(...BACKS[look.back]!(geo, look.backColor));
  extra.push(...HELD[look.held]!(geo, look.heldColor));
  return extra.flatMap((p) => {
    // Nothing is allowed to poke far above the sprite's frame; trim instead of dropping.
    if (p.y >= -1) return [p];
    const trimmed = p.h - (-1 - p.y);
    return trimmed >= 1 ? [{ ...p, y: -1, h: trimmed }] : [];
  });
}

/**
 * Returns a copy of `rig` with the look's features added. The base parts are
 * kept untouched (and the base face stripe is hidden once eyes are drawn), so
 * a rig with no features to add comes back identical in silhouette. The
 * original rig is never mutated.
 */
export function applyOperatorLook(rig: SpriteRig, look: OperatorLook): SpriteRig {
  const geo = readOperatorGeo(rig);
  if (!geo) return rig;
  const extra = build(rig, look, geo);
  const faceCovered = hasBaseFaceCover(rig, geo);
  const basePartsOut = rig.parts.filter((p) => !(p.key === 'face' && !faceCovered && look.eyes !== 'none'));
  // Back items and tails stick out behind the sprite; keep the shadow/aura box honest.
  // The renderer paints parts in array order and ignores `z`, so order them by it here:
  // capes and packs go behind the torso, hair and hats in front of the head. The sort is
  // stable, so parts at the same depth keep their authored order.
  const parts = [...basePartsOut, ...extra]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.z ?? 0) - (b.p.z ?? 0) || a.i - b.i)
    .map((entry) => entry.p);
  return { ...rig, parts };
}

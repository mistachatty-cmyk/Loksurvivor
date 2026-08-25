/**
 * Frame-by-frame pixel rigs.
 *
 * Every actor in the game is a small stack of pixel rectangles in a local
 * grid whose origin sits between the feet (+y is up). Animation clips move
 * those rectangles per frame, which gives real frame-by-frame motion --
 * idle bobs, walk cycles, attack poses, hit reactions and death sequences --
 * without shipping any sprite sheets.
 *
 * The factories below build rigs from a short description so adding a new
 * character or enemy stays a data change.
 */

import type { AnimClip, AnimName, SpriteRig, SpritePart } from '@/game/types';

interface HumanoidOptions {
  /** Overall silhouette height in sprite pixels. */
  height?: number;
  /** Shoulder width in sprite pixels. */
  width?: number;
  /** Seated / floating fighters keep their legs tucked. */
  seated?: boolean;
  /** Adds a floating ring above the head. */
  halo?: boolean;
  /** Adds a cap brim. */
  cap?: boolean;
  /** Adds twin hair puffs. */
  puffs?: boolean;
  /** Adds a hood shape over the head. */
  hood?: boolean;
  /** Adds wings behind the torso. */
  wings?: boolean;
  /** Head color override. */
  headColor?: SpritePart['color'];
  /** Torso color override. */
  torsoColor?: SpritePart['color'];
}

function bobClip(amount: number, frameMs: number): AnimClip {
  return {
    frameMs,
    loop: true,
    frames: [
      {},
      { head: { dy: amount }, torso: { dy: amount }, armL: { dy: amount }, armR: { dy: amount }, crest: { dy: amount } },
      { head: { dy: amount * 2 }, torso: { dy: amount }, armL: { dy: amount * 2 }, armR: { dy: amount * 2 }, crest: { dy: amount * 2 } },
      { head: { dy: amount }, torso: { dy: amount }, armL: { dy: amount }, armR: { dy: amount }, crest: { dy: amount } },
    ],
  };
}

function walkClip(seated: boolean, frameMs: number): AnimClip {
  if (seated) {
    // A cross-legged glide: the whole body leans and drifts, legs stay tucked.
    return {
      frameMs,
      loop: true,
      frames: [
        { torso: { dx: 0, dy: 1 }, head: { dx: 0, dy: 1 }, crest: { dy: 1 } },
        { torso: { dx: 1, dy: 2 }, head: { dx: 1, dy: 2 }, armR: { dy: 1 }, crest: { dx: 1, dy: 2 } },
        { torso: { dx: 1, dy: 1 }, head: { dx: 1, dy: 1 }, crest: { dx: 1, dy: 1 } },
        { torso: { dx: 0, dy: 0 }, head: { dx: 0, dy: 0 } },
        { torso: { dx: -1, dy: 1 }, head: { dx: -1, dy: 1 }, armL: { dy: 1 }, crest: { dx: -1, dy: 1 } },
        { torso: { dx: -1, dy: 2 }, head: { dx: -1, dy: 2 }, crest: { dx: -1, dy: 2 } },
      ],
    };
  }
  return {
    frameMs,
    loop: true,
    frames: [
      { legL: { dx: 1, dh: -1 }, legR: { dx: -1 }, armL: { dx: 1 }, armR: { dx: -1 } },
      { legL: { dx: 2, dh: -2 }, legR: { dx: -2, dh: -1 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 }, armL: { dx: 2, dy: 1 }, armR: { dx: -2, dy: 1 } },
      { legL: { dx: 1 }, legR: { dx: -1 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 } },
      { legL: { dx: -1 }, legR: { dx: 1, dh: -1 }, armL: { dx: -1 }, armR: { dx: 1 } },
      { legL: { dx: -2, dh: -1 }, legR: { dx: 2, dh: -2 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 }, armL: { dx: -2, dy: 1 }, armR: { dx: 2, dy: 1 } },
      { legL: { dx: -1 }, legR: { dx: 1 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 } },
    ],
  };
}

function attackClip(frameMs: number): AnimClip {
  return {
    frameMs,
    loop: false,
    frames: [
      { armR: { dx: 1, dy: 1 }, torso: { dx: -1 } },
      { armR: { dx: 4, dw: 3, dy: 2 }, torso: { dx: 1 }, head: { dx: 1 } },
      { armR: { dx: 6, dw: 4, dy: 1 }, torso: { dx: 2 }, head: { dx: 2 }, crest: { dx: 2 } },
      { armR: { dx: 3, dw: 1 }, torso: { dx: 1 }, head: { dx: 1 } },
    ],
  };
}

function hurtClip(frameMs: number): AnimClip {
  return {
    frameMs,
    loop: false,
    frames: [
      { torso: { dx: -2 }, head: { dx: -2, dy: 1 }, armL: { dx: -3 }, armR: { dx: -1 }, crest: { dx: -2 } },
      { torso: { dx: -1 }, head: { dx: -1 }, armL: { dx: -2 }, crest: { dx: -1 } },
    ],
  };
}

function deathClip(frameMs: number): AnimClip {
  // The renderer dissolves pixels on top of this, matching the reference
  // sheets' "depixelating sequence".
  return {
    frameMs,
    loop: false,
    frames: [
      { head: { dy: -1 }, torso: { dy: -1 } },
      { head: { dy: -3 }, torso: { dy: -2 }, armL: { dy: -2 }, armR: { dy: -2 }, crest: { dy: -3 } },
      { head: { dy: -5, dh: -1 }, torso: { dy: -4, dh: -1 }, armL: { dy: -4 }, armR: { dy: -4 }, crest: { dy: -6 } },
      { head: { dy: -7, dh: -2 }, torso: { dy: -6, dh: -2 }, armL: { dy: -6 }, armR: { dy: -6 }, crest: { dy: -9 } },
      { head: { dy: -8, dh: -3 }, torso: { dy: -7, dh: -4 }, armL: { dy: -7 }, armR: { dy: -7 }, crest: { dy: -12 } },
      { head: { dy: -9, dh: -4 }, torso: { dy: -8, dh: -5 }, armL: { dy: -8 }, armR: { dy: -8 }, crest: { dy: -14 } },
      { head: { dy: -9, dh: -5 }, torso: { dy: -8, dh: -6 }, armL: { dy: -9 }, armR: { dy: -9 }, crest: { dy: -16 } },
      { head: { dy: -10, dh: -6 }, torso: { dy: -9, dh: -7 }, armL: { dy: -9 }, armR: { dy: -9 }, crest: { dy: -18 } },
    ],
  };
}

function baseAnims(seated: boolean, tempo = 1): Record<AnimName, AnimClip> {
  return {
    idle: bobClip(1, 190 * tempo),
    walk: walkClip(seated, 90 * tempo),
    attack: attackClip(70 * tempo),
    hurt: hurtClip(80),
    death: deathClip(70),
  };
}

/** Upright or seated two-legged fighter. */
export function humanoidRig(options: HumanoidOptions = {}): SpriteRig {
  const {
    height = 20,
    width = 10,
    seated = false,
    halo = false,
    cap = false,
    puffs = false,
    hood = false,
    wings = false,
    headColor = 'skin',
    torsoColor = 'body',
  } = options;

  const half = Math.floor(width / 2);
  const legH = seated ? 3 : Math.round(height * 0.3);
  const torsoH = Math.round(height * 0.4);
  const headH = height - legH - torsoH;
  const parts: SpritePart[] = [];

  if (wings) {
    parts.push(
      { key: 'aura', x: -half - 5, y: legH + 2, w: 5, h: torsoH, color: 'glow', z: 0 },
      { key: 'aura', x: half, y: legH + 2, w: 5, h: torsoH, color: 'glow', z: 0 },
    );
  }

  if (seated) {
    parts.push({ key: 'legL', x: -half - 1, y: 0, w: width + 2, h: legH, color: 'bodyDark', z: 1 });
  } else {
    parts.push(
      { key: 'legL', x: -half + 1, y: 0, w: 3, h: legH, color: 'bodyDark', z: 1 },
      { key: 'legR', x: half - 4, y: 0, w: 3, h: legH, color: 'bodyDark', z: 1 },
    );
  }

  parts.push(
    { key: 'armL', x: -half - 2, y: legH + 1, w: 2, h: torsoH - 1, color: 'bodyDark', z: 2 },
    { key: 'torso', x: -half, y: legH, w: width, h: torsoH, color: torsoColor, z: 3 },
    { key: 'armR', x: half, y: legH + 1, w: 2, h: torsoH - 1, color: 'bodyDark', z: 4 },
    { key: 'head', x: -half + 1, y: legH + torsoH, w: width - 2, h: headH, color: headColor, z: 5 },
    { key: 'face', x: -half + 2, y: legH + torsoH + Math.floor(headH / 2), w: width - 4, h: 2, color: 'accentBright', z: 6 },
  );

  if (hood) {
    parts.push({ key: 'crest', x: -half, y: legH + torsoH + headH - 2, w: width, h: 3, color: 'bodyDark', z: 6 });
  }
  if (cap) {
    parts.push({ key: 'crest', x: -half, y: legH + torsoH + headH - 1, w: width + 2, h: 2, color: 'accent', z: 7 });
  }
  if (puffs) {
    parts.push(
      { key: 'crest', x: -half - 2, y: legH + torsoH + headH - 3, w: 3, h: 4, color: 'ink', z: 7 },
      { key: 'crest', x: half - 1, y: legH + torsoH + headH - 3, w: 3, h: 4, color: 'ink', z: 7 },
    );
  }
  if (halo) {
    parts.push({ key: 'crest', x: -half + 1, y: legH + torsoH + headH + 2, w: width - 2, h: 1, color: 'glow', z: 8 });
  }

  return { pixelHeight: height + (halo ? 3 : 0), parts, anims: baseAnims(seated) };
}

interface QuadrupedOptions {
  height?: number;
  length?: number;
  /** Adds tall ears. */
  ears?: boolean;
}

/** Four-legged actor -- used for the meditating llama. */
export function quadrupedRig(options: QuadrupedOptions = {}): SpriteRig {
  const { height = 18, length = 14, ears = true } = options;
  const legH = Math.round(height * 0.32);
  const bodyH = Math.round(height * 0.34);
  const neckH = height - legH - bodyH;
  const half = Math.floor(length / 2);

  const parts: SpritePart[] = [
    { key: 'legL', x: -half + 1, y: 0, w: 2, h: legH, color: 'bodyDark', z: 1 },
    { key: 'legR', x: half - 3, y: 0, w: 2, h: legH, color: 'bodyDark', z: 1 },
    { key: 'armL', x: -half + 4, y: 0, w: 2, h: legH, color: 'bodyDark', z: 1 },
    { key: 'armR', x: half - 6, y: 0, w: 2, h: legH, color: 'bodyDark', z: 1 },
    { key: 'torso', x: -half, y: legH, w: length, h: bodyH, color: 'body', z: 2 },
    { key: 'head', x: half - 6, y: legH + bodyH, w: 5, h: neckH, color: 'body', z: 3 },
    { key: 'face', x: half - 5, y: legH + bodyH + Math.max(1, neckH - 3), w: 3, h: 1, color: 'accent', z: 4 },
  ];

  if (ears) {
    parts.push({ key: 'crest', x: half - 6, y: legH + bodyH + neckH, w: 1, h: 3, color: 'body', z: 4 });
    parts.push({ key: 'crest', x: half - 3, y: legH + bodyH + neckH, w: 1, h: 3, color: 'body', z: 4 });
  }

  const anims = baseAnims(false, 1.15);
  anims.walk = {
    frameMs: 100,
    loop: true,
    frames: [
      { legL: { dh: -1 }, armR: { dh: -1 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 } },
      { legR: { dh: -1 }, armL: { dh: -1 } },
      { legL: { dh: -2 }, armR: { dh: -2 }, torso: { dy: 1 }, head: { dy: 1 }, crest: { dy: 1 } },
      { legR: { dh: -2 }, armL: { dh: -2 } },
    ],
  };
  return { pixelHeight: height + 3, parts, anims };
}

interface BlobOptions {
  height?: number;
  width?: number;
  /** Adds a spiked crown of pixels. */
  spikes?: boolean;
  /** Adds trailing tendrils below the body. */
  tendrils?: boolean;
}

/** Drifting, legless silhouettes -- wisps, leeches and swarms. */
export function blobRig(options: BlobOptions = {}): SpriteRig {
  const { height = 12, width = 10, spikes = false, tendrils = false } = options;
  const half = Math.floor(width / 2);
  const parts: SpritePart[] = [
    { key: 'torso', x: -half, y: 2, w: width, h: height - 4, color: 'body', z: 2 },
    { key: 'head', x: -half + 1, y: height - 5, w: width - 2, h: 4, color: 'bodyDark', z: 3 },
    { key: 'face', x: -half + 2, y: height - 4, w: width - 4, h: 2, color: 'accentBright', z: 4 },
  ];
  if (spikes) {
    parts.push(
      { key: 'crest', x: -half, y: height - 1, w: 2, h: 2, color: 'accent', z: 4 },
      { key: 'crest', x: half - 2, y: height - 1, w: 2, h: 2, color: 'accent', z: 4 },
    );
  }
  if (tendrils) {
    parts.push(
      { key: 'legL', x: -half + 1, y: 0, w: 2, h: 3, color: 'bodyDark', z: 1 },
      { key: 'legR', x: half - 3, y: 0, w: 2, h: 3, color: 'bodyDark', z: 1 },
    );
  }

  const anims = baseAnims(false, 1);
  anims.idle = bobClip(1, 160);
  anims.walk = {
    frameMs: 120,
    loop: true,
    frames: [
      { torso: { dy: 1 }, head: { dy: 1 }, face: { dy: 1 }, crest: { dy: 1 } },
      { torso: { dy: 2 }, head: { dy: 3 }, face: { dy: 3 }, crest: { dy: 3 }, legL: { dh: 1 }, legR: { dh: 2 } },
      { torso: { dy: 1 }, head: { dy: 2 }, face: { dy: 2 }, crest: { dy: 2 } },
      { torso: { dy: 0 }, head: { dy: 0 }, legL: { dh: 2 }, legR: { dh: 1 } },
    ],
  };
  return { pixelHeight: height, parts, anims };
}

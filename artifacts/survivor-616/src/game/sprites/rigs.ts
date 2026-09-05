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
  /** Adds a tall arcane staff silhouette to the fighter's right side. */
  staff?: boolean;
  /** Adds wings behind the torso. */
  wings?: boolean;
  /** Head color override. */
  headColor?: SpritePart['color'];
  /** Torso color override. */
  torsoColor?: SpritePart['color'];
  /** Widens the torso and shortens the legs for a heavy, tank-like silhouette. */
  bulk?: boolean;
  /** Narrows the frame and drops the head low for a small, hunched silhouette. */
  hunched?: boolean;
  /** Replaces the head block with a wider, textured cluster -- a cloud or afro silhouette. */
  cloudHair?: boolean;
  /** Replaces the two thin legs with a single wide, stepped base -- flared trousers or a hakama stance. */
  flarePants?: boolean;
}

export type ExpressiveStyle = 'prism' | 'flame' | 'spiral' | 'river' | 'astral';

/**
 * A deliberately exaggerated pixel language for new moodboard-inspired
 * characters. It composes with the familiar humanoid rig so collision and
 * animation contracts stay unchanged while the silhouette gets a signature.
 */
export function expressiveRig(style: ExpressiveStyle, height = 21): SpriteRig {
  const rig = humanoidRig({
    height,
    width: style === 'flame' ? 10 : style === 'astral' ? 9 : 11,
    hood: style === 'spiral',
    halo: style === 'astral',
    staff: style === 'prism' || style === 'astral',
    headColor: style === 'spiral' ? 'bodyDark' : 'skin',
    torsoColor: style === 'flame' ? 'bodyDark' : 'body',
  });
  const top = height + (style === 'astral' ? 5 : 1);
  const signature: SpritePart[] = [];
  if (style === 'prism') {
    signature.push(
      { key: 'aura', x: -9, y: top - 8, w: 3, h: 7, color: 'accent', z: 0 },
      { key: 'aura', x: 6, y: top - 8, w: 3, h: 7, color: 'glow', z: 0 },
      { key: 'crest', x: -3, y: top + 1, w: 2, h: 2, color: 'accentBright', z: 9 },
      { key: 'crest', x: 1, y: top + 3, w: 2, h: 2, color: 'accent', z: 9 },
    );
  } else if (style === 'flame') {
    signature.push(
      { key: 'crest', x: -4, y: top, w: 3, h: 5, color: 'accent', z: 8 },
      { key: 'crest', x: 0, y: top + 2, w: 3, h: 6, color: 'accentBright', z: 9 },
      { key: 'aura', x: -7, y: 2, w: 2, h: 5, color: 'glow', z: 0 },
      { key: 'aura', x: 5, y: 4, w: 2, h: 4, color: 'accent', z: 0 },
    );
  } else if (style === 'spiral') {
    signature.push(
      { key: 'face', x: -4, y: top - 5, w: 2, h: 2, color: 'glow', z: 8 },
      { key: 'face', x: 2, y: top - 5, w: 2, h: 2, color: 'glow', z: 8 },
      { key: 'aura', x: -8, y: 5, w: 2, h: 8, color: 'accent', z: 0 },
      { key: 'aura', x: 6, y: 7, w: 2, h: 6, color: 'glow', z: 0 },
    );
  } else if (style === 'river') {
    signature.push(
      { key: 'crest', x: -6, y: top, w: 2, h: 6, color: 'accent', z: 8 },
      { key: 'crest', x: 4, y: top + 1, w: 2, h: 5, color: 'accent', z: 8 },
      { key: 'aura', x: -8, y: 1, w: 3, h: 6, color: 'glow', z: 0 },
      { key: 'aura', x: 5, y: 2, w: 3, h: 5, color: 'accent', z: 0 },
    );
  } else {
    signature.push(
      { key: 'aura', x: -10, y: top - 4, w: 2, h: 2, color: 'accent', z: 0 },
      { key: 'aura', x: 8, y: top - 1, w: 2, h: 2, color: 'glow', z: 0 },
      { key: 'crest', x: -2, y: top + 4, w: 4, h: 1, color: 'accentBright', z: 9 },
    );
  }
  rig.parts.push(...signature);
  const offset = style === 'flame' ? 1 : style === 'river' ? 1.15 : 1;
  rig.anims.idle = bobClip(style === 'river' ? 2 : 1, 150 * offset);
  rig.anims.attack = {
    frameMs: 64,
    loop: false,
    frames: [
      { armR: { dx: -2, dy: -1 }, torso: { dx: -1 }, aura: { dx: -1 } },
      { armR: { dx: 2, dy: 2, dw: 2 }, torso: { dx: 1 }, crest: { dy: 2 } },
      { armR: { dx: 6, dy: 1, dw: 4 }, torso: { dx: 2 }, head: { dx: 2 }, aura: { dx: 3, dw: 2 } },
      { armR: { dx: 2 }, torso: { dx: 1 }, head: { dx: 1 } },
    ],
  };
  return rig;
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
    staff = false,
    wings = false,
    headColor = 'skin',
    torsoColor = 'body',
    bulk = false,
    hunched = false,
    cloudHair = false,
    flarePants = false,
  } = options;

  const effectiveWidth = width + (bulk ? 3 : 0) - (hunched ? 2 : 0);
  const half = Math.floor(effectiveWidth / 2);
  let legH = seated ? 3 : Math.round(height * 0.3);
  let torsoH = Math.round(height * 0.4);
  if (bulk) {
    // Heavier torso, shorter legs -- reads as low-slung and hard to knock over.
    legH = seated ? 3 : Math.round(height * 0.22);
    torsoH = Math.round(height * 0.5);
  } else if (hunched) {
    // Smaller torso, head sits lower on the frame -- reads as scrappy and compact.
    legH = seated ? 3 : Math.round(height * 0.28);
    torsoH = Math.round(height * 0.32);
  }
  const headH = height - legH - torsoH;
  const parts: SpritePart[] = [];

  if (wings) {
    parts.push(
      { key: 'aura', x: -half - 5, y: legH + 2, w: 5, h: torsoH, color: 'glow', z: 0 },
      { key: 'aura', x: half, y: legH + 2, w: 5, h: torsoH, color: 'glow', z: 0 },
    );
  }

  if (seated) {
    parts.push({ key: 'legL', x: -half - 1, y: 0, w: effectiveWidth + 2, h: legH, color: 'bodyDark', z: 1 });
  } else if (flarePants) {
    // A single wide, stepped base -- wider than the torso, like flared
    // trousers or a hakama stance -- instead of two thin legs.
    parts.push({ key: 'legL', x: -half - 3, y: 0, w: effectiveWidth + 6, h: legH, color: 'bodyDark', z: 1 });
  } else {
    parts.push(
      { key: 'legL', x: -half + 1, y: 0, w: 3, h: legH, color: 'bodyDark', z: 1 },
      { key: 'legR', x: half - 4, y: 0, w: 3, h: legH, color: 'bodyDark', z: 1 },
    );
  }

  parts.push(
    { key: 'armL', x: -half - 2, y: legH + 1, w: 2, h: torsoH - 1, color: 'bodyDark', z: 2 },
    { key: 'torso', x: -half, y: legH, w: effectiveWidth, h: torsoH, color: torsoColor, z: 3 },
    { key: 'armR', x: half, y: legH + 1, w: 2, h: torsoH - 1, color: 'bodyDark', z: 4 },
    { key: 'head', x: -half + 1, y: legH + torsoH, w: effectiveWidth - 2, h: headH, color: headColor, z: 5 },
    { key: 'face', x: -half + 2, y: legH + torsoH + Math.floor(headH / 2), w: effectiveWidth - 4, h: 2, color: 'accentBright', z: 6 },
  );

  if (cloudHair) {
    // A wider, textured cluster standing in for a single head block --
    // a handful of offset squares read as a cloud or afro silhouette.
    const cloudY = legH + torsoH + headH;
    parts.push(
      { key: 'crest', x: -half - 2, y: cloudY - 3, w: effectiveWidth + 4, h: 3, color: headColor, z: 6 },
      { key: 'crest', x: -half - 3, y: cloudY - 1, w: 3, h: 3, color: headColor, z: 6 },
      { key: 'crest', x: half, y: cloudY - 1, w: 3, h: 3, color: headColor, z: 6 },
      { key: 'crest', x: -half, y: cloudY + 1, w: effectiveWidth - 1, h: 2, color: headColor, z: 6 },
    );
  }
  if (hood) {
    parts.push({ key: 'crest', x: -half, y: legH + torsoH + headH - 2, w: effectiveWidth, h: 3, color: 'bodyDark', z: 6 });
  }
  if (staff) {
    parts.push(
      { key: 'aura', x: half + 3, y: 0, w: 2, h: height + 5, color: 'bodyDark', z: 1 },
      { key: 'crest', x: half + 1, y: height + 3, w: 6, h: 2, color: 'accent', z: 8 },
      { key: 'crest', x: half + 3, y: height + 5, w: 2, h: 3, color: 'accentBright', z: 9 },
    );
  }
  if (cap) {
    parts.push({ key: 'crest', x: -half, y: legH + torsoH + headH - 1, w: effectiveWidth + 2, h: 2, color: 'accent', z: 7 });
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

  return { pixelHeight: height + (halo ? 3 : 0) + (cloudHair ? 2 : 0), parts, anims: baseAnims(seated) };
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
  /** Adds a pair of side wings, for small fliers. */
  wings?: boolean;
}

/** Drifting, legless silhouettes -- wisps, leeches and swarms. */
export function blobRig(options: BlobOptions = {}): SpriteRig {
  const { height = 12, width = 10, spikes = false, tendrils = false, wings = false } = options;
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
  if (wings) {
    parts.push(
      { key: 'armL', x: -half - 4, y: height - 6, w: 4, h: 4, color: 'accent', z: 1 },
      { key: 'armR', x: half, y: height - 6, w: 4, h: 4, color: 'accent', z: 1 },
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

/** Angular, mask-like silhouettes for characters that should not read as human. */
export function triangleRig(height = 21): SpriteRig {
  const parts: SpritePart[] = [
    { key: 'shadow', x: -7, y: 0, w: 14, h: 2, color: 'ink', z: 0 },
    { key: 'torso', x: -8, y: 3, w: 16, h: 12, color: 'body', z: 2 },
    { key: 'head', x: -5, y: 15, w: 10, h: 5, color: 'bodyDark', z: 3 },
    { key: 'face', x: -3, y: 17, w: 6, h: 2, color: 'accentBright', z: 4 },
    { key: 'crest', x: -2, y: 20, w: 4, h: 5, color: 'accent', z: 5 },
    { key: 'legL', x: -6, y: 0, w: 3, h: 4, color: 'bodyDark', z: 1 },
    { key: 'legR', x: 3, y: 0, w: 3, h: 4, color: 'bodyDark', z: 1 },
  ];
  const anims = baseAnims(false, 0.9);
  anims.walk = { frameMs: 95, loop: true, frames: [
    { torso: { dx: -1, dy: 1 }, crest: { dx: -1 }, legL: { dh: -1 } },
    { torso: { dx: 1 }, crest: { dx: 1 }, legR: { dh: -1 } },
  ] };
  return { pixelHeight: height, parts, anims };
}

/** Long, translucent-feeling swimmers; the body moves as a single ribbon. */
export function eelRig(height = 16): SpriteRig {
  const parts: SpritePart[] = [
    { key: 'shadow', x: -11, y: 0, w: 22, h: 2, color: 'ink', z: 0 },
    { key: 'torso', x: -12, y: 4, w: 20, h: 6, color: 'body', z: 2 },
    { key: 'head', x: 7, y: 5, w: 7, h: 7, color: 'bodyDark', z: 3 },
    { key: 'face', x: 11, y: 8, w: 2, h: 2, color: 'accentBright', z: 4 },
    { key: 'crest', x: -13, y: 6, w: 4, h: 4, color: 'accent', z: 1 },
  ];
  const anims = baseAnims(false, 0.75);
  anims.walk = { frameMs: 100, loop: true, frames: [
    { torso: { dy: 1 }, head: { dy: 2 }, crest: { dy: -1 } },
    { torso: { dy: -1 }, head: { dy: -2 }, crest: { dy: 1 } },
  ] };
  return { pixelHeight: height, parts, anims };
}

interface ArachnidOptions {
  /** Body block height in sprite pixels. */
  height?: number;
  /** How far the legs reach from the body center. */
  span?: number;
  /** Legs per side -- 3 = six legs, 4 = eight legs. Both sides push extra
   *  parts onto the same `legL`/`legR` keys, so they all animate together;
   *  the walk clip only needs to know about two sides, not N legs. */
  legPairs?: number;
}

/**
 * Many-legged, low, wide silhouette -- built entirely from the same limb
 * keys a two-legged rig uses (`legL`/`legR`), just with several parts
 * stacked on each key. Reads as unmistakably non-human at a glance without
 * needing new animation plumbing. See run-presentation.md.
 */
export function arachnidRig(options: ArachnidOptions = {}): SpriteRig {
  const { height = 9, span = 13, legPairs = 3 } = options;
  const bodyW = 11;
  const half = Math.floor(bodyW / 2);
  const parts: SpritePart[] = [
    { key: 'shadow', x: -span, y: 0, w: span * 2, h: 2, color: 'ink', z: 0 },
    { key: 'torso', x: -half, y: 2, w: bodyW, h: height, color: 'body', z: 3 },
    { key: 'head', x: -half + 2, y: height + 1, w: bodyW - 4, h: 4, color: 'bodyDark', z: 4 },
    { key: 'face', x: -half + 3, y: height + 2, w: bodyW - 6, h: 2, color: 'accentBright', z: 5 },
    { key: 'crest', x: -half - 2, y: height + 1, w: 2, h: 3, color: 'accent', z: 4 },
    { key: 'crest', x: half, y: height + 1, w: 2, h: 3, color: 'accent', z: 4 },
  ];
  for (let i = 0; i < legPairs; i += 1) {
    const t = legPairs === 1 ? 0.5 : i / (legPairs - 1);
    const y = 1 + t * (height - 2);
    const reach = span * (0.55 + t * 0.45);
    parts.push({ key: 'legL', x: -reach, y, w: reach - half, h: 2, color: 'bodyDark', z: 1 });
    parts.push({ key: 'legR', x: half, y, w: reach - half, h: 2, color: 'bodyDark', z: 1 });
  }
  return { pixelHeight: height + 5, parts, anims: baseAnims(false, 1.1) };
}

interface SerpentOptions {
  /** Overall body length, nose to tail, in sprite pixels. */
  length?: number;
  /** Visible body segments; alternating segments animate on opposite phase
   *  (reusing `legL`/`legR` as the two phase groups) for a real slither
   *  instead of one rigid block bobbing. */
  segments?: number;
}

/**
 * A tapering chain of segments -- no legs, no arms, no torso block. Drifts
 * and winds rather than walks. Distinct from `eelRig` (one flat ribbon +
 * head) and `blobRig` (round, static): this one visibly undulates.
 * See run-presentation.md.
 */
export function serpentRig(options: SerpentOptions = {}): SpriteRig {
  const { length = 26, segments = 5 } = options;
  const segLen = length / segments;
  const half = length / 2;
  const parts: SpritePart[] = [
    { key: 'shadow', x: -half, y: 0, w: length, h: 2, color: 'ink', z: 0 },
  ];
  for (let i = 0; i < segments; i += 1) {
    const t = segments === 1 ? 1 : i / (segments - 1); // 0 tail .. 1 head
    const segH = 3 + t * 5; // tapers narrow at the tail, wide near the head
    const isHead = i === segments - 1;
    parts.push({
      key: isHead ? 'head' : i % 2 === 0 ? 'legL' : 'legR',
      x: -half + i * segLen,
      y: 3,
      w: segLen + 1,
      h: segH,
      color: isHead ? 'bodyDark' : 'body',
      z: 2 + i,
    });
  }
  parts.push({ key: 'face', x: half - 4, y: 5, w: 3, h: 2, color: 'accentBright', z: 9 });
  parts.push({ key: 'crest', x: -half - 2, y: 3, w: 3, h: 4, color: 'accent', z: 1 });

  const anims = baseAnims(false, 0.85);
  anims.idle = bobClip(1, 170);
  anims.walk = {
    frameMs: 110,
    loop: true,
    frames: [
      { legL: { dy: 2 }, legR: { dy: -2 }, head: { dy: 1 }, crest: { dy: -1 } },
      { legL: { dy: -2 }, legR: { dy: 2 }, head: { dy: -1 }, crest: { dy: 1 } },
    ],
  };
  return { pixelHeight: 12, parts, anims };
}

/** Oversized mascot silhouette with a readable wind-up and impact pose. */
export function giantRig(height = 28): SpriteRig {
  const rig = humanoidRig({ height, width: 18, headColor: 'bodyDark', torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -12, y: height - 2, w: 5, h: 5, color: 'accent', z: 8 },
    { key: 'crest', x: 7, y: height - 2, w: 5, h: 5, color: 'accent', z: 8 },
  );
  rig.anims.attack = {
    frameMs: 85, loop: false, frames: [
      { armR: { dx: -5, dy: 2 }, torso: { dx: -2 } },
      { armR: { dx: 8, dw: 8, dy: -2 }, torso: { dx: 3 }, head: { dx: 2 } },
      { armR: { dx: 10, dw: 10 }, torso: { dx: 4 }, head: { dx: 3 } },
    ],
  };
  return rig;
}

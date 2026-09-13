import { arachnidRig, blobRig, eelRig, expressiveRig, giantRig, humanoidRig, quadrupedRig, serpentRig, triangleRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';
import { palette } from './authoring';
import { REACTION_PRESETS } from './reactivity';

/** Static Nomad's rig: a cloud-afro head, metallic arms and a flared trouser stance, plus a floating electrified trail. */
function staticNomadRig(): SpriteRig {
  const rig = humanoidRig({ height: 20, width: 11, cloudHair: true, flarePants: true, headColor: 'accentBright', torsoColor: 'body' });
  rig.parts.push(
    { key: 'aura', x: -9, y: 8, w: 2, h: 4, color: 'accent', z: 0 },
    { key: 'aura', x: 7, y: 10, w: 2, h: 4, color: 'glow', z: 0 },
    { key: 'crest', x: -8, y: 21, w: 2, h: 2, color: 'accentBright', z: 9 },
    { key: 'crest', x: 6, y: 23, w: 2, h: 2, color: 'accentBright', z: 9 },
  );
  return rig;
}

/** Ember Ascetic's rig: a dark forge-silhouette body with glowing eyes, a flared hakama stance and an orbiting thermal aura. */
function emberAsceticRig(): SpriteRig {
  const rig = humanoidRig({ height: 22, width: 10, flarePants: true, headColor: 'ink', torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -4, y: 23, w: 3, h: 5, color: 'accent', z: 8 },
    { key: 'crest', x: 0, y: 25, w: 3, h: 6, color: 'glow', z: 9 },
    { key: 'aura', x: -8, y: 2, w: 2, h: 6, color: 'glow', z: 0 },
    { key: 'aura', x: 6, y: 4, w: 2, h: 5, color: 'accent', z: 0 },
  );
  return rig;
}

/** Switchback reads as a courier in a cropped jacket, route visor and trailing signal ribbons. */
function switchbackRig(): SpriteRig {
  const rig = humanoidRig({ height: 19, width: 9, cap: true, torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'crest', x: -7, y: 18, w: 14, h: 2, color: 'accentBright', z: 9 },
    { key: 'aura', x: -11, y: 8, w: 8, h: 2, color: 'accent', z: 0 },
    { key: 'aura', x: 5, y: 4, w: 10, h: 2, color: 'glow', z: 0 },
  );
  return rig;
}

/** Bellwether has a broad coat, bell-shaped shoulder guards and a grounded luminous stance. */
function bellwetherRig(): SpriteRig {
  const rig = humanoidRig({ height: 23, width: 14, flarePants: true, hood: true, torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -10, y: 12, w: 5, h: 7, color: 'accent', z: 7 },
    { key: 'crest', x: 5, y: 12, w: 5, h: 7, color: 'accent', z: 7 },
    { key: 'aura', x: -12, y: 0, w: 24, h: 2, color: 'glow', z: 0 },
  );
  return rig;
}

/** 2026-09-09 legendary silhouettes: procedural, cheap, and intentionally extreme. */
function bellwrightRig(): SpriteRig {
  const rig = humanoidRig({ height: 26, width: 8, hood: true, torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -12, y: 5, w: 4, h: 18, color: 'body', z: 0 },
    { key: 'aura', x: 8, y: 5, w: 4, h: 18, color: 'body', z: 0 },
    { key: 'aura', x: -8, y: 21, w: 16, h: 4, color: 'accent', z: 0 },
    { key: 'aura', x: -8, y: 3, w: 16, h: 4, color: 'accent', z: 0 },
  );
  return rig;
}

function mawheelRig(): SpriteRig {
  const rig = humanoidRig({ height: 17, width: 12, seated: true, hunched: true, headColor: 'ink', torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'legL', x: -11, y: -1, w: 22, h: 4, color: 'bodyDark', z: 0 },
    { key: 'legL', x: -11, y: 13, w: 22, h: 4, color: 'bodyDark', z: 0 },
    { key: 'legL', x: -12, y: 3, w: 4, h: 10, color: 'accent', z: 0 },
    { key: 'legR', x: 8, y: 3, w: 4, h: 10, color: 'accent', z: 0 },
  );
  return rig;
}

function lanternWidowRig(): SpriteRig {
  const rig = humanoidRig({ height: 27, width: 6, hood: true, torsoColor: 'ink' });
  for (let arm = 0; arm < 3; arm += 1) {
    const y = 5 + arm * 7;
    rig.parts.push(
      { key: 'armL', x: -15 + arm, y, w: 10, h: 2, color: arm % 2 ? 'glow' : 'accent', z: 1 },
      { key: 'armR', x: 5, y: y + 2, w: 10 - arm, h: 2, color: arm % 2 ? 'accent' : 'glow', z: 1 },
      { key: 'crest', x: -16 + arm, y: y - 2, w: 2, h: 4, color: 'accentBright', z: 8 },
      { key: 'crest', x: 13 - arm, y, w: 2, h: 4, color: 'accentBright', z: 8 },
    );
  }
  return rig;
}

function brassbackRig(): SpriteRig {
  const rig = humanoidRig({ height: 19, width: 18, bulk: true, headColor: 'bodyDark', torsoColor: 'body' });
  rig.parts.unshift({ key: 'aura', x: -14, y: 2, w: 28, h: 13, color: 'bodyDark', z: 0 });
  rig.parts.push(
    { key: 'crest', x: 5, y: 18, w: 5, h: 11, color: 'bodyDark', z: 8 },
    { key: 'aura', x: 6, y: 30, w: 3, h: 4, color: 'glow', z: 0 },
    { key: 'aura', x: 3, y: 34, w: 4, h: 3, color: 'accentBright', z: 0 },
  );
  rig.pixelHeight = 37;
  return rig;
}

function paperSaintRig(): SpriteRig {
  const rig = humanoidRig({ height: 30, width: 5, wings: true, headColor: 'body', torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'aura', x: -18, y: 8, w: 13, h: 3, color: 'accentBright', z: 0 },
    { key: 'aura', x: -15, y: 11, w: 10, h: 8, color: 'body', z: 0 },
    { key: 'aura', x: 5, y: 8, w: 13, h: 3, color: 'accentBright', z: 0 },
    { key: 'aura', x: 5, y: 11, w: 10, h: 8, color: 'body', z: 0 },
    { key: 'crest', x: -1, y: 32, w: 2, h: 7, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 39;
  return rig;
}

function eclipsePilgrimRig(): SpriteRig {
  const rig = humanoidRig({ height: 27, width: 9, hood: true, flarePants: true, headColor: 'ink', torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -12, y: 4, w: 7, h: 22, color: 'body', z: 0 },
    { key: 'aura', x: -7, y: 22, w: 17, h: 4, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -7, y: 33, w: 14, h: 10, color: 'ink', z: 8 },
    { key: 'crest', x: 3, y: 35, w: 5, h: 7, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 43;
  return rig;
}

function bloomheartRig(): SpriteRig {
  const rig = blobRig({ height: 19, width: 24, spikes: true, tendrils: true });
  rig.parts.push(
    { key: 'crest', x: -10, y: 18, w: 3, h: 12, color: 'bodyDark', z: 7 },
    { key: 'crest', x: 7, y: 18, w: 3, h: 12, color: 'bodyDark', z: 7 },
    { key: 'crest', x: -15, y: 27, w: 8, h: 3, color: 'accent', z: 8 },
    { key: 'crest', x: 7, y: 27, w: 8, h: 3, color: 'accent', z: 8 },
    { key: 'face', x: -4, y: 8, w: 8, h: 8, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 31;
  return rig;
}

function marionetteKingRig(): SpriteRig {
  const rig = humanoidRig({ height: 26, width: 6, headColor: 'skin', torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'crest', x: -5, y: 27, w: 10, h: 3, color: 'accent', z: 8 },
    { key: 'crest', x: -4, y: 30, w: 2, h: 5, color: 'accentBright', z: 9 },
    { key: 'crest', x: 2, y: 30, w: 2, h: 5, color: 'accentBright', z: 9 },
    { key: 'aura', x: -8, y: 34, w: 16, h: 6, color: 'skin', z: 0 },
    { key: 'aura', x: -3, y: 25, w: 1, h: 12, color: 'glow', z: 0 },
    { key: 'aura', x: 3, y: 25, w: 1, h: 12, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 40;
  return rig;
}

function cryoMantisRig(): SpriteRig {
  const rig = humanoidRig({ height: 26, width: 8, hunched: true, headColor: 'bodyDark', torsoColor: 'body' });
  rig.parts.push(
    { key: 'armL', x: -17, y: 17, w: 13, h: 2, color: 'accentBright', z: 7 },
    { key: 'armL', x: -14, y: 9, w: 10, h: 2, color: 'glow', z: 6 },
    { key: 'armR', x: 4, y: 17, w: 13, h: 2, color: 'accentBright', z: 7 },
    { key: 'armR', x: 4, y: 9, w: 10, h: 2, color: 'glow', z: 6 },
    { key: 'crest', x: -5, y: 27, w: 3, h: 8, color: 'accent', z: 8 },
    { key: 'crest', x: 2, y: 27, w: 3, h: 8, color: 'accent', z: 8 },
  );
  rig.pixelHeight = 35;
  return rig;
}

function neonLeviathanRig(): SpriteRig {
  const rig = serpentRig({ length: 44, segments: 8 });
  rig.parts.push(
    { key: 'aura', x: -17, y: 9, w: 8, h: 6, color: 'accent', z: 7 },
    { key: 'aura', x: -1, y: 10, w: 9, h: 6, color: 'glow', z: 7 },
    { key: 'crest', x: -19, y: 5, w: 34, h: 2, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 17;
  return rig;
}

/** Tall split-coat profile with a pendulum mic ticking beside the body. */
function meterMonkRig(): SpriteRig {
  const rig = humanoidRig({ height: 27, width: 7, hood: true, flarePants: true, torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'crest', x: -2, y: 31, w: 4, h: 2, color: 'glow', z: 9 },
    { key: 'aura', x: 10, y: 5, w: 2, h: 22, color: 'accent', z: 0 },
    { key: 'aura', x: 7, y: 4, w: 8, h: 2, color: 'accentBright', z: 0 },
  );
  rig.pixelHeight = 33;
  return rig;
}

/** Wide turntable shoulders and a vinyl disc halo create a low, broad read. */
function vinylHexRig(): SpriteRig {
  const rig = humanoidRig({ height: 18, width: 18, bulk: true, cap: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -17, y: 12, w: 34, h: 4, color: 'bodyDark', z: 0 },
    { key: 'aura', x: -13, y: 22, w: 26, h: 3, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -3, y: 25, w: 6, h: 2, color: 'glow', z: 9 },
    { key: 'crest', x: -1, y: 23, w: 2, h: 6, color: 'accentBright', z: 9 },
  );
  rig.pixelHeight = 29;
  return rig;
}

/** Hooded singer with two tall speaker-wings and an empty glowing face. */
function hookGhostRig(): SpriteRig {
  const rig = humanoidRig({ height: 23, width: 8, hood: true, seated: true, headColor: 'ink', torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -17, y: 3, w: 7, h: 25, color: 'body', z: 0 },
    { key: 'aura', x: 10, y: 3, w: 7, h: 25, color: 'body', z: 0 },
  );
  rig.parts.push(
    { key: 'face', x: -3, y: 22, w: 6, h: 2, color: 'glow', z: 9 },
    { key: 'crest', x: -15, y: 9, w: 3, h: 3, color: 'accentBright', z: 8 },
    { key: 'crest', x: 12, y: 16, w: 3, h: 3, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 30;
  return rig;
}

/** Asymmetric card-fan coat with one oversized glowing binder sleeve. */
function sleeveCollectorRig(): SpriteRig {
  const rig = humanoidRig({ height: 21, width: 10, cap: true, torsoColor: 'bodyDark' });
  rig.parts.unshift({ key: 'aura', x: 5, y: 3, w: 13, h: 22, color: 'body', z: 0 });
  for (let card = 0; card < 4; card += 1) {
    rig.parts.push({ key: 'crest', x: -16 + card * 3, y: 7 + card * 4, w: 6, h: 8, color: card % 2 ? 'accent' : 'accentBright', z: 8 });
  }
  rig.parts.push(
    { key: 'face', x: -3, y: 23, w: 6, h: 2, color: 'glow', z: 9 },
    { key: 'aura', x: 8, y: 7, w: 7, h: 13, color: 'glow', z: 1 },
  );
  rig.pixelHeight = 31;
  return rig;
}

function crateSageRig(): SpriteRig {
  const rig = humanoidRig({ height: 18, width: 17, bulk: true, hood: true, torsoColor: 'bodyDark' });
  rig.parts.unshift({ key: 'aura', x: -14, y: 0, w: 28, h: 16, color: 'body', z: 0 });
  rig.parts.push(
    { key: 'crest', x: -12, y: 5, w: 4, h: 9, color: 'accent', z: 8 },
    { key: 'crest', x: 8, y: 5, w: 4, h: 9, color: 'accentBright', z: 8 },
    { key: 'face', x: -5, y: 20, w: 10, h: 2, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 27;
  return rig;
}

function foilOracleRig(): SpriteRig {
  const rig = humanoidRig({ height: 28, width: 5, halo: true, staff: true, torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'aura', x: -15, y: 7, w: 10, h: 2, color: 'accent', z: 0 },
    { key: 'aura', x: -12, y: 12, w: 8, h: 2, color: 'glow', z: 0 },
    { key: 'aura', x: -9, y: 17, w: 6, h: 2, color: 'accentBright', z: 0 },
  );
  rig.pixelHeight = 36;
  return rig;
}

function crownBinderRig(): SpriteRig {
  const rig = humanoidRig({ height: 24, width: 15, flarePants: true, torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -9, y: 27, w: 4, h: 8, color: 'accent', z: 8 },
    { key: 'crest', x: -2, y: 29, w: 4, h: 10, color: 'glow', z: 9 },
    { key: 'crest', x: 5, y: 27, w: 4, h: 8, color: 'accent', z: 8 },
    { key: 'aura', x: -18, y: 4, w: 6, h: 18, color: 'accentBright', z: 0 },
    { key: 'aura', x: 12, y: 4, w: 6, h: 18, color: 'accentBright', z: 0 },
  );
  rig.pixelHeight = 39;
  return rig;
}

function packSupremeRig(): SpriteRig {
  const rig = humanoidRig({ height: 30, width: 20, bulk: true, wings: true, halo: true, torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -22, y: 0, w: 44, h: 4, color: 'glow', z: 0 },
    { key: 'aura', x: -19, y: 35, w: 38, h: 5, color: 'accent', z: 0 },
  );
  rig.parts.push({ key: 'face', x: -5, y: 30, w: 10, h: 3, color: 'accentBright', z: 9 });
  rig.pixelHeight = 43;
  return rig;
}

/**
 * The playable roster. Each entry is fully data-driven: silhouette, palette,
 * base stats, signature weapon, ultimate and unlock condition.
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'shade',
    react: REACTION_PRESETS.playerBob,
    name: 'Shade',
    handle: 'Haloed Swagger',
    tagline: 'Walks into the dark first, on purpose.',
    bio: 'A silhouette in a long coat with a ring of cold light where a face should be. Shade cuts a hole in the block and everything nasty falls into it.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#080a14',
      body: '#1b2140',
      bodyDark: '#101427',
      accent: '#4de1ff',
      accentBright: '#b8f4ff',
      skin: '#161c36',
      glow: '#66f0ff',
    },
    rig: humanoidRig({ height: 22, width: 11, halo: true, hood: true, headColor: 'bodyDark' }),
    stats: { maxHp: 120, speed: 96, power: 1, area: 1, haste: 1, magnet: 46, armor: 0.1, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'void-slash',
      name: 'Void Slash',
      kind: 'melee',
      description: 'A wide arc of torn streetlight that sweeps whatever is in front of you.',
      damage: 16,
      cooldownMs: 680,
      range: 52,
      levelDamageScale: 0.32,
      count: 1,
      impactIntensity: 3,
    },
    ultimate: {
      id: 'blackout',
      name: 'Blackout',
      description: 'The block loses power. You take no damage and hit twice as hard.',
      cooldownMs: 26000,
      durationMs: 3600,
      effect: { invulnerable: true, damageMult: 2, novaDamage: 40, novaRadius: 150 },
    },
    unlock: { kind: 'default' },
  },
  {
    id: 'queenbee',
    react: REACTION_PRESETS.playerBob,
    name: 'Queen Bee',
    handle: 'Hive Mother',
    tagline: 'Never travels alone.',
    bio: 'She keeps a hive somewhere over Fulton and it answers when she whistles. Slow to start, impossible to stop.',
    referenceArt: 'art/bee-queen.jpeg',
    palette: {
      ink: '#1b1105',
      body: '#f2a52a',
      bodyDark: '#2a1c08',
      accent: '#ffd45e',
      accentBright: '#fff3c4',
      skin: '#c2703a',
      glow: '#ffd873',
    },
    rig: humanoidRig({ height: 21, width: 10, puffs: true, wings: true }),
    stats: { maxHp: 96, speed: 102, power: 1.05, area: 1, haste: 1, magnet: 58, armor: 0.04, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'bee-line',
      name: 'Bee Line',
      kind: 'homing',
      description: 'Fires tracking workers that bend toward the nearest threat.',
      damage: 10,
      cooldownMs: 620,
      range: 300,
      speed: 210,
      count: 2,
      lifetimeMs: 2400,
      levelDamageScale: 0.28,
      impactIntensity: 2,
    },
    ultimate: {
      id: 'hive-bloom',
      name: 'Hive Bloom',
      description: 'The whole hive arrives at once in a burst of wings and pollen.',
      cooldownMs: 24000,
      durationMs: 5000,
      effect: { damageMult: 1.5, cooldownMult: 0.4, novaDamage: 55, novaRadius: 170 },
    },
    unlock: { kind: 'default' },
  },
  {
    id: 'lilstinger',
    react: REACTION_PRESETS.playerBob,
    name: 'Lil Stinger',
    handle: 'Pink Hoodie',
    tagline: 'Small kid, enormous bee.',
    bio: 'Rescued off Monroe with a jar and a plan. Summons a king bee that orbits him like a bodyguard with wings.',
    referenceArt: 'art/lil-stinger.jpeg',
    palette: {
      ink: '#2b1023',
      body: '#f472b6',
      bodyDark: '#9d2f6b',
      accent: '#8ee6c8',
      accentBright: '#ffffff',
      skin: '#f6c99a',
      glow: '#ffe066',
    },
    rig: humanoidRig({ height: 17, width: 9, cap: true }),
    stats: { maxHp: 88, speed: 112, power: 0.95, area: 1.1, haste: 0.9, magnet: 70, armor: 0.02, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'king-bee',
      name: 'King Bee & Swarm',
      kind: 'orbit',
      description: 'Bees circle you constantly, stinging anything that gets close.',
      damage: 9,
      cooldownMs: 0,
      range: 52,
      speed: 2.7,
      count: 3,
      levelDamageScale: 0.26,
      impactIntensity: 1,
    },
    ultimate: {
      id: 'swarm-call',
      name: 'Swarm Call',
      description: 'Every bee in the county shows up for about five seconds.',
      cooldownMs: 25000,
      durationMs: 5200,
      effect: { damageMult: 1.7, speedMult: 1.25, cooldownMult: 0.35 },
    },
    unlock: { kind: 'rescue', allyId: 'vee' },
  },
  {
    id: 'masky',
    react: REACTION_PRESETS.playerBob,
    name: 'Masky',
    handle: 'Float Fighter',
    tagline: 'Sits down. Still wins.',
    bio: 'A pink balaclava that never touches the ground. Fights in short bursts of pressure that knock a whole crowd backwards.',
    referenceArt: 'art/masky.jpeg',
    palette: {
      ink: '#2a0d1f',
      body: '#ff7ab8',
      bodyDark: '#b03a76',
      accent: '#ffffff',
      accentBright: '#1a0a14',
      skin: '#ff7ab8',
      glow: '#ff9ecb',
    },
    rig: humanoidRig({ height: 18, width: 11, seated: true, headColor: 'body' }),
    stats: { maxHp: 108, speed: 104, power: 1.1, area: 1.2, haste: 1, magnet: 50, armor: 0.14, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'mask-pulse',
      name: 'Mask Pulse',
      kind: 'nova',
      description: 'Releases a ring of pressure that damages and shoves everything nearby.',
      damage: 14,
      cooldownMs: 950,
      range: 86,
      levelDamageScale: 0.3,
      impactIntensity: 3,
    },
    ultimate: {
      id: 'bar-fight',
      name: 'Bar Fight',
      description: 'Pulses come out almost as fast as you can move.',
      cooldownMs: 22000,
      durationMs: 4500,
      effect: { cooldownMult: 0.3, speedMult: 1.35, damageMult: 1.25 },
    },
    unlock: { kind: 'clearArea', areaId: 'back-alley' },
  },
  {
    id: 'llamaste',
    react: REACTION_PRESETS.playerBob,
    name: 'Llamasté',
    handle: 'Cellar Monk',
    tagline: 'Breathes in. The room clears out.',
    bio: 'Found meditating under the city with a lantern and no explanation. Damage radiates off him in slow, patient rings.',
    referenceArt: 'art/llama-stay.jpeg',
    palette: {
      ink: '#1d1a10',
      body: '#e8dcc0',
      bodyDark: '#a08e68',
      accent: '#5fd8a4',
      accentBright: '#d8fff0',
      skin: '#e8dcc0',
      glow: '#7ef0bd',
    },
    rig: quadrupedRig({ height: 19, length: 15 }),
    stats: { maxHp: 140, speed: 82, power: 1, area: 1.45, haste: 1.15, magnet: 62, armor: 0.2, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'lotus-hum',
      name: 'Lotus Hum',
      kind: 'aura',
      description: 'A standing field of calm that grinds down anything standing in it.',
      damage: 6,
      cooldownMs: 360,
      range: 92,
      levelDamageScale: 0.34,
      impactIntensity: 1,
    },
    ultimate: {
      id: 'still-water',
      name: 'Still Water',
      description: 'One enormous exhale. Everything in sight gets flattened.',
      cooldownMs: 28000,
      durationMs: 3000,
      effect: { novaDamage: 90, novaRadius: 260, damageMult: 1.4, invulnerable: true },
    },
    unlock: { kind: 'clearArea', areaId: 'crystal-cellar' },
  },
  {
    id: 'glacierwarden',
    react: REACTION_PRESETS.playerBob,
    name: 'Glacier Warden',
    handle: 'Blue Hour',
    tagline: 'The cold keeps better company than the dark.',
    bio: 'A hooded keeper from the river fog, carrying a staff cut from a frozen street sign. Every step leaves a little winter behind.',
    palette: {
      ink: '#070b18',
      body: '#1a2140',
      bodyDark: '#0d142b',
      accent: '#67d9ff',
      accentBright: '#d8f8ff',
      skin: '#202d55',
      glow: '#8be9ff',
    },
    rig: humanoidRig({ height: 23, width: 11, hood: true, staff: true, headColor: 'bodyDark', torsoColor: 'bodyDark' }),
    stats: { maxHp: 104, speed: 91, power: 1.08, area: 1.08, haste: 1.04, magnet: 54, armor: 0.08, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'glacier-staff',
      name: 'Glacier Staff',
      kind: 'projectile',
      description: 'Launches a cold star that freezes the first thing it strikes.',
      damage: 18,
      cooldownMs: 780,
      range: 390,
      speed: 330,
      lifetimeMs: 1800,
      levelDamageScale: 0.24,
      color: '#8be9ff',
      obstacleInteraction: 'block',
      statusEffectId: 'freeze',
      impactIntensity: 2,
    },
    ultimate: {
      id: 'whiteout',
      name: 'Whiteout',
      description: 'A silent blizzard locks the whole block in place and hits harder at its center.',
      cooldownMs: 26000,
      durationMs: 4200,
      effect: { novaDamage: 72, novaRadius: 190, damageMult: 1.35, invulnerable: true },
    },
    unlock: { kind: 'default' },
  },
  {
    id: 'riftwitch',
    react: REACTION_PRESETS.playerBob,
    name: 'Rift Witch',
    handle: 'Pink Static',
    tagline: 'Small spell. Big problem.',
    bio: 'A back-alley caster who learned to make a weapon out of every bad idea. The rift follows her like a second shadow, bright enough to hurt.',
    palette: {
      ink: '#100717',
      body: '#3b174d',
      bodyDark: '#1d102d',
      accent: '#ff4fa3',
      accentBright: '#ffd1ec',
      skin: '#53305d',
      glow: '#ff6bb7',
    },
    rig: humanoidRig({ height: 20, width: 10, hood: true, staff: true, headColor: 'bodyDark', torsoColor: 'body' }),
    stats: { maxHp: 92, speed: 108, power: 1.12, area: 1.04, haste: 1.06, magnet: 60, armor: 0.03, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'rift-arc',
      name: 'Rift Arc',
      kind: 'projectile',
      description: 'Throws twin hot-pink tears through the dark, one for each side of the street.',
      damage: 15,
      cooldownMs: 760,
      range: 360,
      speed: 380,
      count: 2,
      lifetimeMs: 1300,
      levelDamageScale: 0.26,
      color: '#ff4fa3',
      obstacleInteraction: 'reflect',
      impactIntensity: 2,
    },
    ultimate: {
      id: 'pink-noise',
      name: 'Pink Noise',
      description: 'The rift opens wide, flaring outward and making every nearby enemy lose the plot.',
      cooldownMs: 23000,
      durationMs: 4000,
      effect: { novaDamage: 78, novaRadius: 180, damageMult: 1.45, speedMult: 1.2 },
    },
    unlock: { kind: 'default' },
  },
  {
    id: 'prismrunner',
    react: REACTION_PRESETS.playerBob,
    name: 'Prism Runner',
    handle: 'Seven-Color Getaway',
    tagline: 'Never takes the same shortcut twice.',
    bio: 'A courier who maps the city in flashes of impossible color. Their jacket catches the streetlight and throws it back sharper.',
    referenceArt: 'attached_assets/IMG_9340_1787696127871.jpeg',
    palette: { ink: '#120d2b', body: '#392c78', bodyDark: '#20174b', accent: '#f0abfc', accentBright: '#fff7ed', skin: '#d8b4fe', glow: '#67e8f9' },
    rig: expressiveRig('prism', 22),
    stats: { maxHp: 94, speed: 118, power: 1.02, area: 1.15, haste: 1.1, magnet: 68, armor: 0.02, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'prism-burst', name: 'Prism Burst', kind: 'projectile', description: 'A fan of hard-light shards that leaves a starburst at the first hit.', damage: 14, cooldownMs: 700, range: 410, speed: 430, count: 3, lifetimeMs: 1100, levelDamageScale: 0.23, impactIntensity: 1, color: '#f0abfc', obstacleInteraction: 'reflect' },
    ultimate: { id: 'rainbow-cut', name: 'Rainbow Cut', description: 'Splits the block into seven bright lanes and makes every lane count.', cooldownMs: 23000, durationMs: 4200, effect: { novaDamage: 84, novaRadius: 205, damageMult: 1.4, speedMult: 1.25 } },
    unlock: { kind: 'kills', count: 75 },
  },
  {
    id: 'cinderhalo',
    react: REACTION_PRESETS.playerBob,
    name: 'Cinder Halo',
    handle: 'Last Match',
    tagline: 'The smoke is part of the outfit.',
    bio: 'A night-shift spark who carries a tiny weather system above their head. Every swing starts small, then remembers how to burn.',
    referenceArt: 'attached_assets/IMG_9341_1787696127871.jpeg',
    palette: { ink: '#17070b', body: '#4a1721', bodyDark: '#210b13', accent: '#ff6b35', accentBright: '#ffe7a3', skin: '#9f3f32', glow: '#ffb000' },
    rig: expressiveRig('flame', 22),
    stats: { maxHp: 112, speed: 99, power: 1.16, area: 1.06, haste: 0.96, magnet: 48, armor: 0.1, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'cinder-arc', name: 'Cinder Arc', kind: 'melee', description: 'A close flame sweep that leaves a bright afterimage on the pavement.', damage: 23, cooldownMs: 760, range: 72, levelDamageScale: 0.3, impactIntensity: 3, color: '#ff6b35' },
    ultimate: { id: 'matchstorm', name: 'Matchstorm', description: 'A crown of ember lanes erupts outward and turns the crowd into silhouettes.', cooldownMs: 26000, durationMs: 4500, effect: { novaDamage: 96, novaRadius: 190, damageMult: 1.55, invulnerable: true } },
    unlock: { kind: 'clearArea', areaId: 'rooftops' },
  },
  {
    id: 'orbitanchor',
    react: REACTION_PRESETS.playerBob,
    name: 'Orbit Anchor',
    handle: 'Gravity With Manners',
    tagline: 'Everything comes around eventually.',
    bio: 'A compact astronomer with a pocket-sized sky. Their rings are not jewelry; they are a polite warning about where the next hit will land.',
    referenceArt: 'attached_assets/IMG_9343_1787696127871.jpeg',
    palette: { ink: '#110c1f', body: '#9a6b2f', bodyDark: '#382246', accent: '#c4b5fd', accentBright: '#fff1b8', skin: '#f4d5a2', glow: '#facc15' },
    rig: expressiveRig('astral', 20),
    stats: { maxHp: 98, speed: 94, power: 1.1, area: 1.22, haste: 1.02, magnet: 76, armor: 0.04, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'orbit-rings', name: 'Orbit Rings', kind: 'orbit', description: 'Two small gold-violet rings orbit outward and snap back through enemies.', damage: 13, cooldownMs: 0, range: 64, speed: 3.2, count: 2, levelDamageScale: 0.24, impactIntensity: 1, color: '#c4b5fd' },
    ultimate: { id: 'aphelion', name: 'Aphelion', description: 'The pocket sky opens: orbiting rings expand, strike, and pull the eye outward.', cooldownMs: 24000, durationMs: 5200, effect: { novaDamage: 76, novaRadius: 230, damageMult: 1.35, cooldownMult: 0.5 } },
    unlock: { kind: 'rescue', allyId: 'sable' },
  },
  {
    id: 'triangle-saint', name: 'Triangle Saint', handle: 'Three-Sided Mercy',
    tagline: 'Blesses every angle.', bio: 'A walking warning sign whose sermons arrive in expanding geometric wedges.',
    referenceArt: 'original:angular-saint',
    palette: { ink: '#17120a', body: '#eab308', bodyDark: '#713f12', accent: '#fef08a', accentBright: '#fff7ed', skin: '#f5d0a9', glow: '#fde047' },
    rig: triangleRig(24), stats: { maxHp: 108, speed: 88, power: 1.08, area: 1.3, haste: 0.92, magnet: 55, armor: 0.08, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'triangle-liturgy', name: 'Triangle Liturgy', kind: 'wave', description: 'Three staged wedges fade through the crowd in sequence.', damage: 17, cooldownMs: 1200, range: 170, count: 3, levelDamageScale: 0.25, impactIntensity: 2, color: '#fef08a', statusEffectId: 'slow' },
    ultimate: { id: 'threefold', name: 'Threefold', description: 'Three enormous wedges overlap at once.', cooldownMs: 24000, durationMs: 3500, effect: { novaDamage: 88, novaRadius: 210, damageMult: 1.4 } },
    unlock: { kind: 'kills', count: 90 },
  },
  {
    id: 'mile-marker', name: 'Mile Marker', handle: 'Roadside Oracle',
    tagline: 'Always knows the shortest route.', bio: 'A reflective highway sign on legs, carrying a laser ruler that turns streets into lanes.',
    referenceArt: 'original:roadside-oracle',
    palette: { ink: '#07111c', body: '#0e7490', bodyDark: '#164e63', accent: '#38bdf8', accentBright: '#e0f2fe', skin: '#bae6fd', glow: '#22d3ee' },
    rig: humanoidRig({ height: 25, width: 13, cap: true, staff: true }), stats: { maxHp: 100, speed: 104, power: 1.12, area: 1.05, haste: 1.02, magnet: 64, armor: 0.03, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'mile-marker', name: 'Mile Marker', kind: 'laser', description: 'A ruler-straight road laser pins a lane from curb to curb.', damage: 27, cooldownMs: 1450, range: 420, levelDamageScale: 0.28, impactIntensity: 3, color: '#38bdf8', obstacleInteraction: 'block' },
    ultimate: { id: 'exit-zero', name: 'Exit Zero', description: 'Every visible lane becomes a laser.', cooldownMs: 25000, durationMs: 3600, effect: { novaDamage: 78, novaRadius: 245, speedMult: 1.3 } },
    unlock: { kind: 'kills', count: 110 },
  },
  {
    id: 'emberback', name: 'Emberback', handle: 'Walking Bonfire',
    tagline: 'The floor is also on fire.', bio: 'A broad-backed furnace with a soot-black face and a habit of leaving trouble behind.',
    referenceArt: 'original:walking-bonfire',
    palette: { ink: '#1b0804', body: '#9a3412', bodyDark: '#431407', accent: '#fb923c', accentBright: '#ffedd5', skin: '#c2410c', glow: '#facc15' },
    rig: quadrupedRig({ height: 23, length: 22, ears: false }), stats: { maxHp: 132, speed: 82, power: 1.18, area: 1.1, haste: 0.84, magnet: 44, armor: 0.14, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'emberback', name: 'Emberback', kind: 'hazard', description: 'Drops a persistent ring of fire.', damage: 10, cooldownMs: 2100, range: 92, durationMs: 5200, levelDamageScale: 0.22, impactIntensity: 1, color: '#ff5f36', statusEffectId: 'burning', nativeCharacterId: 'emberback' },
    ultimate: { id: 'wildfire', name: 'Wildfire', description: 'Fire spreads from every ember field.', cooldownMs: 27000, durationMs: 5000, effect: { novaDamage: 110, novaRadius: 220, damageMult: 1.5, invulnerable: true } },
    unlock: { kind: 'clearArea', areaId: 'back-alley' },
  },
  {
    id: 'horse-you', name: 'The Horse You', handle: 'Equine Punchline',
    tagline: 'No one saw it coming.', bio: 'A gigantic horse-shaped silhouette whose hoof is usually somewhere outside the camera.',
    referenceArt: 'original:equine-punchline',
    palette: { ink: '#1c1020', body: '#be185d', bodyDark: '#701a75', accent: '#f472b6', accentBright: '#fce7f3', skin: '#fbcfe8', glow: '#fb7185' },
    rig: giantRig(31), stats: { maxHp: 156, speed: 70, power: 1.28, area: 1.0, haste: 0.76, magnet: 38, armor: 0.18, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'horse-you', name: 'The Horse You', kind: 'punch', description: 'A gigantic off-screen punch lands with comic-book force.', damage: 62, cooldownMs: 1900, range: 135, levelDamageScale: 0.34, impactIntensity: 5, impactTrigger: 'stomp', color: '#f472b6' },
    ultimate: { id: 'neighpocalypse', name: 'Neighpocalypse', description: 'The whole horizon gets hoof-stamped.', cooldownMs: 28000, durationMs: 3300, effect: { novaDamage: 150, novaRadius: 260, damageMult: 1.6 } },
    unlock: { kind: 'kills', count: 140 },
  },
  {
    id: 'glass-eel', name: 'Glass Eel', handle: 'See-Through Menace',
    tagline: 'There, then elsewhere.', bio: 'A clear river creature that navigates the city like a current under glass.',
    referenceArt: 'original:glass-eel',
    palette: { ink: '#071827', body: '#0e7490', bodyDark: '#164e63', accent: '#67e8f9', accentBright: '#ecfeff', skin: '#a5f3fc', glow: '#22d3ee' },
    rig: eelRig(18), stats: { maxHp: 86, speed: 132, power: 1.06, area: 0.95, haste: 1.18, magnet: 80, armor: 0.01, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'glass-eel', name: 'Glass Eel', kind: 'teleport', description: 'Blink-strikes to a threat, then leaves a freezing wake.', damage: 34, cooldownMs: 1700, range: 280, durationMs: 900, levelDamageScale: 0.3, impactIntensity: 3, color: '#67e8f9', statusEffectId: 'freeze' },
    ultimate: { id: 'river-skip', name: 'River Skip', description: 'Blink between five targets in a single impossible current.', cooldownMs: 23000, durationMs: 4200, effect: { novaDamage: 92, novaRadius: 180, speedMult: 1.65 } },
    unlock: { kind: 'kills', count: 160 },
  },
  {
    id: 'acid-botanist', name: 'Acid Botanist', handle: 'Greenhouse Hazard',
    tagline: 'Everything grows better angry.', bio: 'A patient gardener whose planters contain enough chemistry to dissolve a city block.',
    referenceArt: 'original:greenhouse-hazard',
    palette: { ink: '#0b1a0b', body: '#3f6212', bodyDark: '#1a2e05', accent: '#b8ff5c', accentBright: '#ecfccb', skin: '#bef264', glow: '#84cc16' },
    rig: expressiveRig('river', 23), stats: { maxHp: 116, speed: 91, power: 1.1, area: 1.2, haste: 0.9, magnet: 62, armor: 0.06, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'acid-garden', name: 'Acid Garden', kind: 'hazard', description: 'Plants a corrosive puddle.', damage: 8, cooldownMs: 1800, range: 105, durationMs: 6200, levelDamageScale: 0.2, impactIntensity: 1, color: '#b8ff5c', statusEffectId: 'acid', nativeCharacterId: 'acid-botanist' },
    ultimate: { id: 'overgrowth', name: 'Overgrowth', description: 'Every puddle erupts into a corrosive hedge.', cooldownMs: 25000, durationMs: 4800, effect: { novaDamage: 100, novaRadius: 215, damageMult: 1.35 } },
    unlock: { kind: 'clearArea', areaId: 'rooftops' },
  },
  {
    id: 'allymaker', name: 'Allymaker', handle: 'Temporary Friend',
    tagline: 'Everybody gets a second chance.', bio: 'A soft-spoken matchmaker who can make even a monster remember the better version of itself.',
    referenceArt: 'original:temporary-friend',
    palette: { ink: '#24101f', body: '#be185d', bodyDark: '#701a75', accent: '#f9a8d4', accentBright: '#fff1f2', skin: '#fbcfe8', glow: '#fb7185' },
    rig: expressiveRig('prism', 21), stats: { maxHp: 94, speed: 108, power: 0.96, area: 1.08, haste: 1.05, magnet: 76, armor: 0.02, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'allymaker', name: 'Allymaker', kind: 'convert', description: 'Turns the weakest nearby enemy against the horde for a heartbeat.', damage: 16, cooldownMs: 2600, range: 230, durationMs: 5000, levelDamageScale: 0.24, impactIntensity: 1, color: '#f9a8d4', statusEffectId: 'slow' },
    ultimate: { id: 'group-chat', name: 'Group Chat', description: 'The whole crowd gets briefly invited to your side.', cooldownMs: 29000, durationMs: 4500, effect: { novaDamage: 65, novaRadius: 190, damageMult: 1.25 } },
    unlock: { kind: 'kills', count: 180 },
  },
  {
    id: 'orbit-whale', name: 'Orbit Whale', handle: 'Sky Mammal',
    tagline: 'A song with gravity.', bio: 'A whale-shaped constellation that breaches through the air and pulls the fight into its wake.',
    referenceArt: 'original:sky-mammal',
    palette: { ink: '#08152f', body: '#1d4ed8', bodyDark: '#172554', accent: '#60a5fa', accentBright: '#dbeafe', skin: '#93c5fd', glow: '#818cf8' },
    rig: blobRig({ height: 23, width: 25, tendrils: true }), stats: { maxHp: 124, speed: 78, power: 1.2, area: 1.34, haste: 0.88, magnet: 70, armor: 0.1, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'orbit-whale', name: 'Orbit Whale', kind: 'wave', description: 'A deep blue breach rolls outward like a whale through stars.', damage: 30, cooldownMs: 1550, range: 190, count: 2, levelDamageScale: 0.27, impactIntensity: 4, color: '#60a5fa', impactTrigger: 'ground-shock' },
    ultimate: { id: 'deep-sky', name: 'Deep Sky', description: 'Gravity turns every enemy toward the breach.', cooldownMs: 26000, durationMs: 5000, effect: { novaDamage: 96, novaRadius: 250, damageMult: 1.45 } },
    unlock: { kind: 'kills', count: 200 },
  },
  {
    id: 'blink-choir', name: 'Blink Choir', handle: 'Four Voices, One Exit',
    tagline: 'Harmony is a location.', bio: 'A chorus of masks occupying one body, each note appearing somewhere the enemies are not ready for.',
    referenceArt: 'original:four-voice-choir',
    palette: { ink: '#170d2b', body: '#6d28d9', bodyDark: '#3b0764', accent: '#f0abfc', accentBright: '#fae8ff', skin: '#ddd6fe', glow: '#c084fc' },
    rig: expressiveRig('spiral', 22), stats: { maxHp: 90, speed: 120, power: 1.02, area: 1.0, haste: 1.2, magnet: 66, armor: 0.01, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'blink-choir', name: 'Blink Choir', kind: 'teleport', description: 'The choir disappears and reappears behind the nearest threat.', damage: 22, cooldownMs: 1250, range: 320, durationMs: 700, levelDamageScale: 0.26, impactIntensity: 3, color: '#f0abfc', statusEffectId: 'slow' },
    ultimate: { id: 'fourth-wall', name: 'Fourth Wall', description: 'The choir steps outside the fight and returns in a storm.', cooldownMs: 24000, durationMs: 3800, effect: { novaDamage: 85, novaRadius: 220, invulnerable: true } },
    unlock: { kind: 'kills', count: 220 },
  },
  {
    id: 'punchline', name: 'Punchline', handle: 'Delayed Reaction',
    tagline: 'Wait for it.', bio: 'A yellow-jacketed comedian whose jokes land late, loudly, and in exactly the wrong place for a monster.',
    referenceArt: 'original:delayed-reaction',
    palette: { ink: '#1c1604', body: '#ca8a04', bodyDark: '#713f12', accent: '#facc15', accentBright: '#fef9c3', skin: '#fef08a', glow: '#fde047' },
    rig: humanoidRig({ height: 20, width: 12, cap: true }), stats: { maxHp: 102, speed: 106, power: 1.14, area: 1.12, haste: 0.82, magnet: 58, armor: 0.05, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'punchline', name: 'Punchline', kind: 'punch', description: 'A delayed joke detonates after the first hit lands.', damage: 42, cooldownMs: 2100, range: 150, durationMs: 500, levelDamageScale: 0.32, impactIntensity: 4, impactTrigger: 'stomp', color: '#facc15' },
    ultimate: { id: 'rimshot', name: 'Rimshot', description: 'The delayed punch becomes a city-wide punchline.', cooldownMs: 26000, durationMs: 4400, effect: { novaDamage: 118, novaRadius: 235, damageMult: 1.5 } },
    unlock: { kind: 'kills', count: 240 },
  },
  {
    id: 'bulbosa',
    react: REACTION_PRESETS.playerBob,
    name: 'Bulbosa',
    handle: 'Pink Tide Commander',
    tagline: 'Earned every inch of this rivalry.',
    bio: 'Leader of the Bubbleteers, same as her father before her. She didn\'t inherit the Bubblenaughts\' kingdom -- she challenged for a piece of it, blade first, and never stopped.',
    palette: {
      ink: '#22091a',
      body: '#db2777',
      bodyDark: '#831843',
      accent: '#f9a8d4',
      accentBright: '#fff0f7',
      skin: '#f6c9de',
      glow: '#ff9ecb',
    },
    rig: humanoidRig({ height: 21, width: 11, puffs: true, wings: true, headColor: 'bodyDark' }),
    stats: { maxHp: 110, speed: 100, power: 1.15, area: 1.1, haste: 1, magnet: 56, armor: 0.08, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'froth-barrage',
      name: 'Froth Barrage',
      kind: 'orbit',
      description: 'Pink bubbles orbit her, bursting into soapy shock on contact.',
      damage: 14,
      cooldownMs: 0,
      range: 60,
      speed: 2.9,
      count: 3,
      levelDamageScale: 0.27,
      impactIntensity: 2,
      color: '#ff9ecb',
    },
    ultimate: {
      id: 'tide-of-pink',
      name: 'Tide of Pink',
      description: 'Every bubble she has ever popped comes back at once.',
      cooldownMs: 25000,
      durationMs: 4600,
      effect: { damageMult: 1.5, novaDamage: 80, novaRadius: 200 },
    },
    unlock: { kind: 'discovery', discoveryId: 'bubble-truce' },
  },
  // PLACEHOLDER -- no name specified for the Bubblenaughts' native leader.
  // Rename this character (id, name, handle, tagline, bio) once a real name
  // is chosen; everything else about the record can stay as-is.
  {
    id: 'finblum',
    react: REACTION_PRESETS.playerBob,
    name: 'Finblum',
    handle: 'Blue Tide Elder',
    tagline: 'The kingdom was built one bubble at a time. He remembers every one.',
    bio: 'Generations of Bubblenaughts built this bubble kingdom through exploration and discovery of the bubble realms. He is the latest to hold the line, same as his father did against Bulbosa\'s.',
    palette: {
      ink: '#03131f',
      body: '#1d4ed8',
      bodyDark: '#172554',
      accent: '#60a5fa',
      accentBright: '#dbeafe',
      skin: '#c2d8ff',
      glow: '#38bdf8',
    },
    rig: humanoidRig({ height: 22, width: 12, bulk: true, staff: true, headColor: 'bodyDark' }),
    stats: { maxHp: 128, speed: 86, power: 1.1, area: 1.15, haste: 0.94, magnet: 52, armor: 0.14, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'tide-bolt',
      name: 'Tide Bolt',
      kind: 'projectile',
      description: 'Launches a heavy blue bubble that bursts into a soaking splash on impact.',
      damage: 19,
      cooldownMs: 820,
      range: 360,
      speed: 300,
      lifetimeMs: 1700,
      levelDamageScale: 0.25,
      color: '#60a5fa',
      obstacleInteraction: 'block',
      impactIntensity: 2,
    },
    ultimate: {
      id: 'kingdom-tide',
      name: 'Kingdom Tide',
      description: 'Generations of the bubble kingdom answer at once in a wall of blue.',
      cooldownMs: 27000,
      durationMs: 4200,
      effect: { novaDamage: 92, novaRadius: 210, damageMult: 1.4, invulnerable: true },
    },
    unlock: { kind: 'clearArea', areaId: 'haven-of-the-bubs' },
  },
  {
    id: 'artisanvalor',
    react: REACTION_PRESETS.playerBob,
    name: 'Artisan Valor Prime',
    handle: 'The Curator',
    tagline: "The quiet custodian of the city's final gallery.",
    bio: "He doesn't just preserve the art; he weaves the visual fabric of the world itself. Tech-wear armor under a heavy hood, a hard-light blade slung like a tonearm.",
    palette: {
      ink: '#0a0a0d',
      body: '#1c1c22',
      bodyDark: '#101014',
      accent: '#ff2b4d',
      accentBright: '#ff8fa3',
      skin: '#26262e',
      glow: '#ff2b4d',
    },
    rig: humanoidRig({ height: 23, width: 12, bulk: true, hood: true, staff: true, headColor: 'bodyDark', torsoColor: 'bodyDark' }),
    stats: { maxHp: 118, speed: 88, power: 1.1, area: 1.1, haste: 0.96, magnet: 48, armor: 0.12, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'hard-light-stylus',
      name: 'Hard-Light Stylus',
      kind: 'projectile',
      description: 'A heavy hard-light tonearm blade. Stabs the ground and snaps the floor into a scratch-groove burst before ejecting a piercing neon disc.',
      damage: 20,
      cooldownMs: 900,
      range: 140,
      speed: 380,
      lifetimeMs: 1600,
      levelDamageScale: 0.26,
      pierce: 1,
      impactIntensity: 3,
      color: '#ff2b4d',
      groundSlam: true,
    },
    ultimate: {
      id: 'gallery-domain',
      name: 'Gallery Domain',
      description: 'A localized theme filter drains the block of color. Enemies inside turn into flat, monochromatic silhouettes with reduced armor and take a beating.',
      cooldownMs: 27000,
      durationMs: 4000,
      effect: { novaDamage: 80, novaRadius: 200, damageMult: 1.3, invulnerable: true },
    },
    unlock: { kind: 'default' },
  },
  {
    id: 'staticnomad',
    react: REACTION_PRESETS.playerBob,
    name: 'Static Nomad',
    handle: 'The Afro-Cyborg',
    tagline: 'Fights with the rhythm of a rolling thunderstorm.',
    bio: 'A street-level brawler who traded his arms to keep up with the city\'s pulse, but kept his head in the clouds. He fights with the rhythm of a rolling thunderstorm.',
    palette: {
      ink: '#0a0d12',
      body: '#20262e',
      bodyDark: '#7c8a99',
      accent: '#4fd6ff',
      accentBright: '#e8e8ee',
      skin: '#5c6470',
      glow: '#8be9ff',
    },
    rig: staticNomadRig(),
    stats: { maxHp: 100, speed: 106, power: 1.12, area: 1, haste: 1.05, magnet: 52, armor: 0.06, crit: 0.08, lifesteal: 0 },
    weapon: {
      id: 'wire-fist',
      name: 'Wire-Fist',
      kind: 'melee',
      description: 'Rapid, short-range kinetic punches -- jagged glitch squares pop into existence and vanish on impact.',
      damage: 18,
      cooldownMs: 420,
      range: 46,
      levelDamageScale: 0.3,
      count: 1,
      impactIntensity: 4,
      color: '#4fd6ff',
    },
    ultimate: {
      id: 'rolling-thunder',
      name: 'Rolling Thunder',
      description: 'His cybernetic arms vent excess charge in a ring of electrified smoke, quickening every punch.',
      cooldownMs: 24000,
      durationMs: 4200,
      effect: { cooldownMult: 0.4, speedMult: 1.2, novaDamage: 70, novaRadius: 170 },
    },
    dashSkill: {
      kind: 'pulse-shield',
      pulseDamage: 7,
      pulseRadius: 68,
      pulseArc: 1.1,
      beatsPerPulse: 1,
      levelsPerDirection: 2,
      maxDirections: 5,
      dashBurstMult: 2.4,
    },
    unlock: { kind: 'kills', count: 260 },
  },
  {
    id: 'emberascetic',
    react: REACTION_PRESETS.playerBob,
    name: 'Ember Ascetic',
    handle: 'Furnace Monk',
    tagline: 'His spirit burns so bright it bleeds through his physical form.',
    bio: 'He found absolute clarity in the heat of the forge. Now, his spirit burns so bright it bleeds through his physical form.',
    palette: {
      ink: '#0c0605',
      body: '#241814',
      bodyDark: '#140b09',
      accent: '#ff7a1a',
      accentBright: '#ffffff',
      skin: '#3a2420',
      glow: '#ff2fb0',
    },
    rig: emberAsceticRig(),
    stats: { maxHp: 118, speed: 90, power: 1.2, area: 1.1, haste: 0.95, magnet: 48, armor: 0.1, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'formless-cleave',
      name: 'Formless Cleave',
      kind: 'melee',
      description: 'A vibrant, brush-stroke arc of fire that lingers a fraction longer than a normal swing before fading to ash.',
      damage: 25,
      cooldownMs: 820,
      range: 78,
      levelDamageScale: 0.32,
      count: 1,
      impactIntensity: 3,
      color: '#ff7a1a',
      statusEffectId: 'burning',
    },
    ultimate: {
      id: 'inner-furnace',
      name: 'Inner Furnace',
      description: 'A slow, rhythmic heat pulse turns the block into a mirage -- everything nearby flashes white and burns.',
      cooldownMs: 27000,
      durationMs: 4600,
      effect: { novaDamage: 98, novaRadius: 195, damageMult: 1.4, invulnerable: true },
    },
    dashSkill: {
      kind: 'directional-wall',
      wallDamage: 5,
      wallRange: 58,
      wallArc: 0.85,
      wallTickMs: 260,
      dashPushMult: 2.6,
      landExplodeDelayMs: 550,
      landExplodeDamage: 26,
      landExplodeRadius: 66,
    },
    unlock: { kind: 'clearArea', areaId: 'old-market' },
  },
  {
    id: 'switchback',
    react: REACTION_PRESETS.playerBob,
    name: 'Switchback',
    handle: 'Route Breaker',
    tagline: 'Finds the angle nobody else saw.',
    bio: 'A night courier who turned a spool of municipal signal wire into a weapon. Every shot changes direction, and so does she.',
    palette: { ink: '#07131b', body: '#174153', bodyDark: '#0b2835', accent: '#33f0c1', accentBright: '#e6fff8', skin: '#b97555', glow: '#5ee7ff' },
    rig: switchbackRig(),
    stats: { maxHp: 92, speed: 121, power: 1.02, area: 0.96, haste: 0.84, magnet: 68, armor: 0.03, crit: 0.12, lifesteal: 0 },
    weapon: { id: 'signal-wire', name: 'Signal Wire', kind: 'projectile', description: 'Fast reflective line shots thread through cover and crowds.', damage: 13, cooldownMs: 480, range: 340, speed: 310, count: 2, lifetimeMs: 1800, levelDamageScale: 0.29, impactIntensity: 2, color: '#33f0c1', obstacleInteraction: 'reflect', pierce: 1 },
    ultimate: { id: 'wrong-way-home', name: 'Wrong Way Home', description: 'The route redraws itself: movement and fire cadence spike while a signal burst clears space.', cooldownMs: 23000, durationMs: 4300, effect: { speedMult: 1.55, cooldownMult: 0.42, novaDamage: 48, novaRadius: 145 } },
    unlock: { kind: 'kills', count: 80 },
  },
  {
    id: 'bellwether',
    react: REACTION_PRESETS.playerBob,
    name: 'Bellwether',
    handle: 'Last Chime',
    tagline: 'Holds the line until the block remembers it has one.',
    bio: 'A former tower keeper wrapped in a coat full of cracked brass. The deeper the ring, the less the crowd can move.',
    palette: { ink: '#120d08', body: '#55402c', bodyDark: '#261b13', accent: '#f6c866', accentBright: '#fff4c2', skin: '#80543e', glow: '#ff9f43' },
    rig: bellwetherRig(),
    stats: { maxHp: 158, speed: 79, power: 1.16, area: 1.38, haste: 1.08, magnet: 54, armor: 0.24, crit: 0.04, lifesteal: 0.02 },
    weapon: { id: 'resonance-bell', name: 'Resonance Bell', kind: 'nova', description: 'Heavy concentric chimes shove nearby threats away from your ground.', damage: 19, cooldownMs: 980, range: 104, levelDamageScale: 0.34, impactIntensity: 4, color: '#f6c866' },
    ultimate: { id: 'hold-the-hour', name: 'Hold the Hour', description: 'A city-sized chime grants invulnerability and breaks the crowd around you.', cooldownMs: 28500, durationMs: 3400, effect: { invulnerable: true, damageMult: 1.55, novaDamage: 110, novaRadius: 250 } },
    unlock: { kind: 'clearArea', areaId: 'back-alley' },
  },
  {
    id: 'afterimage', react: REACTION_PRESETS.playerBob, name: 'Afterimage', handle: 'Light Leak',
    tagline: 'Leaves a safer version of the street behind her.',
    bio: 'A transit photographer who learned that a long exposure can hold a door open for one more heartbeat.',
    palette: { ink: '#0b0b19', body: '#2d2a70', bodyDark: '#17153d', accent: '#a5b4fc', accentBright: '#eef2ff', skin: '#9a5b48', glow: '#c084fc' },
    rig: humanoidRig({ height: 20, width: 10, cap: true, torsoColor: 'body' }),
    stats: { maxHp: 104, speed: 108, power: 1.08, area: 1.14, haste: 0.9, magnet: 62, armor: 0.07, crit: 0.14, lifesteal: 0 },
    weapon: { id: 'exposure-flash', name: 'Exposure Flash', kind: 'nova', description: 'A rolling shutter flash marks a wide circle and pushes back the nearest crowd.', damage: 17, cooldownMs: 760, range: 96, levelDamageScale: 0.31, impactIntensity: 2, color: '#a5b4fc' },
    ultimate: { id: 'long-exposure', name: 'Long Exposure', description: 'A bright afterimage holds the line while a rapid flash sequence clears space.', cooldownMs: 25000, durationMs: 4100, effect: { speedMult: 1.35, cooldownMult: 0.55, novaDamage: 82, novaRadius: 190 } },
    unlock: { kind: 'rescue', allyId: 'morrow' },
  },
  {
    id: 'harrow', react: REACTION_PRESETS.playerBob, name: 'Harrow', handle: 'The Quiet Engine',
    tagline: 'Turns every close call into momentum.',
    bio: 'A night mechanic with a pocketful of broken bearings and a talent for making the city’s noise work for him.',
    palette: { ink: '#10100d', body: '#435143', bodyDark: '#20291f', accent: '#b8d66b', accentBright: '#f1ffd0', skin: '#81533b', glow: '#d8ff7a' },
    rig: humanoidRig({ height: 21, width: 12, hood: true, torsoColor: 'bodyDark' }),
    stats: { maxHp: 136, speed: 88, power: 1.22, area: 1.2, haste: 1, magnet: 44, armor: 0.18, crit: 0.06, lifesteal: 0.04 },
    weapon: { id: 'bearing-scatter', name: 'Bearing Scatter', kind: 'projectile', description: 'Heavy steel bearings skip through a lane and return through the crowd.', damage: 21, cooldownMs: 920, range: 280, speed: 245, count: 3, lifetimeMs: 1500, levelDamageScale: 0.33, impactIntensity: 3, color: '#b8d66b', pierce: 1 },
    ultimate: { id: 'idle-redline', name: 'Idle Redline', description: 'The engine catches: damage rises, cooldowns fall, and a shock clears the immediate lane.', cooldownMs: 28000, durationMs: 3600, effect: { damageMult: 1.65, cooldownMult: 0.5, novaDamage: 94, novaRadius: 170 } },
    unlock: { kind: 'kills', count: 220 },
  },

  /**
   * First cold-biome wave: two silhouettes new to the roster entirely
   * (arachnidRig, serpentRig -- see sprites/rigs.ts). More to come once the
   * actual cold-biome area ships; these two stand on their own for now.
   * See run-presentation.md.
   */
  {
    id: 'hoarfrost', react: REACTION_PRESETS.playerBob, name: 'Hoarfrost', handle: 'The Ice Weaver',
    tagline: 'Wove itself out of a frozen fire escape one January and never quite thawed.',
    bio: 'Six legs, no hurry. Hoarfrost doesn\'t chase -- it lays a web across the block and waits for the cold to do the rest.',
    referenceArt: 'original:ice-weaver',
    // Bone-white and silver, not blue -- Glacier Warden and Glass Eel already
    // own saturated ice-cyan, so Hoarfrost reads as rime-glazed frost instead
    // of "another blue ice character." See run-presentation.md.
    palette: {
      ink: '#0a0a0d',
      body: '#d9dde3',
      bodyDark: '#8b93a1',
      accent: '#c9e8e0',
      accentBright: '#ffffff',
      skin: '#8b93a1',
      glow: '#e4f2ee',
    },
    rig: arachnidRig({ height: 10, span: 16, legPairs: 3 }),
    stats: { maxHp: 108, speed: 84, power: 1.02, area: 1.16, haste: 0.94, magnet: 50, armor: 0.16, crit: 0.05, lifesteal: 0 },
    // Not a generic aimed pulse -- three anchor nodes drop into a ring around
    // Hoarfrost, linked by visible frost strands, and sit there freezing
    // whatever wanders across a strand. "Lays a web across the block" made
    // literal instead of described. See run-presentation.md.
    weapon: {
      id: 'rime-web',
      name: 'Rime Web',
      kind: 'hazard',
      description: 'Drops three anchor nodes in a ring, webbed together -- anything crossing a strand locks solid.',
      damage: 9,
      cooldownMs: 2400,
      range: 128,
      durationMs: 4600,
      levelDamageScale: 0.24,
      count: 3,
      impactIntensity: 1,
      color: '#c9e8e0',
      statusEffectId: 'freeze',
    },
    ultimate: {
      id: 'deep-frost',
      name: 'Deep Frost',
      description: 'The whole web goes rigid at once -- everything touching a strand locks solid.',
      cooldownMs: 26000,
      durationMs: 3800,
      effect: { novaDamage: 70, novaRadius: 195, damageMult: 1.3 },
    },
    unlock: { kind: 'kills', count: 120 },
  },
  {
    id: 'sleet', react: REACTION_PRESETS.playerBob, name: 'Sleet', handle: 'Downed Line',
    tagline: 'Ice storm took the power out for six blocks. This is what came down with the wire.',
    bio: 'A live line iced over mid-arc, still sparking under the frost. Sleet moves like a whip and hits like a breaker flipping.',
    referenceArt: 'original:downed-line',
    // Electric violet, not blue -- differentiates from Glacier Warden and
    // Glass Eel's ice-cyan on sight. See run-presentation.md.
    palette: {
      ink: '#0a0612',
      body: '#3d2a5c',
      bodyDark: '#1f1533',
      accent: '#c9a6ff',
      accentBright: '#ffffff',
      skin: '#1f1533',
      glow: '#c9a6ff',
    },
    rig: serpentRig({ length: 28, segments: 5 }),
    stats: { maxHp: 82, speed: 138, power: 1.05, area: 0.92, haste: 1.14, magnet: 66, armor: 0.02, crit: 0.1, lifesteal: 0 },
    // Leaves the ground wet on hit -- then the *next* arc through a wet
    // target detonates for a hard bonus, since electricity conducts through
    // water. A real elemental combo instead of a flat status tag, and it
    // doesn't compete with Hoarfrost's freeze niche. See run-presentation.md.
    weapon: {
      id: 'arc-sleet',
      name: 'Arc Sleet',
      kind: 'laser',
      description: 'A violet arc snaps out in a line and leaves the ground slicked. Hit something already wet and the arc jumps -- hard.',
      damage: 17,
      cooldownMs: 900,
      range: 260,
      levelDamageScale: 0.28,
      impactIntensity: 2,
      color: '#c9a6ff',
      statusEffectId: 'wet',
      bonusVsStatusId: 'wet',
      bonusVsStatusMult: 1.9,
    },
    ultimate: {
      id: 'brownout',
      name: 'Brownout',
      description: 'Every line arcs at once. The block goes dark, then very, very cold.',
      cooldownMs: 24000,
      durationMs: 3500,
      effect: { speedMult: 1.5, cooldownMult: 0.5, novaDamage: 58, novaRadius: 170 },
    },
    unlock: { kind: 'kills', count: 190 },
  },

  /**
   * First 'meteor' weapon kind character -- telegraph reticle, then a
   * strike drops from off-screen. See run-presentation.md for the full
   * mechanic writeup, including why this is a demolition foreman and not
   * another astronomer (Orbit Anchor already owns that niche).
   */
  {
    id: 'foreman', react: REACTION_PRESETS.playerBob, name: 'The Foreman', handle: 'Condemned Block',
    tagline: 'Every building he\'s ever worked on is still coming down.',
    bio: 'Doesn\'t carry tools anymore. Points at a spot, and whatever the crane was holding lets go of it.',
    referenceArt: 'original:condemned-block',
    palette: {
      ink: '#0a0a0a',
      body: '#4b5563',
      bodyDark: '#1f2937',
      accent: '#fde047',
      accentBright: '#fff9c4',
      skin: '#c2703a',
      glow: '#fde047',
    },
    rig: humanoidRig({ height: 22, width: 13, bulk: true, cap: true, torsoColor: 'bodyDark' }),
    stats: { maxHp: 148, speed: 78, power: 1.14, area: 1.1, haste: 0.9, magnet: 46, armor: 0.2, crit: 0.04, lifesteal: 0 },
    weapon: {
      id: 'drop-zone',
      name: 'Drop Zone',
      kind: 'meteor',
      description: 'Marks a spot with a reticle -- half a second later, something heavy lands on it.',
      damage: 46,
      cooldownMs: 1900,
      range: 340,
      durationMs: 650,
      levelDamageScale: 0.34,
      count: 1,
      impactIntensity: 4,
      color: '#fde047',
    },
    ultimate: {
      id: 'structural-failure',
      name: 'Structural Failure',
      description: 'The whole site lets go at once.',
      cooldownMs: 27000,
      durationMs: 4000,
      effect: { novaDamage: 105, novaRadius: 210, damageMult: 1.4, invulnerable: true },
    },
    unlock: { kind: 'kills', count: 150 },
  },

  /**
   * First stormCloud character -- a draggable companion cloud, cycling
   * elements automatically so it works with or without ever touching the
   * drag gesture. See run-presentation.md for the full mechanic writeup.
   */
  {
    id: 'storm-chaser', react: REACTION_PRESETS.playerBob, name: 'Storm Chaser', handle: 'Weather Eye',
    tagline: 'Doesn\'t run from the front. Brings a piece of it with her.',
    bio: 'Chases whatever 616\'s weird microclimates are doing this week and keeps a piece of it on a leash. It doesn\'t always listen.',
    referenceArt: 'original:weather-eye',
    palette: {
      ink: '#0a0d0c',
      body: '#374151',
      bodyDark: '#1b2129',
      accent: '#5eead4',
      accentBright: '#d1fae5',
      skin: '#c2a37a',
      glow: '#a7f3d0',
    },
    rig: humanoidRig({ height: 20, width: 10, hood: true, torsoColor: 'bodyDark' }),
    stats: { maxHp: 106, speed: 96, power: 1.0, area: 1.08, haste: 1, magnet: 58, armor: 0.08, crit: 0.05, lifesteal: 0 },
    weapon: {
      id: 'hail-pelt',
      name: 'Hail Pelt',
      kind: 'projectile',
      description: 'A handful of ice flung hard while the real weather does its work overhead.',
      damage: 9,
      cooldownMs: 620,
      range: 260,
      speed: 260,
      count: 2,
      lifetimeMs: 1400,
      levelDamageScale: 0.22,
      impactIntensity: 1,
      color: '#5eead4',
    },
    // Drag the cloud (grabRadius) anywhere on screen for precision, or leave
    // it -- it drifts near the player by default and cycles rain -> fire
    // rain -> acid rain -> frost rain every cycleMs regardless of whether
    // it's ever touched, until the HUD weather picker hands over manual
    // control (see setStormCloudMode). Whatever mode is active also paints
    // a matching ground stain wherever the cloud lingers.
    stormCloud: {
      grabRadius: 70,
      effectRadius: 95,
      tickMs: 500,
      cycleMs: 4200,
      rainDamage: 5,
      fireRainDamage: 9,
      acidRainDamage: 7,
      frostRainDamage: 8,
    },
    ultimate: {
      id: 'squall-line',
      name: 'Squall Line',
      description: 'The whole front moves in at once.',
      cooldownMs: 25000,
      durationMs: 4200,
      effect: { novaDamage: 64, novaRadius: 200, speedMult: 1.3, cooldownMult: 0.6 },
    },
    unlock: { kind: 'kills', count: 170 },
  },
  // 2x World: Extreme difficulty variants designed to dominate doubled spawns
  // Legendary update 2026-09-09. The first five palettes remain preview
  // palettes; all silhouettes and mechanics are locked.
  {
    id: 'bellwright', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Bellwright', handle: 'The Returning Tone', tagline: 'Every wall rings twice.',
    bio: 'A narrow bell keeper carrying a colossal shoulder bell. The first tone finds the crowd; the returning tone finds what survived.',
    signatureTraits: ['Colossal shoulder bell', 'Returning ricochet tone'],
    palette: palette({ ink: '#120d18', body: '#4e315c', bodyDark: '#211827', accent: '#f2b84b', accentBright: '#fff1b8', glow: '#ffd36d' }),
    rig: bellwrightRig(),
    stats: { maxHp: 112, speed: 92, power: 1.14, area: 1.2, haste: 0.96, magnet: 58, armor: 0.1, crit: 0.06, lifesteal: 0 },
    weapon: { id: 'resonance-bell', name: 'Resonance Bell', kind: 'projectile', legendaryPattern: 'resonance-return', description: 'Reflecting sound bolts reverse once and cross their own path on the return.', damage: 18, cooldownMs: 1180, range: 420, speed: 300, count: 3, lifetimeMs: 1550, levelDamageScale: 0.28, impactIntensity: 3, color: '#f2b84b', obstacleInteraction: 'reflect' },
    ultimate: { id: 'grand-peal', name: 'Grand Peal', description: 'The colossal bell tolls from every direction at once.', cooldownMs: 25000, durationMs: 4200, effect: { novaDamage: 92, novaRadius: 225, damageMult: 1.45, cooldownMult: 0.55 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'mawheel', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Mawheel', handle: 'One-Way Hunger', tagline: 'Forward is the only promise.',
    bio: 'A hunched rider fused to one enormous wheel. Every attack commits to the lane and grows more violent as it rolls.',
    signatureTraits: ['Single-wheel lower body', 'Forward-locked attack charge'],
    palette: palette({ ink: '#180c0d', body: '#7b3426', bodyDark: '#2b1919', accent: '#e26737', accentBright: '#ffd08d', glow: '#ff9c4a' }),
    rig: mawheelRig(),
    stats: { maxHp: 134, speed: 108, power: 1.2, area: 1.02, haste: 0.9, magnet: 45, armor: 0.14, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'grindwheel', name: 'Grindwheel', kind: 'sweep', legendaryPattern: 'grind-charge', description: 'Locks into a forward charge, crushing the lane and throwing a spark wake.', damage: 26, cooldownMs: 1700, range: 86, levelDamageScale: 0.31, impactIntensity: 5, impactTrigger: 'ground-shock', color: '#e26737' },
    ultimate: { id: 'redline', name: 'Redline', description: 'The wheel refuses to slow and every impact becomes a burst.', cooldownMs: 27000, durationMs: 4800, effect: { invulnerable: true, speedMult: 1.6, damageMult: 1.65, novaDamage: 72, novaRadius: 150 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'lantern-widow', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Lantern Widow', handle: 'Sixfold Vigil', tagline: 'Nothing stays hidden once the hooks are lit.',
    bio: 'A thin cloaked watcher with six lantern-hook arms. Her light catches several enemies and makes them answer the same call together.',
    signatureTraits: ['Six lantern-hook arms', 'Multi-target damage network'],
    palette: palette({ ink: '#090b1e', body: '#472153', bodyDark: '#17132c', accent: '#dc5bd7', accentBright: '#a9fbff', glow: '#63e6ea' }),
    rig: lanternWidowRig(),
    stats: { maxHp: 92, speed: 104, power: 1.08, area: 1.24, haste: 1.06, magnet: 72, armor: 0.03, crit: 0.08, lifesteal: 0 },
    weapon: { id: 'ghostlight-thread', name: 'Ghostlight Thread', kind: 'hazard', legendaryPattern: 'ghostlight-network', description: 'Hooks up to six enemies into one glowing network and deals shared damage across the link.', damage: 15, cooldownMs: 1350, range: 300, count: 6, durationMs: 900, levelDamageScale: 0.27, impactIntensity: 1, color: '#dc5bd7', statusEffectId: 'slow' },
    ultimate: { id: 'all-lanterns-open', name: 'All Lanterns Open', description: 'Every hidden threat is exposed and bound into the same burning thread.', cooldownMs: 24000, durationMs: 4500, effect: { novaDamage: 78, novaRadius: 240, cooldownMult: 0.42, damageMult: 1.35 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'brassback', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Brassback', handle: 'Walking Boiler', tagline: 'Pressure is stored permission.',
    bio: 'A short, broad boiler guard sealed inside a brass shell. The chimney announces the pull a heartbeat before the steam erupts.',
    signatureTraits: ['Brass shell and chimney', 'Pull-then-burst harpoon'],
    palette: palette({ ink: '#17120a', body: '#9a6a2d', bodyDark: '#3e3421', accent: '#e88736', accentBright: '#fff0b0', glow: '#ffcf63' }),
    rig: brassbackRig(),
    stats: { maxHp: 162, speed: 76, power: 1.22, area: 1.12, haste: 0.86, magnet: 42, armor: 0.22, crit: 0.04, lifesteal: 0.03 },
    weapon: { id: 'steam-harpoon', name: 'Steam Harpoon', kind: 'laser', legendaryPattern: 'steam-harpoon', description: 'Hooks the nearest threat inward, then vents a scalding pressure burst.', damage: 28, cooldownMs: 1650, range: 360, levelDamageScale: 0.31, impactIntensity: 4, color: '#e88736', statusEffectId: 'slow' },
    ultimate: { id: 'boiler-overdrive', name: 'Boiler Overdrive', description: 'Stored heat becomes armor, speed, and repeated pressure vents.', cooldownMs: 28000, durationMs: 5200, effect: { damageMult: 1.55, cooldownMult: 0.5, invulnerable: true, novaDamage: 80, novaRadius: 175 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'paper-saint', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Paper Saint', handle: 'Edge-On Mercy', tagline: 'Turns sideways and leaves the hit behind.',
    bio: 'A towering folded figure whose wings become blades. False folds peel away as decoys while the true edge keeps moving.',
    signatureTraits: ['Paper-thin winged silhouette', 'Piercing blades plus decoys'],
    palette: palette({ ink: '#251b27', body: '#eee7dc', bodyDark: '#89768d', accent: '#b54077', accentBright: '#fff9e8', glow: '#e9a9f1' }),
    rig: paperSaintRig(),
    stats: { maxHp: 86, speed: 120, power: 1.12, area: 1.08, haste: 1.14, magnet: 62, armor: 0.01, crit: 0.12, lifesteal: 0 },
    weapon: { id: 'origami-guillotine', name: 'Origami Guillotine', kind: 'projectile', legendaryPattern: 'origami-decoys', description: 'Unfolds three reflecting guillotine blades and releases false-fold decoys.', damage: 22, cooldownMs: 1250, range: 410, speed: 390, count: 3, lifetimeMs: 1450, levelDamageScale: 0.29, impactIntensity: 3, pierce: 2, color: '#e9a9f1', obstacleInteraction: 'reflect', follower: { speed: 150, radius: 38, count: 2, growAfterMs: 0, maxRadius: 8, lifetimeMs: 2200 } },
    ultimate: { id: 'thousand-fold-escape', name: 'Thousand-Fold Escape', description: 'Folds edge-on through danger while the arena fills with cutting copies.', cooldownMs: 23000, durationMs: 4300, effect: { invulnerable: true, speedMult: 1.7, cooldownMult: 0.38, damageMult: 1.4 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'eclipse-pilgrim', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Eclipse Pilgrim', handle: 'Black-Sun Walker', tagline: 'Carries night into rooms that never had a sky.',
    bio: 'A crescent-cloaked traveler beneath a floating black sun. Gravity wells darken the block and drag the fight off its intended route.',
    signatureTraits: ['Floating black sun', 'Persistent pulling darkness'],
    palette: palette({ ink: '#050509', body: '#3f267d', bodyDark: '#15121f', accent: '#826cff', accentBright: '#c8c7d1', glow: '#4bc8ff' }),
    rig: eclipsePilgrimRig(),
    stats: { maxHp: 108, speed: 94, power: 1.16, area: 1.3, haste: 0.93, magnet: 86, armor: 0.08, crit: 0.07, lifesteal: 0 },
    weapon: { id: 'event-horizon', name: 'Event Horizon', kind: 'hazard', legendaryPattern: 'event-horizon', description: 'Plants a dark gravity well that slows, damages, and continuously pulls enemies inward.', damage: 11, cooldownMs: 2100, range: 160, durationMs: 4600, levelDamageScale: 0.24, impactIntensity: 1, color: '#826cff', statusEffectId: 'slow', nativeCharacterId: 'eclipse-pilgrim' },
    ultimate: { id: 'totality', name: 'Totality', description: 'The black sun opens completely and the Pilgrim becomes strongest inside its night.', cooldownMs: 28000, durationMs: 5600, effect: { invulnerable: true, damageMult: 1.8, cooldownMult: 0.52, novaDamage: 90, novaRadius: 235 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'bloomheart', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Bloomheart', handle: 'Crystal Garden', tagline: 'Every step plants a decision.',
    bio: 'A wide flower guardian with branching antlers and a visible crystal heart. Its roots heal the center before the connected garden erupts.',
    signatureTraits: ['Antlered crystal-heart body', 'Healing linked root traps'],
    palette: palette({ ink: '#09261d', body: '#177b54', bodyDark: '#15412f', accent: '#ee6e72', accentBright: '#d7ae4a', glow: '#8cff3f' }),
    rig: bloomheartRig(),
    stats: { maxHp: 142, speed: 82, power: 1.1, area: 1.32, haste: 0.88, magnet: 74, armor: 0.15, crit: 0.04, lifesteal: 0.04 },
    weapon: { id: 'root-network', name: 'Root Network', kind: 'hazard', legendaryPattern: 'root-network', description: 'Plants connected healing roots that trap enemies and burst together at the end.', damage: 10, cooldownMs: 2400, range: 112, count: 5, durationMs: 3600, levelDamageScale: 0.25, impactIntensity: 1, color: '#8cff3f', statusEffectId: 'slow', nativeCharacterId: 'bloomheart' },
    ultimate: { id: 'heartbloom', name: 'Heartbloom', description: 'The crystal heart opens and every planted node blooms at once.', cooldownMs: 27000, durationMs: 5000, effect: { novaDamage: 105, novaRadius: 220, damageMult: 1.5, invulnerable: true } },
    unlock: { kind: 'default' },
  },
  {
    id: 'marionette-king', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Marionette King', handle: 'The Hand Above', tagline: 'A crown is just another control surface.',
    bio: 'A thin crowned puppet suspended beneath a giant spectral hand. Several enemies at once are ordered to turn on their own formation.',
    signatureTraits: ['Giant overhead hand and strings', 'Multi-enemy forced allegiance'],
    palette: palette({ ink: '#1b0913', body: '#9a2039', bodyDark: '#4f245f', accent: '#d9a42f', accentBright: '#efe3d0', skin: '#efe3d0', glow: '#c78cff' }),
    rig: marionetteKingRig(),
    stats: { maxHp: 96, speed: 98, power: 1.04, area: 1.22, haste: 1.08, magnet: 68, armor: 0.03, crit: 0.1, lifesteal: 0 },
    weapon: { id: 'royal-command', name: 'Royal Command', kind: 'convert', legendaryPattern: 'royal-command', description: 'Seizes several enemies at once and orders them to fight their former allies.', damage: 13, cooldownMs: 2350, range: 290, count: 3, durationMs: 4500, levelDamageScale: 0.22, impactIntensity: 1, color: '#d9a42f', statusEffectId: 'slow' },
    ultimate: { id: 'confetti-coup', name: 'Confetti Coup', description: 'Every seized subject attacks before the strings snap in a razor-confetti burst.', cooldownMs: 26000, durationMs: 5200, effect: { novaDamage: 88, novaRadius: 210, cooldownMult: 0.45, damageMult: 1.35 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'cryo-mantis', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Cryo-Mantis', handle: 'Four-Blade Winter', tagline: 'Two lines are enough to end the argument.',
    bio: 'A tall insect duelist with four scythe arms and a faceted ice abdomen. Its crossed zero-lines freeze everything caught between them.',
    signatureTraits: ['Four scythe-arm silhouette', 'Crossed absolute-zero cuts'],
    palette: palette({ ink: '#07131f', body: '#36dce8', bodyDark: '#102b55', accent: '#eefcff', accentBright: '#ef4bce', glow: '#50eaf0' }),
    rig: cryoMantisRig(),
    stats: { maxHp: 94, speed: 116, power: 1.18, area: 1.08, haste: 1.16, magnet: 55, armor: 0.03, crit: 0.13, lifesteal: 0 },
    weapon: { id: 'zero-split', name: 'Zero Split', kind: 'laser', legendaryPattern: 'zero-split', description: 'Cuts two crossing absolute-zero lines that freeze and fracture the crowd.', damage: 27, cooldownMs: 1500, range: 430, levelDamageScale: 0.3, impactIntensity: 3, color: '#50eaf0', statusEffectId: 'freeze' },
    ultimate: { id: 'shatter-season', name: 'Shatter Season', description: 'Frozen targets become the blades for the next crossed cut.', cooldownMs: 24000, durationMs: 4300, effect: { novaDamage: 96, novaRadius: 205, damageMult: 1.65, cooldownMult: 0.42, speedMult: 1.25 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'neon-leviathan', rarity: 'legendary', react: REACTION_PRESETS.playerBob,
    name: 'Neon Leviathan', handle: 'Tidal Recall', tagline: 'The route behind you is still alive.',
    bio: 'A long whale-headed serpent with floating fins and a transparent luminous spine. Its spectral double retraces the path the player just survived.',
    signatureTraits: ['Serpentine whale and luminous spine', 'Weapon replays the recent movement route'],
    palette: palette({ ink: '#061724', body: '#16d7c2', bodyDark: '#592eae', accent: '#ff3697', accentBright: '#49e7ef', glow: '#ff3da5' }),
    rig: neonLeviathanRig(),
    stats: { maxHp: 118, speed: 126, power: 1.12, area: 1.18, haste: 1.04, magnet: 82, armor: 0.07, crit: 0.07, lifesteal: 0 },
    weapon: { id: 'tidal-memory', name: 'Tidal Memory', kind: 'wave', legendaryPattern: 'tidal-memory', description: 'A spectral Leviathan retraces the player’s recent route as a chain of crushing waves.', damage: 24, cooldownMs: 1850, range: 180, count: 1, levelDamageScale: 0.29, impactIntensity: 3, color: '#ff3697', statusEffectId: 'slow' },
    ultimate: { id: 'phase-breach', name: 'Phase Breach', description: 'The Leviathan becomes a wall-crossing streak of neon tide.', cooldownMs: 25000, durationMs: 5000, effect: { invulnerable: true, speedMult: 1.8, damageMult: 1.5, novaDamage: 82, novaRadius: 210 } },
    unlock: { kind: 'default' },
  },
  {
    id: 'apex-shade',
    react: REACTION_PRESETS.playerBob,
    name: 'Apex Shade',
    handle: 'Absolute Dark',
    tagline: 'When darkness isn\'t enough, become it.',
    bio: 'A perfected version of Shade—the void itself given form. Cuts holes in reality, pulls twice as hard, and everything falls twice as fast into the abyss.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#000000',
      body: '#0a1a28',
      bodyDark: '#050c14',
      accent: '#00ffff',
      accentBright: '#66ffff',
      skin: '#0a1420',
      glow: '#00ffff',
    },
    rig: humanoidRig({ height: 24, width: 13, halo: true, hood: true, headColor: 'bodyDark' }),
    stats: { maxHp: 180, speed: 110, power: 1.5, area: 1.4, haste: 1.1, magnet: 64, armor: 0.15, crit: 0.1, lifesteal: 0.05 },
    weapon: {
      id: 'void-slash-x2',
      name: 'Void Slash Plus',
      kind: 'melee',
      description: 'Doubled arcs of absolute darkness that consume everything in their path.',
      damage: 24,
      cooldownMs: 580,
      range: 72,
      levelDamageScale: 0.48,
      count: 2,
      impactIntensity: 5,
    },
    ultimate: {
      id: 'blackout-x2',
      name: 'Total Blackout',
      description: 'Cascading darkness. The entire block goes dark, enemies slow, you become unstoppable.',
      cooldownMs: 20000,
      durationMs: 5000,
      effect: { invulnerable: true, damageMult: 3, novaDamage: 80, novaRadius: 200, speedMult: 1.5 },
    },
    unlock: { kind: 'clearArea', areaId: 'monroe-strip-2x' },
  },
  {
    id: 'swarm-sovereign',
    react: REACTION_PRESETS.playerBob,
    name: 'Swarm Sovereign',
    handle: 'Hive Ascendant',
    tagline: 'The hive is endless. So are you.',
    bio: 'Queen Bee evolved beyond command. The hive moves as an extension of her will. Armies of allies, doubled healing, enemies bow before the collective.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#1a1a00',
      body: '#ffcc00',
      bodyDark: '#cc9900',
      accent: '#ffff66',
      accentBright: '#ffffcc',
      skin: '#ffdd99',
      glow: '#ffff99',
    },
    rig: humanoidRig({ height: 21, width: 12, wings: true, torsoColor: 'body' }),
    stats: { maxHp: 160, speed: 100, power: 1.3, area: 1.6, haste: 1.2, magnet: 80, armor: 0.12, crit: 0.08, lifesteal: 0.08 },
    weapon: {
      id: 'bee-line-x2',
      name: 'Bee Line Volley',
      kind: 'projectile',
      description: 'A swarm of stingers fired in rapid succession, each spawning micro-hives.',
      damage: 13,
      cooldownMs: 520,
      range: 280,
      speed: 280,
      count: 4,
      lifetimeMs: 1200,
      levelDamageScale: 0.35,
      impactIntensity: 2,
      color: '#ffcc00',
    },
    ultimate: {
      id: 'hive-bloom-x2',
      name: 'Hive Convergence',
      description: 'The entire swarm arrives at once. Enemies suffocate under the onslaught.',
      cooldownMs: 22000,
      durationMs: 4500,
      effect: { damageMult: 2.2, speedMult: 1.2, novaRadius: 180 },
    },
    unlock: { kind: 'clearArea', areaId: 'back-alley-2x' },
  },
  {
    id: 'chrono-runner',
    react: REACTION_PRESETS.playerBob,
    name: 'Chrono Runner',
    handle: "Time's Courier",
    tagline: 'Every timeline, the same destination. Every second faster than the last.',
    bio: 'Prism Runner fractured across infinite routes at once. Time bends around her movement. Twice the speed, twice the coverage, nowhere is safe from what she carries.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#1a0033',
      body: '#6600ff',
      bodyDark: '#330066',
      accent: '#cc99ff',
      accentBright: '#ff99ff',
      skin: '#9966cc',
      glow: '#cc66ff',
    },
    rig: humanoidRig({ height: 19, width: 10, cap: true, torsoColor: 'body' }),
    stats: { maxHp: 110, speed: 140, power: 1.2, area: 1.3, haste: 1.4, magnet: 70, armor: 0.08, crit: 0.12, lifesteal: 0.06 },
    weapon: {
      id: 'prism-splinter-x2',
      name: 'Fractured Route',
      kind: 'projectile',
      description: 'Crystalline shards that refract across multiple timelines and enemy positions.',
      damage: 11,
      cooldownMs: 480,
      range: 320,
      speed: 320,
      count: 5,
      lifetimeMs: 1300,
      levelDamageScale: 0.32,
      impactIntensity: 3,
      color: '#cc99ff',
    },
    ultimate: {
      id: 'chrono-dash',
      name: 'Temporal Overdrive',
      description: 'All timelines collapse forward. Enemies can\'t predict where you are.',
      cooldownMs: 18000,
      durationMs: 4200,
      effect: { speedMult: 2.5, damageMult: 1.8, invulnerable: true, cooldownMult: 0.5 },
    },
    unlock: { kind: 'clearArea', areaId: 'rooftops-2x' },
  },
  {
    id: 'elder-warden',
    react: REACTION_PRESETS.playerBob,
    name: 'Elder Warden',
    handle: 'Glacial Patriarch',
    tagline: 'Time is frozen. So are your enemies.',
    bio: 'Glacier Warden perfected through ages of ice. The river doesn\'t just freeze—it stops. Time crystallizes around her, enemies locked in place, damage doubled from a still opponent.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#0a1a2e',
      body: '#00ffff',
      bodyDark: '#003366',
      accent: '#66ffff',
      accentBright: '#ccffff',
      skin: '#0099cc',
      glow: '#00ffff',
    },
    rig: humanoidRig({ height: 25, width: 12, bulk: true, torsoColor: 'body' }),
    stats: { maxHp: 200, speed: 85, power: 1.6, area: 1.2, haste: 0.9, magnet: 50, armor: 0.2, crit: 0.06, lifesteal: 0.04 },
    weapon: {
      id: 'glacier-surge-x2',
      name: 'Eternal Winter',
      kind: 'melee',
      description: 'Slow, overwhelming strikes that freeze enemies solid and shatter on impact.',
      damage: 28,
      cooldownMs: 720,
      range: 60,
      levelDamageScale: 0.44,
      count: 1,
      impactIntensity: 5,
    },
    ultimate: {
      id: 'whiteout-x2',
      name: 'Absolute Zero',
      description: 'The temperature drops beyond survival. Everything is frozen.',
      cooldownMs: 24000,
      durationMs: 3800,
      effect: { invulnerable: true, damageMult: 2.5, novaDamage: 90, novaRadius: 180, speedMult: 0.5 },
    },
    unlock: { kind: 'clearArea', areaId: 'crystal-cellar-2x' },
  },
  {
    id: 'jackpot',
    react: REACTION_PRESETS.playerBob,
    name: 'Jackpot',
    handle: 'The House Always Loses',
    tagline: 'Walked out of the Neon Arcade with a pocket full of house money.',
    bio: 'Nobody remembers her putting a single token in. She just started winning, and the machines have not forgiven her for it since.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#1a0e00',
      body: '#f59e0b',
      bodyDark: '#78350f',
      accent: '#fde047',
      accentBright: '#fef9c3',
      skin: '#c2410c',
      glow: '#fde047',
    },
    rig: humanoidRig({ height: 20, width: 11, cap: true, torsoColor: 'body' }),
    stats: { maxHp: 100, speed: 100, power: 1, area: 1, haste: 1, magnet: 50, armor: 0.06, crit: 0.14, lifesteal: 0 },
    weapon: {
      id: 'loaded-dice',
      name: 'Loaded Dice',
      kind: 'projectile',
      description: 'A pair of dice that never land the way the machine expects. Every throw is a critical waiting to happen.',
      damage: 15,
      cooldownMs: 640,
      range: 300,
      speed: 300,
      count: 2,
      lifetimeMs: 1400,
      levelDamageScale: 0.26,
      impactIntensity: 2,
      color: '#fde047',
      obstacleInteraction: 'reflect',
    },
    ultimate: {
      id: 'all-in',
      name: 'All In',
      description: 'Every machine in earshot pays out at once.',
      cooldownMs: 23000,
      durationMs: 4000,
      effect: { damageMult: 2.2, novaDamage: 55, novaRadius: 170, cooldownMult: 0.65 },
    },
    unlock: { kind: 'clearArea', areaId: 'neon-arcade' },
  },
  {
    id: 'meter-monk',
    react: [
      { source: 'downbeat', target: 'scale', amount: 0.12, decayMs: 180 },
      { source: 'band', band: 'mid', target: 'glow', amount: 0.34 },
    ],
    name: 'Meter Monk',
    handle: 'The Sixteenth Step',
    tagline: 'Never wastes a beat, a breath, or a warning.',
    bio: 'The patient pen of the Sixth Ward Cypher. During the blackout at LokPet Card Shop, Monk held the doorway for sixteen bars while the others got the neighborhood inside.',
    palette: palette({ ink: '#080713', body: '#35265f', bodyDark: '#171127', accent: '#ffb000', accentBright: '#fff1a8', skin: '#7a4931', glow: '#ffd84d' }),
    rig: meterMonkRig(),
    stats: { maxHp: 112, speed: 92, power: 1.08, area: 1.15, haste: 0.96, magnet: 52, armor: 0.1, crit: 0.06, lifesteal: 0 },
    weapon: {
      id: 'bar-line',
      name: 'Bar Line',
      kind: 'wave',
      description: 'Four measured sound walls land like bars across the street, slowing anything that misses the count.',
      damage: 15,
      cooldownMs: 1080,
      range: 190,
      count: 4,
      levelDamageScale: 0.27,
      impactIntensity: 2,
      color: '#ffb000',
      statusEffectId: 'slow',
    },
    ultimate: {
      id: 'sixteen-bars',
      name: 'Sixteen Bars',
      description: 'The meter locks in: attacks accelerate and a final bass hit clears the circle.',
      cooldownMs: 23500,
      durationMs: 4200,
      effect: { cooldownMult: 0.48, damageMult: 1.55, novaDamage: 48, novaRadius: 155 },
    },
    unlock: { kind: 'default' },
    rarity: 'legendary',
    signatureTraits: ['Pendulum mic', 'Four-beat pressure'],
    crew: { id: 'sixth-ward-cypher', name: 'Sixth Ward Cypher', role: 'Lyricist' },
  },
  {
    id: 'vinyl-hex',
    react: [
      { source: 'beat', target: 'scale', amount: 0.1, decayMs: 110 },
      { source: 'band', band: 'high', target: 'glow', amount: 0.4 },
    ],
    name: 'Vinyl Hex',
    handle: 'Backspin Architect',
    tagline: 'If the room has corners, the beat has exits.',
    bio: 'Producer and route planner for the Sixth Ward Cypher. Hex wired the card shop turntables into the block grid; every ricochet still carries a piece of that impossible set.',
    palette: palette({ ink: '#070b18', body: '#123a63', bodyDark: '#0b1830', accent: '#ff2e91', accentBright: '#7df9ff', skin: '#9b5c3f', glow: '#00efff' }),
    rig: vinylHexRig(),
    stats: { maxHp: 98, speed: 104, power: 1, area: 1.05, haste: 0.9, magnet: 48, armor: 0.05, crit: 0.12, lifesteal: 0 },
    weapon: {
      id: 'backspin-pressing',
      name: 'Backspin Pressing',
      kind: 'projectile',
      description: 'Twin vinyl cutters ricochet from walls, punch through one target, then cross the room again.',
      damage: 13,
      cooldownMs: 570,
      range: 380,
      speed: 390,
      count: 2,
      lifetimeMs: 1700,
      levelDamageScale: 0.25,
      impactIntensity: 2,
      pierce: 1,
      color: '#ff2e91',
      obstacleInteraction: 'reflect',
    },
    ultimate: {
      id: 'needle-drop',
      name: 'Needle Drop',
      description: 'Drops the whole city onto the needle, bursting nearby enemies before the tempo doubles.',
      cooldownMs: 22000,
      durationMs: 3600,
      effect: { novaDamage: 58, novaRadius: 180, cooldownMult: 0.55, speedMult: 1.25 },
    },
    unlock: { kind: 'clearArea', areaId: 'neon-arcade' },
    rarity: 'legendary',
    signatureTraits: ['Turntable shoulders', 'Wall-cutting vinyl'],
    crew: { id: 'sixth-ward-cypher', name: 'Sixth Ward Cypher', role: 'Producer' },
  },
  {
    id: 'hook-ghost',
    react: [
      { source: 'onset', target: 'scale', amount: 0.16, decayMs: 170 },
      { source: 'energy', target: 'glow', amount: 0.38 },
    ],
    name: 'Hook Ghost',
    handle: 'Call-and-Response',
    tagline: 'The crowd always knows the next line.',
    bio: 'The Cypher never found out whether Ghost escaped the blackout or became part of its echo. Their hooks turn hostile crowds into a temporary choir that fights on cue.',
    palette: palette({ ink: '#05030d', body: '#5b167c', bodyDark: '#1e0a35', accent: '#61ff8b', accentBright: '#eafff0', skin: '#2b1740', glow: '#9dffbc' }),
    rig: hookGhostRig(),
    stats: { maxHp: 102, speed: 98, power: 0.96, area: 1.18, haste: 1.04, magnet: 58, armor: 0.07, crit: 0.05, lifesteal: 0.03 },
    weapon: {
      id: 'crowd-hook',
      name: 'Crowd Hook',
      kind: 'convert',
      description: 'Calls two weak enemies into the chorus; they turn and perform the response against their own side.',
      damage: 14,
      cooldownMs: 2300,
      range: 255,
      count: 2,
      durationMs: 5200,
      levelDamageScale: 0.23,
      impactIntensity: 1,
      color: '#61ff8b',
      statusEffectId: 'slow',
    },
    ultimate: {
      id: 'everybody-say',
      name: 'Everybody Say',
      description: 'A spectral chorus floods the block, healing Ghost while the crowd takes amplified damage.',
      cooldownMs: 25000,
      durationMs: 4300,
      effect: { invulnerable: true, damageMult: 1.85, novaDamage: 38, novaRadius: 210 },
    },
    unlock: { kind: 'kills', count: 616 },
    rarity: 'legendary',
    signatureTraits: ['Speaker-wing silhouette', 'Enemy chorus'],
    crew: { id: 'sixth-ward-cypher', name: 'Sixth Ward Cypher', role: 'Hook / Hype' },
  },
  {
    id: 'sleeve',
    react: [
      { source: 'beat', target: 'scale', amount: 0.08, decayMs: 130 },
      { source: 'band', band: 'high', target: 'glow', amount: 0.5 },
    ],
    name: 'Sleeve',
    handle: 'The Binder',
    tagline: 'Nothing rare stays loose for long.',
    bio: 'Card-shop keeper, merch table guardian, and unofficial fourth member of the Sixth Ward Cypher. Sleeve catalogued every strange LokPet that crossed the blackout—and learned to throw the duplicates.',
    palette: palette({ ink: '#101006', body: '#e7e3d5', bodyDark: '#28351d', accent: '#ff4db8', accentBright: '#fff45c', skin: '#6f432f', glow: '#8cff4d' }),
    rig: sleeveCollectorRig(),
    stats: { maxHp: 106, speed: 101, power: 1.02, area: 1, haste: 0.94, magnet: 74, armor: 0.06, crit: 0.11, lifesteal: 0 },
    weapon: {
      id: 'misprint-deck',
      name: 'Misprint Deck',
      kind: 'projectile',
      description: 'A fan of foil misprints skips through enemies and bounces once off the shop walls.',
      damage: 11,
      cooldownMs: 610,
      range: 350,
      speed: 420,
      count: 3,
      lifetimeMs: 1350,
      levelDamageScale: 0.24,
      impactIntensity: 1,
      pierce: 2,
      color: '#fff45c',
      obstacleInteraction: 'reflect',
    },
    ultimate: {
      id: 'perfect-pull',
      name: 'Perfect Pull',
      description: 'Cracks a mythic pack: foil light detonates outward and every card flies faster for a short run.',
      cooldownMs: 23000,
      durationMs: 4000,
      effect: { novaDamage: 62, novaRadius: 175, damageMult: 1.7, cooldownMult: 0.62 },
    },
    unlock: { kind: 'default' },
    rarity: 'legendary',
    signatureTraits: ['Asymmetric card-fan coat', 'Double Card Credits'],
    crew: { id: 'sixth-ward-cypher', name: 'Sixth Ward Cypher', role: 'Collector / Shopkeeper' },
    lokPetCollector: {
      rank: 'LokPet Collector',
      extraTeamSlots: 1,
      floorPackChance: 0.006,
      lokPetPrizeWeightMultiplier: 1.35,
      bonusCardCreditsPerLootBox: 2,
    },
  },
  {
    id: 'crate-sage', react: REACTION_PRESETS.playerBob,
    name: 'Crate Sage', handle: 'Sealed Knowledge', tagline: 'Reads the pull before the wrapper tears.',
    bio: 'Sleeve’s first apprentice learned every delivery route into the shop, then learned how to hear a living LokPet through cardboard and foil.',
    palette: palette({ ink: '#0b0905', body: '#8a5b2d', bodyDark: '#332113', accent: '#51f6c4', accentBright: '#d8fff3', skin: '#7b4b34', glow: '#72ffd2' }),
    rig: crateSageRig(),
    stats: { maxHp: 126, speed: 88, power: 1.08, area: 1.08, haste: 1, magnet: 78, armor: 0.13, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'seal-breaker', name: 'Seal Breaker', kind: 'melee', description: 'A box-cutter arc opens armor like a stubborn collector case.', damage: 21, cooldownMs: 760, range: 66, count: 2, levelDamageScale: 0.3, impactIntensity: 3, color: '#51f6c4' },
    ultimate: { id: 'fresh-case', name: 'Fresh Case', description: 'Drops a sealed case with enough force to clear the counter.', cooldownMs: 24000, durationMs: 3500, effect: { novaDamage: 70, novaRadius: 160, damageMult: 1.65 } },
    unlock: { kind: 'lokCollector', runs: 3, lokPets: 3 }, rarity: 'legendary',
    signatureTraits: ['Crate-body silhouette', '+2 LokPet slots'],
    crew: { id: 'card-shop-keepers', name: 'LokPet Card Shop Keepers', role: 'LokMaster' },
    lokPetCollector: { rank: 'LokMaster', extraTeamSlots: 2, floorPackChance: 0.009, lokPetPrizeWeightMultiplier: 1.6, bonusCardCreditsPerLootBox: 3 },
  },
  {
    id: 'foil-oracle', react: REACTION_PRESETS.playerBob,
    name: 'Foil Oracle', handle: 'Tomorrow’s Pull', tagline: 'Sees seven packs ahead and still enjoys the reveal.',
    bio: 'A quiet reader of foil glare who joined the shop after predicting the blackout’s final record. Every card in the fan is a future that almost happened.',
    palette: palette({ ink: '#090616', body: '#5f4a9c', bodyDark: '#21163f', accent: '#76f7ff', accentBright: '#fff8cc', skin: '#80513c', glow: '#d77cff' }),
    rig: foilOracleRig(),
    stats: { maxHp: 94, speed: 108, power: 1.02, area: 1.22, haste: 0.9, magnet: 86, armor: 0.05, crit: 0.14, lifesteal: 0 },
    weapon: { id: 'forecast-spread', name: 'Forecast Spread', kind: 'wave', description: 'Three translucent card futures unfold outward and slow whatever chooses the wrong one.', damage: 18, cooldownMs: 1050, range: 210, count: 3, levelDamageScale: 0.27, impactIntensity: 2, color: '#76f7ff', statusEffectId: 'slow' },
    ultimate: { id: 'chase-card', name: 'Chase Card', description: 'Reveals the rare timeline: speed, damage, and foil light surge together.', cooldownMs: 22500, durationMs: 4400, effect: { damageMult: 1.9, speedMult: 1.4, cooldownMult: 0.65 } },
    unlock: { kind: 'lokCollector', runs: 8, lokPets: 8 }, rarity: 'legendary',
    signatureTraits: ['Tall foil diviner', '+3 LokPet slots'],
    crew: { id: 'card-shop-keepers', name: 'LokPet Card Shop Keepers', role: 'LokCaster' },
    lokPetCollector: { rank: 'LokCaster', extraTeamSlots: 3, floorPackChance: 0.012, lokPetPrizeWeightMultiplier: 1.9, bonusCardCreditsPerLootBox: 4 },
  },
  {
    id: 'crown-binder', react: REACTION_PRESETS.playerBob,
    name: 'Crown Binder', handle: 'The Living Catalogue', tagline: 'Every crown jewel has a page number.',
    bio: 'The Keepers’ walking archive wears a crown of top-loaders and remembers every LokPet call ever caught beneath Sixth Ward streetlights.',
    palette: palette({ ink: '#100b02', body: '#f2d058', bodyDark: '#51330c', accent: '#ff3f8f', accentBright: '#fff7c2', skin: '#9d6241', glow: '#ff8fc5' }),
    rig: crownBinderRig(),
    stats: { maxHp: 138, speed: 94, power: 1.18, area: 1.18, haste: 0.94, magnet: 94, armor: 0.14, crit: 0.1, lifesteal: 0.02 },
    weapon: { id: 'royal-toploader', name: 'Royal Toploader', kind: 'laser', description: 'A rigid beam stamps a brilliant catalogue line through the entire aisle.', damage: 29, cooldownMs: 1320, range: 460, levelDamageScale: 0.3, impactIntensity: 4, color: '#ff3f8f', obstacleInteraction: 'block' },
    ultimate: { id: 'living-catalogue', name: 'Living Catalogue', description: 'Every recorded call answers at once in a crown-shaped blast.', cooldownMs: 24500, durationMs: 3800, effect: { novaDamage: 86, novaRadius: 205, damageMult: 2 } },
    unlock: { kind: 'lokCollector', runs: 16, lokPets: 18 }, rarity: 'legendary',
    signatureTraits: ['Top-loader crown', '+5 LokPet slots'],
    crew: { id: 'card-shop-keepers', name: 'LokPet Card Shop Keepers', role: 'LokLegendary' },
    lokPetCollector: { rank: 'LokLegendary', extraTeamSlots: 5, floorPackChance: 0.016, lokPetPrizeWeightMultiplier: 2.3, bonusCardCreditsPerLootBox: 5 },
  },
  {
    id: 'pack-supreme', react: REACTION_PRESETS.playerBob,
    name: 'Pack Supreme', handle: 'Seven-Slot Sovereign', tagline: 'Opens the whole case. Keeps every promise.',
    bio: 'The final Keeper rank is less a title than a moving sanctuary. Seven extra companions orbit Supreme, each one rescued, named, and ready to answer.',
    palette: palette({ ink: '#03070b', body: '#153f56', bodyDark: '#071a25', accent: '#ffdd3d', accentBright: '#ffffff', skin: '#6b412f', glow: '#5cfff2' }),
    rig: packSupremeRig(),
    stats: { maxHp: 156, speed: 91, power: 1.2, area: 1.28, haste: 0.88, magnet: 110, armor: 0.16, crit: 0.12, lifesteal: 0.03 },
    weapon: { id: 'seven-seal-orbit', name: 'Seven-Seal Orbit', kind: 'projectile', description: 'Seven sealed rays fan outward like a collector case snapping open.', damage: 10, cooldownMs: 680, range: 390, speed: 430, count: 7, lifetimeMs: 1250, levelDamageScale: 0.23, impactIntensity: 2, pierce: 1, color: '#ffdd3d' },
    ultimate: { id: 'open-every-pack', name: 'Open Every Pack', description: 'A supreme resonance storm makes the whole LokPet team hit harder and faster.', cooldownMs: 25000, durationMs: 5200, effect: { novaDamage: 74, novaRadius: 230, damageMult: 2.2, cooldownMult: 0.5 } },
    unlock: { kind: 'lokCollector', runs: 30, lokPets: 36 }, rarity: 'legendary',
    signatureTraits: ['Sanctuary-wing silhouette', '+7 LokPet slots'],
    crew: { id: 'card-shop-keepers', name: 'LokPet Card Shop Keepers', role: 'LokSupreme' },
    lokPetCollector: { rank: 'LokSupreme', extraTeamSlots: 7, floorPackChance: 0.022, lokPetPrizeWeightMultiplier: 2.8, bonusCardCreditsPerLootBox: 7 },
  },
  {
    id: 'zero-day',
    react: REACTION_PRESETS.playerBob,
    name: 'Zero Day',
    handle: 'The Null Patch',
    tagline: 'Found the exploit nobody patched. Everything down here answers to it now.',
    bio: 'Walked into Null Sector looking for a way out and found a vulnerability nobody had named yet. Now anything in front of them can be frozen mid-process, picked up, and repurposed as a weapon against whatever comes next.',
    referenceArt: 'art/shadow-man.jpeg',
    palette: {
      ink: '#020617',
      body: '#052e1a',
      bodyDark: '#031a0f',
      accent: '#22c55e',
      accentBright: '#bbf7d0',
      skin: '#0f3d24',
      glow: '#4ade80',
    },
    rig: humanoidRig({ height: 20, width: 10, hood: true, torsoColor: 'bodyDark' }),
    stats: { maxHp: 104, speed: 96, power: 1, area: 1, haste: 1, magnet: 48, armor: 0.08, crit: 0.06, lifesteal: 0 },
    weapon: {
      id: 'buffer-overflow',
      name: 'Buffer Overflow',
      kind: 'projectile',
      description: 'Writes past the end of whatever it hits.',
      damage: 14,
      cooldownMs: 620,
      range: 300,
      speed: 300,
      count: 2,
      lifetimeMs: 1400,
      levelDamageScale: 0.24,
      impactIntensity: 2,
      color: '#22c55e',
    },
    ultimate: {
      id: 'root-access',
      name: 'Root Access',
      description: 'Full permissions, briefly. Nothing down here can stop them.',
      cooldownMs: 24000,
      durationMs: 3800,
      effect: { invulnerable: true, damageMult: 1.8, cooldownMult: 0.6 },
    },
    // Cast an ability button freezes up to 7 enemies in a cone in front of
    // Zero Day; drag-select the resulting "stone" enemies RTS-style, then
    // tap a target to throw the whole group. See zero-day-freeze-throw.md.
    freezeThrow: {
      coneRangeUnits: 260,
      coneAngleDeg: 100,
      maxFreezeTargets: 7,
      freezeDurationMs: 6000,
      castCooldownMs: 14000,
      throwDamage: 45,
      throwSpeed: 520,
    },
    unlock: { kind: 'clearArea', areaId: 'null-sector' },
  },
];

export const CHARACTERS_BY_ID: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export function getCharacter(id: string): CharacterDef {
  const found = CHARACTERS_BY_ID[id];
  if (!found) {
    throw new Error(`Unknown character id: ${id}`);
  }
  return found;
}

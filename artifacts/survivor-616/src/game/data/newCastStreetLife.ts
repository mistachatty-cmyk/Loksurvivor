import { humanoidRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';

/** Golden Hour: a tall, warm-lit figure in a long coat with a ring of low sunlight around the shoulders. */
function goldenHourRig(): SpriteRig {
  const rig = humanoidRig({ height: 25, width: 10, halo: true, flarePants: true, cape: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -16, y: 3, w: 32, h: 3, color: 'glow', z: 0 },
    { key: 'aura', x: -12, y: 8, w: 6, h: 18, color: 'accent', z: 0 },
    { key: 'aura', x: 6, y: 8, w: 6, h: 18, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -6, y: 24, w: 12, h: 2, color: 'accentBright', z: 10 },
    { key: 'crest', x: -2, y: 31, w: 4, h: 3, color: 'accentBright', z: 10 },
  );
  rig.pixelHeight = 34;
  return rig;
}

/** Quarry Kid: a small, quick figure with a hard hat and a rock slung over one shoulder. */
function quarryKidRig(): SpriteRig {
  const rig = humanoidRig({ height: 17, width: 8, cap: true, hunched: true, torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'crest', x: 3, y: 15, w: 8, h: 7, color: 'accent', z: 9 },
    { key: 'crest', x: 5, y: 17, w: 3, h: 3, color: 'accentBright', z: 10 },
  );
  return rig;
}

/** Lost-and-Found Lou: a long coat with oversized pockets, a pet carrier on one hip and a lantern in the other hand. */
function louRig(): SpriteRig {
  const rig = humanoidRig({ height: 22, width: 11, hood: true, flarePants: true, torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -10, y: 10, w: 6, h: 7, color: 'accentBright', z: 9 },
    { key: 'crest', x: 5, y: 8, w: 6, h: 6, color: 'accent', z: 9 },
    { key: 'aura', x: 9, y: 4, w: 4, h: 4, color: 'glow', z: 0 },
  );
  return rig;
}

/**
 * Street Life cast: the showpiece operator for the Street Life update, plus a boulder-loving fighter
 * and a LokPet Collector who profits from boulders (see crumblerReward in world.ts).
 */
export const NEW_CAST_STREET_LIFE: CharacterDef[] = [
  {
    id: 'golden-hour', name: 'Golden Hour', handle: 'Last Light Wins',
    tagline: 'The best minute of the day, on demand.',
    bio: 'Nobody agrees where she came from. She appears when the streetlights hit that low gold, and the whole block looks better for it. Her ring of sunlight cuts like glass, and when she calls the hour in, nothing can touch her.',
    palette: { ink: '#1a1008', body: '#c98a2b', bodyDark: '#5e3a10', accent: '#ffd36b', accentBright: '#fff6d6', skin: '#a8714a', glow: '#ffe08a' },
    rig: goldenHourRig(), stats: { maxHp: 118, speed: 100, power: 1.12, area: 1.15, haste: 1.04, magnet: 72, armor: 0.1, crit: 0.12, lifesteal: 0.01 },
    weapon: { id: 'sun-ring', name: 'Sun Ring', kind: 'orbit', description: 'Three rings of low sunlight spin around you, burst on contact and flare wide on a beat.', damage: 13, cooldownMs: 0, range: 66, speed: 3, count: 3, levelDamageScale: 0.27, impactIntensity: 2, color: '#ffd36b',
      milestones: [
        { level: 2, name: 'Long Shadow', description: 'A fourth ring joins the circle.', bonusCount: 1 },
        { level: 4, name: 'Lens Flare', description: 'Every hit throws a burst of light.', hitBurst: { radius: 52, damageMult: 0.45 } },
        { level: 6, name: 'Magic Hour', description: 'Every few seconds the whole circle flares wide, fast and hard.', surge: { everyMs: 6500, durationMs: 1600, radiusMult: 1.6, spinMult: 1.7, damageMult: 1.6 } },
        { level: 8, name: 'Golden Ratio', description: 'A fifth ring, bigger bursts and a longer flare.', bonusCount: 1, hitBurst: { radius: 70, damageMult: 0.6 }, surge: { everyMs: 5500, durationMs: 2100, radiusMult: 1.75, spinMult: 1.9, damageMult: 1.8 } },
      ] },
    ultimate: { id: 'golden-hour-call', name: 'Call The Hour', description: 'The light goes gold and she goes Gilded: nothing hurts her, everything she hits breaks.', cooldownMs: 26000, durationMs: 5000, effect: { invulnerable: true, damageMult: 1.4, novaDamage: 70, novaRadius: 200 } },
    ultimatePowerState: 'gilded',
    signatureTraits: ['Low-sun halo and long coat', 'Calls the Gilded state'], unlock: { kind: 'kills', count: 600 },
  },
  {
    id: 'quarry-kid', name: 'Quarry Kid', handle: 'Rolls With It',
    tagline: 'Small. Fast. Carrying a rock.',
    bio: 'She grew up behind the old quarry fence and learned that every big thing can be pushed if you hit it right. Her thrown rocks burst on impact and shake the crowd.',
    palette: { ink: '#16120d', body: '#8a6a42', bodyDark: '#4a3622', accent: '#e6b45c', accentBright: '#fde7b0', skin: '#b07a52', glow: '#f3c978' },
    rig: quarryKidRig(), stats: { maxHp: 92, speed: 118, power: 1.04, area: 1.05, haste: 1.1, magnet: 66, armor: 0.04, crit: 0.1, lifesteal: 0 },
    weapon: { id: 'pocket-rock', name: 'Pocket Rock', kind: 'nova', description: 'A burst of shattered stone rolls out around her and shoves everything back.', damage: 12, cooldownMs: 820, range: 90, levelDamageScale: 0.3, impactIntensity: 3, color: '#e6b45c' },
    ultimate: { id: 'quarry-avalanche', name: 'Avalanche', description: 'Every loose rock lets go at once: faster legs and a heavy crush around her.', cooldownMs: 23000, durationMs: 3600, effect: { speedMult: 1.4, damageMult: 1.3, novaDamage: 58, novaRadius: 175 } },
    ultimatePowerState: 'supersonic',
    signatureTraits: ['Hard hat and rock on the shoulder', 'Supersonic on the ultimate'], unlock: { kind: 'kills', count: 150 },
  },
  {
    id: 'lost-and-found-lou', name: 'Lost-and-Found Lou', handle: 'Finders Keepers',
    tagline: 'Everything turns up eventually.',
    bio: 'A night-shift attendant who kept every lost thing in the city and never threw one away. A lantern, a pet carrier and a coat full of claim tickets: he finds extra packs in cracked stone and the floor.',
    palette: { ink: '#14101c', body: '#4a5a7a', bodyDark: '#262e44', accent: '#f2c35c', accentBright: '#fff0c4', skin: '#9a6a4c', glow: '#ffd98a' },
    rig: louRig(), stats: { maxHp: 108, speed: 94, power: 1, area: 1.1, haste: 1, magnet: 90, armor: 0.08, crit: 0.07, lifesteal: 0 },
    weapon: { id: 'claim-ticket', name: 'Claim Ticket', kind: 'homing', description: 'Fires tracking claim tickets that bend toward the nearest threat.', damage: 12, cooldownMs: 640, range: 310, speed: 220, count: 2, lifetimeMs: 2400, levelDamageScale: 0.28, impactIntensity: 1, color: '#f2c35c' },
    ultimate: { id: 'lou-last-call', name: 'Last Call', description: 'The lost-and-found opens up: a wide sweep that nobody can follow him through.', cooldownMs: 25000, durationMs: 3600, effect: { invulnerable: true, damageMult: 1.25, novaDamage: 50, novaRadius: 165 } },
    lokPetCollector: { rank: 'LokMaster', extraTeamSlots: 2, floorPackChance: 0.011, lokPetPrizeWeightMultiplier: 1.7, bonusCardCreditsPerLootBox: 3 },
    signatureTraits: ['Lantern and pet carrier', 'Boulders can hide Lock Packs'], unlock: { kind: 'lokPetCards', count: 10 },
  },
];

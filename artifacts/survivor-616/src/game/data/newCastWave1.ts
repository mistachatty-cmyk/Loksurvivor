import { humanoidRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';

/** The Chairman: a seated, heavy frame on a throne of furniture, with chair legs spinning around it. */
function chairmanRig(): SpriteRig {
  const rig = humanoidRig({ height: 20, width: 12, bulk: true, seated: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -10, y: 2, w: 20, h: 3, color: 'bodyDark', z: 0 },
    { key: 'aura', x: -10, y: 5, w: 3, h: 18, color: 'bodyDark', z: 0 },
    { key: 'aura', x: 7, y: 5, w: 3, h: 18, color: 'bodyDark', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -6, y: 24, w: 12, h: 2, color: 'accentBright', z: 9 },
    { key: 'crest', x: -2, y: 14, w: 4, h: 3, color: 'accent', z: 9 },
  );
  rig.pixelHeight = 28;
  return rig;
}

/** Lake Effect: a hooded shape in a drifting white mantle, with a wide halo of falling snow. */
function lakeEffectRig(): SpriteRig {
  const rig = humanoidRig({ height: 23, width: 12, hood: true, flarePants: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -14, y: 3, w: 28, h: 3, color: 'glow', z: 0 },
    { key: 'aura', x: -12, y: 9, w: 24, h: 3, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -9, y: 20, w: 18, h: 3, color: 'accentBright', z: 8 },
    { key: 'crest', x: -3, y: 27, w: 6, h: 2, color: 'glow', z: 9 },
  );
  return rig;
}

/** Tollkeeper: a long coat, a tall peaked cap and a boom gate carried across the back. */
function tollkeeperRig(): SpriteRig {
  const rig = humanoidRig({ height: 24, width: 10, cap: true, cape: true, torsoColor: 'bodyDark' });
  rig.parts.push(
    { key: 'armR', x: 5, y: 12, w: 20, h: 2, color: 'accentBright', z: 9 },
    { key: 'armR', x: 9, y: 12, w: 3, h: 2, color: 'ink', z: 10 },
    { key: 'armR', x: 15, y: 12, w: 3, h: 2, color: 'ink', z: 10 },
    { key: 'crest', x: -4, y: 21, w: 8, h: 3, color: 'accent', z: 9 },
  );
  return rig;
}

/** Dead Letter: a thin figure with a sealed envelope for a face and a trail of loose pages. */
function deadLetterRig(): SpriteRig {
  const rig = humanoidRig({ height: 21, width: 8, hunched: true, visor: true, torsoColor: 'bodyDark', headColor: 'accentBright' });
  rig.parts.unshift(
    { key: 'aura', x: -13, y: 6, w: 6, h: 8, color: 'accentBright', z: 0 },
    { key: 'aura', x: -17, y: 12, w: 6, h: 8, color: 'glow', z: 0 },
  );
  rig.parts.push({ key: 'crest', x: -2, y: 16, w: 4, h: 3, color: 'accent', z: 9 });
  return rig;
}

/** First wave of new operators: a furniture-city heavyweight, a snow engine, a gate-keeper and a courier of lost mail. */
export const NEW_CAST_WAVE_1: CharacterDef[] = [
  {
    id: 'the-chairman', name: 'The Chairman', handle: 'Furniture City Throne',
    tagline: 'Never stands up. Never needs to.',
    bio: 'The last showroom foreman on the west side took a seat on a chair that never stopped rolling. Now four chair legs circle him like a board of directors, and every motion carries.',
    palette: { ink: '#1a1208', body: '#7c4a21', bodyDark: '#3f2410', accent: '#d9a441', accentBright: '#f7e2a8', skin: '#a8714a', glow: '#f0b955' },
    rig: chairmanRig(), stats: { maxHp: 150, speed: 74, power: 1.1, area: 1.2, haste: 0.94, magnet: 52, armor: 0.2, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'board-of-directors', name: 'Board of Directors', kind: 'orbit', description: 'Four chair legs spin around you and knock back whatever gets too close.', damage: 14, cooldownMs: 0, range: 64, speed: 2.6, count: 4, levelDamageScale: 0.26, impactIntensity: 3, color: '#d9a441',
      milestones: [
        { level: 2, name: 'Quorum', description: 'A fifth leg joins the circle.', bonusCount: 1 },
        { level: 4, name: 'Motion Carried', description: 'Every hit shakes loose a small burst of splinters.', hitBurst: { radius: 44, damageMult: 0.4 } },
        { level: 6, name: 'Hostile Takeover', description: 'Every few seconds the whole circle flares wide, fast and hard.', surge: { everyMs: 7000, durationMs: 1500, radiusMult: 1.5, spinMult: 1.6, damageMult: 1.5 } },
        { level: 8, name: 'Full Board', description: 'A sixth leg, bigger bursts and a longer flare.', bonusCount: 1, hitBurst: { radius: 62, damageMult: 0.55 }, surge: { everyMs: 6000, durationMs: 2000, radiusMult: 1.65, spinMult: 1.8, damageMult: 1.7 } },
      ] },
    ultimate: { id: 'chairman-adjourn', name: 'Meeting Adjourned', description: 'He finally stands. The whole room clears and he cannot be hurt while he does it.', cooldownMs: 27000, durationMs: 3400, effect: { invulnerable: true, damageMult: 1.4, novaDamage: 60, novaRadius: 190 } },
    signatureTraits: ['Seated on a rolling throne', 'Four-leg orbit'], unlock: { kind: 'default' },
  },
  {
    id: 'lake-effect', name: 'Lake Effect', handle: 'Whiteout Mother',
    tagline: 'It was clear a minute ago.',
    bio: 'Every winter the lake sends something inland, and it learned to walk. A slow, wide field of heavy snow follows her and chills everything inside it.',
    palette: { ink: '#0b1220', body: '#cfe3f2', bodyDark: '#587a95', accent: '#7cc4f2', accentBright: '#f1f8ff', skin: '#dcd3ca', glow: '#b8e2ff' },
    rig: lakeEffectRig(), stats: { maxHp: 112, speed: 86, power: 1, area: 1.5, haste: 1.05, magnet: 60, armor: 0.1, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'whiteout-field', name: 'Whiteout Field', kind: 'aura', description: 'A drifting field of heavy snow that chills and grinds down everything inside it.', damage: 5, cooldownMs: 340, range: 104, levelDamageScale: 0.33, impactIntensity: 1, statusEffectId: 'chilled', color: '#b8e2ff' },
    ultimate: { id: 'lake-effect-warning', name: 'Lake Effect Warning', description: 'The sky drops everything at once. A huge freezing blast, and she is untouchable inside it.', cooldownMs: 29000, durationMs: 3200, effect: { invulnerable: true, novaDamage: 85, novaRadius: 250, speedMult: 1.2 } },
    signatureTraits: ['Drifting white mantle', 'Chilling snow field'], unlock: { kind: 'default' },
  },
  {
    id: 'tollkeeper', name: 'Tollkeeper', handle: 'Gate Is Down',
    tagline: 'Everyone pays eventually.',
    bio: 'She worked the booth on the old bridge until the traffic stopped coming and the debts did not. Her boom gate swings down in front of her and rolls the street flat, then it comes back for the second payment.',
    palette: { ink: '#0d1117', body: '#1f3a5f', bodyDark: '#142640', accent: '#f2c744', accentBright: '#fff0b0', skin: '#8a5a44', glow: '#ffd866' },
    rig: tollkeeperRig(), stats: { maxHp: 118, speed: 94, power: 1.12, area: 1.1, haste: 0.98, magnet: 50, armor: 0.12, crit: 0.08, lifesteal: 0 },
    weapon: { id: 'boom-gate', name: 'Boom Gate', kind: 'wave', description: 'The gate swings down and sends a shock wave through the street, then a wider one follows.', damage: 22, cooldownMs: 1200, range: 130, count: 1, levelDamageScale: 0.32, impactIntensity: 3, color: '#f2c744',
      milestones: [
        { level: 2, name: 'Second Lane', description: 'A second gate swings the other way.', bonusCount: 1 },
        { level: 4, name: 'Late Fee', description: 'Every wave is answered by a wider, softer one a moment later.', echo: { delayMs: 420, damageMult: 0.55, radiusMult: 1.3 } },
        { level: 6, name: 'Rush Hour', description: 'Every third swing slams a ring around her.', every: { casts: 3, slam: { radius: 150, damageMult: 1.3 } } },
        { level: 8, name: 'Gridlock', description: 'A third gate, a bigger ring and a slowing hit.', bonusCount: 1, every: { casts: 3, slam: { radius: 190, damageMult: 1.6, statusEffectId: 'slow' } } },
      ] },
    ultimate: { id: 'tollkeeper-closed', name: 'Bridge Closed', description: 'Every gate drops at once. A wide slam while she stands her ground.', cooldownMs: 25000, durationMs: 3600, effect: { damageMult: 1.5, invulnerable: true, novaDamage: 55, novaRadius: 200 } },
    signatureTraits: ['Peaked cap and boom gate', 'Echoing gate wave'], unlock: { kind: 'default' },
  },
  {
    id: 'dead-letter', name: 'Dead Letter', handle: 'Return To Sender',
    tagline: 'Delivered. Eventually.',
    bio: 'Nobody can say whose mail it was. A courier made of every undeliverable envelope in the city fires sealed notes that pass through crowds and corrupt what they hit.',
    palette: { ink: '#14101a', body: '#e8dfc9', bodyDark: '#8c7f66', accent: '#b4443a', accentBright: '#fff7e0', skin: '#e8dfc9', glow: '#e4c9a0' },
    rig: deadLetterRig(), stats: { maxHp: 94, speed: 112, power: 1.06, area: 1, haste: 1.12, magnet: 66, armor: 0.02, crit: 0.14, lifesteal: 0 },
    weapon: { id: 'sealed-notice', name: 'Sealed Notice', kind: 'projectile', description: 'Sealed envelopes fly out and pass through the crowd, leaving their targets corrupted.', damage: 15, speed: 320, cooldownMs: 640, range: 520, count: 2, pierce: 3, levelDamageScale: 0.3, impactIntensity: 1, statusEffectId: 'corrupted', color: '#b4443a',
      milestones: [
        { level: 2, name: 'Certified', description: 'A third envelope joins each volley.', bonusCount: 1 },
        { level: 4, name: 'Forwarded', description: 'Envelopes pass through more enemies before they stop.' },
        { level: 6, name: 'Bulk Mail', description: 'Another envelope per volley.', bonusCount: 1 },
        { level: 8, name: 'Express Delivery', description: 'One more envelope, and every one hits harder.', bonusCount: 1 },
      ] },
    ultimate: { id: 'dead-letter-recall', name: 'Mass Recall', description: 'Every lost letter returns at once: faster legs, harder notes and a burst of paper.', cooldownMs: 22000, durationMs: 4000, effect: { speedMult: 1.4, damageMult: 1.5, cooldownMult: 0.7, novaDamage: 40, novaRadius: 150 } },
    signatureTraits: ['Sealed envelope for a face', 'Piercing corrupted notes'], unlock: { kind: 'default' },
  },
];

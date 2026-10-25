import { humanoidRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';

/** Spoke Queen: a cycling helmet, a long flared kit and a bicycle wheel humming behind each shoulder. */
function spokeQueenRig(): SpriteRig {
  const rig = humanoidRig({ height: 22, width: 8, cap: true, flarePants: true, torsoColor: 'bodyDark' });
  rig.parts.unshift(
    // Rear wheels: a glowing rim with a crossed pair of spokes and a hub, one behind each shoulder.
    { key: 'aura', x: -17, y: 7, w: 11, h: 11, color: 'accent', z: 0 },
    { key: 'aura', x: -15, y: 9, w: 7, h: 7, color: 'ink', z: 0 },
    { key: 'aura', x: 6, y: 7, w: 11, h: 11, color: 'accent', z: 0 },
    { key: 'aura', x: 8, y: 9, w: 7, h: 7, color: 'ink', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -12, y: 12, w: 1, h: 7, color: 'glow', z: 8 },
    { key: 'crest', x: -15, y: 12, w: 7, h: 1, color: 'glow', z: 8 },
    { key: 'crest', x: 11, y: 12, w: 1, h: 7, color: 'glow', z: 8 },
    { key: 'crest', x: 8, y: 12, w: 7, h: 1, color: 'glow', z: 8 },
    { key: 'crest', x: -7, y: 24, w: 14, h: 3, color: 'accentBright', z: 9 },
    { key: 'crest', x: -2, y: 14, w: 4, h: 4, color: 'accentBright', z: 9 },
  );
  rig.pixelHeight = 29;
  return rig;
}

/** Jackhammer Jean: a hard hat, a stripe-banded safety vest and a long jackhammer in one fist. */
function jackhammerRig(): SpriteRig {
  const rig = humanoidRig({ height: 21, width: 14, bulk: true, cap: true, torsoColor: 'body' });
  rig.parts.unshift({ key: 'aura', x: -13, y: 4, w: 26, h: 9, color: 'accentBright', z: 0 });
  rig.parts.push(
    { key: 'crest', x: -11, y: 14, w: 22, h: 2, color: 'accentBright', z: 8 },
    { key: 'crest', x: -11, y: 18, w: 22, h: 2, color: 'accentBright', z: 8 },
    { key: 'crest', x: -3, y: 22, w: 6, h: 3, color: 'accent', z: 9 },
    { key: 'armR', x: 9, y: 8, w: 4, h: 18, color: 'ink', z: 9 },
    { key: 'armR', x: 7, y: 5, w: 8, h: 4, color: 'glow', z: 9 },
    { key: 'armR', x: 8, y: -3, w: 6, h: 4, color: 'accent', z: 9 },
  );
  rig.pixelHeight = 29;
  return rig;
}

/** Two authored Character Creator operators: a fast wheel-orbiter and a slow, heavy road-breaker. */
export const CREATOR_PAIR_OPERATORS: CharacterDef[] = [
  {
    id: 'spoke-queen', name: 'Spoke Queen', handle: 'Critical Mass',
    tagline: 'One bike lane is a parade if you bring enough wheels.',
    bio: 'A courier who rode every closed street in the Sixth Ward until the wheels started riding with her. Three humming rims circle her at all times, and the whole block gets out of the way.',
    palette: { ink: '#0f1f1b', body: '#0f766e', bodyDark: '#134e4a', accent: '#a3e635', accentBright: '#fef08a', skin: '#8d5a3f', glow: '#5eead4' },
    rig: spokeQueenRig(), stats: { maxHp: 100, speed: 126, power: 1.05, area: 1.1, haste: 1.08, magnet: 68, armor: 0.05, crit: 0.1, lifesteal: 0 },
    weapon: { id: 'spoke-halo', name: 'Spoke Halo', kind: 'orbit', description: 'Three bicycle wheels spin around you and clip anything that gets close.', damage: 12, cooldownMs: 0, range: 68, speed: 3.4, count: 3, levelDamageScale: 0.23, impactIntensity: 2, color: '#a3e635' },
    ultimate: { id: 'spoke-critical-mass', name: 'Critical Mass', description: 'The whole ride shows up at once: faster legs, harder wheels and a shove that clears the lane.', cooldownMs: 23000, durationMs: 4200, effect: { speedMult: 1.5, damageMult: 1.5, novaDamage: 46, novaRadius: 145 } },
    signatureTraits: ['Wheels at the shoulder', 'Three-wheel spoke halo'], unlock: { kind: 'default' },
  },
  {
    id: 'jackhammer-jean', name: 'Jackhammer Jean', handle: 'Pothole Poet',
    tagline: 'Every street has a verse. She breaks it open.',
    bio: 'A road-crew foreman who learned that the city answers a hard enough knock. Her jackhammer sends a shiver down the asphalt, and the ground gives way under whatever is chasing her.',
    palette: { ink: '#1c1917', body: '#d97706', bodyDark: '#78350f', accent: '#f97316', accentBright: '#fde047', skin: '#7a4a35', glow: '#fbbf24' },
    rig: jackhammerRig(), stats: { maxHp: 136, speed: 92, power: 1.15, area: 1.18, haste: 0.92, magnet: 55, armor: 0.18, crit: 0.06, lifesteal: 0 },
    weapon: { id: 'jean-quake', name: 'Jackhammer Quake', kind: 'wave', description: 'Two shock waves roll out through the asphalt and can open potholes under the crowd.', damage: 24, cooldownMs: 1250, range: 150, count: 2, levelDamageScale: 0.26, impactIntensity: 4, impactTrigger: 'ground-shock', color: '#f97316', statusEffectId: 'slow' },
    ultimate: { id: 'jean-road-closed', name: 'Road Closed', description: 'She drops the barricade and the whole street shudders: a wide slam while she stands her ground.', cooldownMs: 26000, durationMs: 3800, effect: { novaDamage: 80, novaRadius: 185, damageMult: 1.3, invulnerable: true } },
    signatureTraits: ['Stripe-banded safety vest', 'Pothole-opening quake'], unlock: { kind: 'default' },
  },
];

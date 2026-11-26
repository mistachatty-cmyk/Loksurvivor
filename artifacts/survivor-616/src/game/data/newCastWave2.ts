import { humanoidRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';

/** Rink Rat: a low, quick skater in a hooded jersey with a trailing sweep of ice. */
function rinkRatRig(): SpriteRig {
  const rig = humanoidRig({ height: 19, width: 9, hood: true, hunched: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -16, y: 0, w: 14, h: 2, color: 'accentBright', z: 0 },
    { key: 'aura', x: -12, y: 3, w: 10, h: 2, color: 'glow', z: 0 },
  );
  rig.parts.push({ key: 'crest', x: -5, y: 17, w: 10, h: 2, color: 'accent', z: 9 });
  return rig;
}

/** Upstream Fenn: a lean runner with a fin crest and a ribbon of river water at the back. */
function upstreamRig(): SpriteRig {
  const rig = humanoidRig({ height: 21, width: 9, cape: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -14, y: 4, w: 6, h: 14, color: 'glow', z: 0 },
    { key: 'aura', x: -10, y: 8, w: 4, h: 10, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -2, y: 24, w: 4, h: 5, color: 'accentBright', z: 9 },
    { key: 'crest', x: -6, y: 15, w: 12, h: 2, color: 'accent', z: 8 },
  );
  return rig;
}

/** Pier Beacon: a tall coat topped with a lamp, with a sweeping ring of light at the feet. */
function pierBeaconRig(): SpriteRig {
  const rig = humanoidRig({ height: 25, width: 9, halo: true, flarePants: true, torsoColor: 'bodyDark' });
  rig.parts.unshift({ key: 'aura', x: -13, y: 0, w: 26, h: 2, color: 'glow', z: 0 });
  rig.parts.push(
    { key: 'crest', x: -3, y: 30, w: 6, h: 3, color: 'accentBright', z: 10 },
    { key: 'crest', x: -6, y: 17, w: 12, h: 2, color: 'accent', z: 9 },
  );
  rig.pixelHeight = 33;
  return rig;
}

/** Salvage Sal: a wide welded frame with a plated shoulder and a pile of scrap on the back. */
function salvageRig(): SpriteRig {
  const rig = humanoidRig({ height: 21, width: 15, bulk: true, visor: true, torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -12, y: 12, w: 8, h: 9, color: 'accent', z: 0 },
    { key: 'aura', x: 4, y: 14, w: 9, h: 7, color: 'body', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -10, y: 18, w: 8, h: 4, color: 'accentBright', z: 9 },
    { key: 'armR', x: 9, y: 8, w: 5, h: 12, color: 'ink', z: 9 },
  );
  return rig;
}

/** Second wave of new operators: these four are earned, not given. */
export const NEW_CAST_WAVE_2: CharacterDef[] = [
  {
    id: 'rink-rat', name: 'Rink Rat', handle: 'Center Ice',
    tagline: 'The ice was here first.',
    bio: 'Every winter the downtown rink fills up and one kid never leaves. Where she skates, the pavement freezes over in sheets that chill whatever is standing on it.',
    palette: { ink: '#0a1020', body: '#2a5d8f', bodyDark: '#17375a', accent: '#8fd6ff', accentBright: '#eaf8ff', skin: '#c99a7a', glow: '#a8e4ff' },
    rig: rinkRatRig(), stats: { maxHp: 98, speed: 120, power: 1, area: 1.15, haste: 1.1, magnet: 62, armor: 0.04, crit: 0.1, lifesteal: 0 },
    weapon: { id: 'fresh-sheet', name: 'Fresh Sheet', kind: 'hazard', description: 'Leaves a ring of fresh ice behind each hard turn that chills everything standing on it.', damage: 8, cooldownMs: 1700, range: 84, durationMs: 4200, levelDamageScale: 0.3, impactIntensity: 1, statusEffectId: 'chilled', color: '#8fd6ff' },
    ultimate: { id: 'rink-zamboni', name: 'Resurface', description: 'A full lap in one breath: she cannot be caught, and the ice goes down everywhere.', cooldownMs: 25000, durationMs: 3200, effect: { invulnerable: true, speedMult: 1.5, novaDamage: 45, novaRadius: 190 } },
    signatureTraits: ['Hooded jersey', 'Trailing ice sheets'], unlock: { kind: 'kills', count: 200 },
  },
  {
    id: 'upstream-fenn', name: 'Upstream Fenn', handle: 'Against The Current',
    tagline: 'Every dam is a staircase.',
    bio: 'He has run the river steps beside the Sixth Street dam every dawn for a decade. His soaked, tracking spray leaps toward the nearest threat and leaves everything it hits wet.',
    palette: { ink: '#06161c', body: '#0f6b7a', bodyDark: '#0a3d47', accent: '#3fd0c9', accentBright: '#c8fff4', skin: '#9c6b4f', glow: '#6ff0e0' },
    rig: upstreamRig(), stats: { maxHp: 104, speed: 110, power: 1.05, area: 1, haste: 1.06, magnet: 64, armor: 0.06, crit: 0.09, lifesteal: 0.02 },
    weapon: { id: 'leap-line', name: 'Leap Line', kind: 'homing', description: 'Fires leaping streams that bend toward the nearest threat and soak whatever they hit.', damage: 11, cooldownMs: 600, range: 320, speed: 230, count: 2, lifetimeMs: 2400, levelDamageScale: 0.28, impactIntensity: 1, statusEffectId: 'wet', color: '#6ff0e0',
      milestones: [
        { level: 2, name: 'Fish Ladder', description: 'A third stream joins each volley.', bonusCount: 1 },
        { level: 5, name: 'Spawning Run', description: 'One more stream per volley.', bonusCount: 1 },
        { level: 8, name: 'Whole River', description: 'One more stream, and every one hits harder.', bonusCount: 1 },
      ] },
    ultimate: { id: 'fenn-flood', name: 'Spring Flood', description: 'The river overtops the dam: faster, harder, and a wave of water out of him.', cooldownMs: 24000, durationMs: 3800, effect: { speedMult: 1.35, damageMult: 1.4, novaDamage: 50, novaRadius: 170 } },
    signatureTraits: ['Fin crest', 'Soaking tracking streams'], unlock: { kind: 'kills', count: 120 },
  },
  {
    id: 'pier-beacon', name: 'Pier Beacon', handle: 'Last Light Out',
    tagline: 'Somebody has to keep it lit.',
    bio: 'A lamp-keeper who stayed at the end of the pier after the harbor emptied. A ring of light pushes out from her at a steady beat, and what it touches is shoved back into the dark.',
    palette: { ink: '#0d0f1a', body: '#334155', bodyDark: '#1e293b', accent: '#fbbf24', accentBright: '#fff7d1', skin: '#b58461', glow: '#fde68a' },
    rig: pierBeaconRig(), stats: { maxHp: 124, speed: 88, power: 1.1, area: 1.25, haste: 1, magnet: 56, armor: 0.12, crit: 0.06, lifesteal: 0 },
    weapon: { id: 'harbor-sweep', name: 'Harbor Sweep', kind: 'nova', description: 'A ring of lamplight sweeps out from her and shoves everything back.', damage: 15, cooldownMs: 900, range: 100, levelDamageScale: 0.3, impactIntensity: 3, color: '#fde68a' },
    ultimate: { id: 'beacon-lit', name: 'Full Beam', description: 'The lamp turns all the way up. Nothing touches her and the ring grows huge.', cooldownMs: 27000, durationMs: 3400, effect: { invulnerable: true, damageMult: 1.5, novaDamage: 80, novaRadius: 240 } },
    signatureTraits: ['Lamp on the crown', 'Sweeping light ring'], unlock: { kind: 'clearArea', areaId: 'back-alley' },
  },
  {
    id: 'salvage-sal', name: 'Salvage Sal', handle: 'Scrap Cathedral',
    tagline: 'Nothing is junk until she says so.',
    bio: 'She runs the biggest yard on the south side and has welded every fender she ever hauled into one suit. Slow, plated and very hard to put down, she swings what is left of the scrap pile.',
    palette: { ink: '#14110d', body: '#6b5a45', bodyDark: '#3a2f22', accent: '#e07b39', accentBright: '#ffd9a8', skin: '#8b5a3c', glow: '#ffb067' },
    rig: salvageRig(), stats: { maxHp: 170, speed: 70, power: 1.2, area: 1.1, haste: 0.88, magnet: 48, armor: 0.26, crit: 0.05, lifesteal: 0 },
    weapon: { id: 'scrap-swing', name: 'Scrap Swing', kind: 'melee', description: 'A heavy arc of welded scrap that sweeps whatever is in front of her.', damage: 30, cooldownMs: 880, range: 62, levelDamageScale: 0.34, count: 1, impactIntensity: 4, color: '#e07b39' },
    ultimate: { id: 'sal-teardown', name: 'Teardown', description: 'She takes the whole block apart. Plated and untouchable, with a crushing blow around her.', cooldownMs: 28000, durationMs: 3600, effect: { invulnerable: true, damageMult: 1.6, novaDamage: 95, novaRadius: 210 } },
    signatureTraits: ['Welded scrap plating', 'Heavy scrap arc'], unlock: { kind: 'kills', count: 300 },
  },
];

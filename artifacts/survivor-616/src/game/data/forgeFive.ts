import { humanoidRig } from '@/game/sprites/rigs';
import type { CharacterDef, SpriteRig } from '@/game/types';

function glassRig(): SpriteRig {
  const rig = humanoidRig({ height: 25, width: 9, hood: true, torsoColor: 'bodyDark' });
  rig.parts.unshift({ key: 'aura', x: -12, y: 5, w: 24, h: 17, color: 'accent', z: 0 });
  rig.parts.push(
    { key: 'crest', x: -8, y: 28, w: 5, h: 8, color: 'glow', z: 8 },
    { key: 'crest', x: 3, y: 28, w: 5, h: 8, color: 'accentBright', z: 8 },
    { key: 'armR', x: 8, y: 12, w: 15, h: 2, color: 'accentBright', z: 9 },
  );
  rig.pixelHeight = 36;
  return rig;
}

function kilnRig(): SpriteRig {
  const rig = humanoidRig({ height: 22, width: 15, bulk: true, headColor: 'bodyDark', torsoColor: 'body' });
  rig.parts.push(
    { key: 'crest', x: -11, y: 20, w: 5, h: 9, color: 'accent', z: 8 },
    { key: 'crest', x: 6, y: 20, w: 5, h: 9, color: 'accent', z: 8 },
    { key: 'armR', x: 9, y: 12, w: 16, h: 5, color: 'bodyDark', z: 8 },
    { key: 'aura', x: 13, y: 18, w: 8, h: 5, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 29;
  return rig;
}

function seamRig(): SpriteRig {
  const rig = humanoidRig({ height: 24, width: 7, flarePants: true, torsoColor: 'bodyDark' });
  rig.parts.unshift(
    { key: 'aura', x: -17, y: 4, w: 11, h: 21, color: 'body', z: 0 },
    { key: 'aura', x: 6, y: 4, w: 11, h: 21, color: 'body', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -8, y: 27, w: 16, h: 2, color: 'accentBright', z: 8 },
    { key: 'armR', x: 6, y: 11, w: 19, h: 1, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 29;
  return rig;
}

function bellRig(): SpriteRig {
  const rig = humanoidRig({ height: 27, width: 12, hood: true, flarePants: true, torsoColor: 'ink' });
  rig.parts.push(
    { key: 'crest', x: -10, y: 19, w: 20, h: 4, color: 'accent', z: 8 },
    { key: 'crest', x: -6, y: 30, w: 12, h: 3, color: 'accentBright', z: 9 },
    { key: 'armL', x: -23, y: 12, w: 15, h: 4, color: 'body', z: 8 },
    { key: 'aura', x: -21, y: 16, w: 10, h: 9, color: 'glow', z: 9 },
  );
  rig.pixelHeight = 34;
  return rig;
}

function cometRig(): SpriteRig {
  const rig = humanoidRig({ height: 19, width: 9, cap: true, flarePants: true, torsoColor: 'body' });
  rig.parts.unshift(
    { key: 'aura', x: -17, y: 11, w: 11, h: 3, color: 'glow', z: 0 },
    { key: 'aura', x: -20, y: 6, w: 13, h: 2, color: 'accent', z: 0 },
  );
  rig.parts.push(
    { key: 'crest', x: -7, y: 23, w: 14, h: 3, color: 'accentBright', z: 9 },
    { key: 'armR', x: 6, y: 10, w: 15, h: 3, color: 'glow', z: 8 },
  );
  rig.pixelHeight = 27;
  return rig;
}

/** Five authored operators. Their signature weapons are kept off the shared loot pool. */
export const FORGE_FIVE: CharacterDef[] = [
  {
    id: 'vitrail', name: 'Vitrail', handle: 'Window Warden',
    tagline: 'Every broken window becomes a map.',
    bio: 'A former glazier who charts safe streets in fragments of luminous glass. Her mirrored panes cut a path through a crowd.',
    palette: { ink: '#111526', body: '#254579', bodyDark: '#121f40', accent: '#44d9ec', accentBright: '#f9d37d', skin: '#9b6247', glow: '#9feeff' },
    rig: glassRig(), stats: { maxHp: 102, speed: 108, power: 1.07, area: 1.05, haste: 1.02, magnet: 59, armor: 0.07, crit: 0.12, lifesteal: 0 },
    weapon: { id: 'vitrail-glass', name: 'Cathedral Scatter', kind: 'projectile', description: 'Reflecting stained-glass panes fan out and pierce the crowd.', damage: 19, cooldownMs: 760, range: 400, speed: 380, count: 3, lifetimeMs: 1400, pierce: 2, obstacleInteraction: 'reflect', levelDamageScale: 0.25, impactIntensity: 2, color: '#44d9ec' },
    ultimate: { id: 'vitrail-rose', name: 'Rose Window', description: 'A great rose window flashes open and blasts everything nearby.', cooldownMs: 24000, durationMs: 4200, effect: { novaDamage: 65, novaRadius: 170, damageMult: 1.6 } },
    signatureTraits: ['Glass-paned mantle', 'Reflecting shard volley'], unlock: { kind: 'default' },
  },
  {
    id: 'cinder-kiln', name: 'Cinder Kiln', handle: 'The Fired Hand',
    tagline: 'Makes a furnace out of rubble.',
    bio: 'An ironworker carrying a portable kiln in one arm. Each molten brick cools into a crushing blow.',
    palette: { ink: '#24120d', body: '#814026', bodyDark: '#351d1b', accent: '#ff7040', accentBright: '#ffd28d', skin: '#713e2b', glow: '#ffb04f' },
    rig: kilnRig(), stats: { maxHp: 145, speed: 86, power: 1.22, area: 1.12, haste: 0.9, magnet: 46, armor: 0.2, crit: 0.04, lifesteal: 0 },
    weapon: { id: 'kiln-brick', name: 'Kilnshot', kind: 'projectile', description: 'Throws heavy molten bricks that break through enemies.', damage: 35, cooldownMs: 1150, range: 335, speed: 290, count: 1, lifetimeMs: 1600, pierce: 2, levelDamageScale: 0.27, impactIntensity: 4, color: '#ff7040' },
    ultimate: { id: 'kiln-open', name: 'Open Furnace', description: 'The kiln doors open in a wave of heat and sparks.', cooldownMs: 27000, durationMs: 4000, effect: { novaDamage: 82, novaRadius: 155, damageMult: 1.65 } },
    signatureTraits: ['Forge-built shoulder armor', 'Molten brick impact'], unlock: { kind: 'default' },
  },
  {
    id: 'threadwake', name: 'Threadwake', handle: 'Signal Seamstress',
    tagline: 'Stitches the broken signal back together.',
    bio: 'A street tailor with a coat of trailing fiber. Her needles seek the loose seam in every hostile machine.',
    palette: { ink: '#151428', body: '#5c407e', bodyDark: '#282042', accent: '#ee83cf', accentBright: '#fff0bd', skin: '#bb8061', glow: '#86f0dd' },
    rig: seamRig(), stats: { maxHp: 92, speed: 120, power: 1.02, area: 0.98, haste: 1.16, magnet: 75, armor: 0.03, crit: 0.16, lifesteal: 0 },
    weapon: { id: 'threadwake-needle', name: 'Seeking Stitch', kind: 'homing', description: 'Threaded needles follow their targets and sew a glowing path.', damage: 17, cooldownMs: 610, range: 375, speed: 315, count: 2, lifetimeMs: 1900, pierce: 1, levelDamageScale: 0.25, impactIntensity: 1, color: '#ee83cf' },
    ultimate: { id: 'threadwake-unravel', name: 'Unravel', description: 'A web of bright seams closes around the block.', cooldownMs: 22000, durationMs: 4800, effect: { cooldownMult: 0.48, speedMult: 1.3, novaDamage: 42, novaRadius: 160 } },
    signatureTraits: ['Fiber-tail coat', 'Seeking threaded needles'], unlock: { kind: 'default' },
  },
  {
    id: 'quarry-choir', name: 'Quarry Choir', handle: 'Resonance Mason',
    tagline: 'Can hear the fault line in a wall.',
    bio: 'A demolition mason whose tuning bell finds the pitch of concrete. Its echo comes back carrying stone dust.',
    palette: { ink: '#151a21', body: '#56626c', bodyDark: '#28313d', accent: '#b6d6e3', accentBright: '#fff0c2', skin: '#725348', glow: '#8ad6f3' },
    rig: bellRig(), stats: { maxHp: 126, speed: 94, power: 1.12, area: 1.28, haste: 0.94, magnet: 54, armor: 0.14, crit: 0.07, lifesteal: 0 },
    weapon: { id: 'quarry-bell', name: 'Fault Bell', kind: 'projectile', description: 'Sends cracked bell clappers through ranks of enemies.', damage: 26, cooldownMs: 950, range: 355, speed: 330, count: 2, lifetimeMs: 1450, pierce: 2, levelDamageScale: 0.26, impactIntensity: 3, color: '#b6d6e3' },
    ultimate: { id: 'quarry-resonance', name: 'Foundation Note', description: 'The whole street rings with one enormous note.', cooldownMs: 25000, durationMs: 3800, effect: { novaDamage: 78, novaRadius: 190, damageMult: 1.45 } },
    signatureTraits: ['Bell-shoulder silhouette', 'Resonant clapper shot'], unlock: { kind: 'default' },
  },
  {
    id: 'comet-courier', name: 'Comet Courier', handle: 'Afterimage Runner',
    tagline: 'Delivers messages before they are sent.',
    bio: 'A rooftop runner in a star-metal visor, carrying the last fragments of a fallen satellite in a courier case.',
    palette: { ink: '#11152a', body: '#354a91', bodyDark: '#1d2855', accent: '#f5a9dc', accentBright: '#fff5c8', skin: '#9c674c', glow: '#7addff' },
    rig: cometRig(), stats: { maxHp: 88, speed: 142, power: 1.04, area: 0.92, haste: 1.2, magnet: 72, armor: 0.02, crit: 0.17, lifesteal: 0 },
    weapon: { id: 'courier-star', name: 'Courier Star', kind: 'homing', description: 'Launches star-metal messengers with a streak of blue light.', damage: 14, cooldownMs: 520, range: 430, speed: 420, count: 3, lifetimeMs: 1700, pierce: 1, levelDamageScale: 0.23, impactIntensity: 1, color: '#7addff' },
    ultimate: { id: 'courier-meteor', name: 'Express Orbit', description: 'A burst of orbital speed turns every shot into a streak.', cooldownMs: 21000, durationMs: 4300, effect: { speedMult: 1.8, cooldownMult: 0.5, invulnerable: true } },
    signatureTraits: ['Star-metal visor', 'Blue-tailed messenger stars'], unlock: { kind: 'default' },
  },
];

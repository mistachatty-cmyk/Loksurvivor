import type {
  AllyDef,
  DiscoveryDef,
  HubRoomDef,
  UpgradeDef,
} from '@/game/types';

/* ------------------------------------------------------------------ */
/* Rescued allies                                                      */
/* ------------------------------------------------------------------ */

/**
 * Allies start each run trapped somewhere in the area. Free them and they
 * move into the hideout permanently and hand every character a stat boost.
 */
export const ALLIES: AllyDef[] = [
  {
    id: 'vee',
    name: 'Vee',
    role: 'Corner store owner',
    blurb: 'Kept the variety store open through all of it. Knows which alley connects to which and who owes who.',
    room: 'main-floor',
    boost: { magnet: 18 },
    boostLabel: '+18 pickup range',
    palette: {
      ink: '#1a1208', body: '#d97706', bodyDark: '#78350f', accent: '#fbbf24',
      accentBright: '#fef3c7', skin: '#b45309', glow: '#fbbf24',
    },
  },
  {
    id: 'deacon',
    name: 'Deacon Bells',
    role: 'Bell tower keeper',
    blurb: 'Rings the hour whether or not anyone is listening. Rigged the hideout door with something loud.',
    room: 'main-floor',
    boost: { armor: 0.06, maxHp: 12 },
    boostLabel: '+6% armor, +12 max HP',
    palette: {
      ink: '#0d1117', body: '#475569', bodyDark: '#1e293b', accent: '#94a3b8',
      accentBright: '#e2e8f0', skin: '#64748b', glow: '#cbd5e1',
    },
  },
  {
    id: 'nyx',
    name: 'Nyx',
    role: 'Rooftop tagger',
    blurb: 'Paints the skyline in colors the city keeps trying to buff. Knows every fire escape by feel.',
    room: 'rooftop-perch',
    boost: { speed: 8 },
    boostLabel: '+8 move speed',
    palette: {
      ink: '#1b0a1a', body: '#db2777', bodyDark: '#831843', accent: '#f9a8d4',
      accentBright: '#fce7f3', skin: '#9d174d', glow: '#f472b6',
    },
  },
  {
    id: 'sable',
    name: 'Sable',
    role: 'Crate digger',
    blurb: 'Was down in the cellar cataloguing records nobody pressed. Runs the hideout sound system now.',
    room: 'the-cellar',
    boost: { power: 0.08 },
    boostLabel: '+8% damage',
    palette: {
      ink: '#0a1410', body: '#0f766e', bodyDark: '#134e4a', accent: '#5eead4',
      accentBright: '#ccfbf1', skin: '#0d9488', glow: '#2dd4bf',
    },
  },
  {
    id: 'mamajo',
    name: 'Mama Jo',
    role: 'Kitchen',
    blurb: 'Held the bar floor with a cast iron pan until you got there. Feeds everyone before every run.',
    room: 'main-floor',
    boost: { maxHp: 25 },
    boostLabel: '+25 max HP',
    palette: {
      ink: '#1a0f0a', body: '#b91c1c', bodyDark: '#7f1d1d', accent: '#fca5a5',
      accentBright: '#fee2e2', skin: '#92400e', glow: '#f87171',
    },
  },
];

export const ALLIES_BY_ID: Record<string, AllyDef> = Object.fromEntries(
  ALLIES.map((a) => [a.id, a]),
);

/* ------------------------------------------------------------------ */
/* Hideout rooms                                                       */
/* ------------------------------------------------------------------ */

export const HUB_ROOMS: HubRoomDef[] = [
  {
    id: 'main-floor',
    name: 'The Sanctum',
    subtitle: 'Main floor',
    description:
      'A basement bar with the lights kept low on purpose. Everyone you have pulled off the street ends up here first.',
    backdrop: 'art/bar.jpeg',
    biome: 'sanctum',
    unlock: { kind: 'default' },
    features: ['runs', 'roster', 'vendor', 'allies', 'music', 'settings'],
  },
  {
    id: 'rooftop-perch',
    name: 'The Perch',
    subtitle: 'Rooftop recovery deck',
    description:
      'Tar paper, warm steam, a folding chair and the whole grid laid out below. Best place to let the city wait.',
    backdrop: 'art/rooftops.jpeg',
    biome: 'rooftop',
    unlock: { kind: 'discovery', discoveryId: 'alley-hatch' },
    features: ['runs', 'recovery', 'bestiary', 'unlocks', 'settings'],
  },
  {
    id: 'the-cellar',
    name: 'The Cellar',
    subtitle: 'Hidden room',
    description:
      'Behind the walk-in cooler, down a hatch nobody mentions. Lantern light, glass growths, and a record wall.',
    backdrop: 'art/cellar.jpeg',
    biome: 'cellar',
    unlock: { kind: 'discovery', discoveryId: 'lantern-shard' },
    features: ['music', 'bestiary', 'allies', 'unlocks', 'settings'],
  },
];

export const HUB_ROOMS_BY_ID: Record<string, HubRoomDef> = Object.fromEntries(
  HUB_ROOMS.map((r) => [r.id, r]),
);

/* ------------------------------------------------------------------ */
/* Discoveries                                                         */
/* ------------------------------------------------------------------ */

export const DISCOVERIES: DiscoveryDef[] = [
  { id: 'strip-mural', name: 'The Monroe Mural', blurb: 'A wall painting of five figures you have not all met yet.' },
  { id: 'alley-hatch', name: 'The Alley Hatch', blurb: 'A steel hatch under a crate. It opens on a stairway going down.' },
  { id: 'skyline-tag', name: 'Skyline Tag', blurb: 'Nyx signed the water tower in paint that only shows under streetlight.' },
  { id: 'lantern-shard', name: 'Lantern Shard', blurb: 'A splinter of the cellar glass. Warm to the touch, hums faintly.' },
  { id: 'sire-ledger', name: "The Sire's Ledger", blurb: 'A book of names and dates. Half the block is in it. So are you.' },
  { id: 'floodwall-mark', name: 'Floodwall Mark', blurb: 'A hand-painted arrow under the floodwall: east to the market, north to the rail cut.' },
  { id: 'market-bell', name: 'The Market Bell', blurb: 'A brass bell from the old market hall. Vee says it rang once for every person who made it home.' },
  { id: 'northline-switch', name: 'Northline Switch', blurb: 'A rail switch marked with the Sanctum symbol. Someone has been moving supplies under the city.' },
  { id: 'civic-fountain', name: 'The Civic Fountain', blurb: 'The plaza fountain still runs red at midnight, carrying the Sire’s oldest route toward the river.' },
];

export const DISCOVERIES_BY_ID: Record<string, DiscoveryDef> = Object.fromEntries(
  DISCOVERIES.map((d) => [d.id, d]),
);

/* ------------------------------------------------------------------ */
/* Level-up upgrades                                                   */
/* ------------------------------------------------------------------ */

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'sharper',
    name: 'Sharper',
    description: 'Signature weapon gains a level. More damage per hit.',
    weight: 12,
    maxStacks: 8,
    effects: [{ kind: 'weaponLevel', amount: 1 }],
  },
  {
    id: 'more-of-them',
    name: 'More Of Them',
    description: 'One extra projectile, bee or blade per activation.',
    weight: 7,
    maxStacks: 4,
    effects: [{ kind: 'weaponCount', amount: 1 }],
    weaponKinds: ['orbit', 'homing', 'projectile'],
  },
  {
    id: 'faster-hands',
    name: 'Faster Hands',
    description: 'Attacks come out 15% faster.',
    weight: 10,
    maxStacks: 6,
    effects: [{ kind: 'stat', stat: 'haste', mult: 0.85 }],
  },
  {
    id: 'wide-reach',
    name: 'Wide Reach',
    description: 'Everything you do covers 18% more ground.',
    weight: 9,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'area', mult: 1.18 }],
  },
  {
    id: 'heavy-hitter',
    name: 'Heavy Hitter',
    description: '+14% damage on everything.',
    weight: 10,
    maxStacks: 6,
    effects: [{ kind: 'stat', stat: 'power', mult: 1.14 }],
  },
  {
    id: 'track-shoes',
    name: 'Track Shoes',
    description: '+10 move speed.',
    weight: 8,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'speed', add: 10 }],
  },
  {
    id: 'thick-coat',
    name: 'Thick Coat',
    description: '+35 max HP and heal for the same amount.',
    weight: 8,
    maxStacks: 5,
    effects: [
      { kind: 'stat', stat: 'maxHp', add: 35 },
      { kind: 'heal', amount: 35 },
    ],
  },
  {
    id: 'kevlar-lining',
    name: 'Kevlar Lining',
    description: '+7% damage resistance.',
    weight: 6,
    maxStacks: 4,
    effects: [{ kind: 'stat', stat: 'armor', add: 0.07 }],
  },
  {
    id: 'magnet-hands',
    name: 'Magnet Hands',
    description: 'Pickups fly to you from 30 units further out.',
    weight: 6,
    maxStacks: 4,
    effects: [{ kind: 'stat', stat: 'magnet', add: 30 }],
  },
  {
    id: 'second-wind',
    name: 'Second Wind',
    description: 'Immediately restore 60 HP.',
    weight: 7,
    maxStacks: 99,
    effects: [{ kind: 'heal', amount: 60 }],
  },
  {
    id: 'short-fuse',
    name: 'Short Fuse',
    description: 'Ultimate recharges 20% faster.',
    weight: 6,
    maxStacks: 4,
    effects: [{ kind: 'ultimateCooldown', mult: 0.8 }],
  },
  {
    id: 'street-sense',
    name: 'Street Sense',
    description: 'A little of everything: +8% damage, +6 speed, +10 max HP.',
    weight: 5,
    maxStacks: 4,
    effects: [
      { kind: 'stat', stat: 'power', mult: 1.08 },
      { kind: 'stat', stat: 'speed', add: 6 },
      { kind: 'stat', stat: 'maxHp', add: 10 },
    ],
  },
  {
    id: 'overclocked',
    name: 'Overclocked',
    description: 'Weapon level up and 10% faster attacks, but -8 max HP.',
    weight: 4,
    maxStacks: 3,
    effects: [
      { kind: 'weaponLevel', amount: 1 },
      { kind: 'stat', stat: 'haste', mult: 0.9 },
      { kind: 'stat', stat: 'maxHp', add: -8 },
    ],
  },
  {
    id: 'crowd-control',
    name: 'Crowd Control',
    description: '+25% area and +10% damage. Built for tight alleys.',
    weight: 5,
    maxStacks: 3,
    effects: [
      { kind: 'stat', stat: 'area', mult: 1.25 },
      { kind: 'stat', stat: 'power', mult: 1.1 },
    ],
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

import { humanoidRig } from '@/game/sprites/rigs';
import type {
  AllyDef,
  DiscoveryDef,
  HubRoomDef,
  SpriteRig,
  UpgradeDef,
} from '@/game/types';

/**
 * Small rig built on the fly for a rescued ally -- AllyDef only carries a
 * palette, not a full rig, so every crew portrait (hideout room, archive)
 * derives its silhouette from this instead of showing raw reference art.
 * Base proportions still vary by `id.length` (kept for allies authored
 * before `rigHint` existed); `rigHint` layers one real silhouette flourish
 * on top so new crew don't all read as the same generic figure.
 * See crew-feature.md.
 */
export function allyRig(ally: AllyDef): SpriteRig {
  const height = 18 + (ally.id.length % 4);
  const width = 9 + (ally.id.length % 3);
  const seated = ally.rigHint === 'seated' || (!ally.rigHint && ally.id === 'sable');
  return humanoidRig({
    height,
    width,
    seated,
    hood: ally.rigHint === 'hood',
    cap: ally.rigHint === 'cap',
    bulk: ally.rigHint === 'bulk',
    hunched: ally.rigHint === 'hunched',
    wings: ally.rigHint === 'wings',
    staff: ally.rigHint === 'staff',
    puffs: ally.rigHint === 'puffs',
    halo: ally.rigHint === 'halo',
    cloudHair: ally.rigHint === 'cloudHair',
    flarePants: ally.rigHint === 'flarePants',
  });
}

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
    preferredActivityIds: ['sort-supplies', 'fortify-doors'],
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
    preferredActivityIds: ['fortify-doors', 'field-rations'],
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
    preferredActivityIds: ['scout-routes', 'mark-approach-lanes'],
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
    preferredActivityIds: ['tune-the-rig', 'study-anomalies'],
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
    preferredActivityIds: ['field-rations', 'sort-supplies'],
    palette: {
      ink: '#1a0f0a', body: '#b91c1c', bodyDark: '#7f1d1d', accent: '#fca5a5',
      accentBright: '#fee2e2', skin: '#92400e', glow: '#f87171',
    },
  },
  {
    id: 'bulbosa',
    name: 'Bulbosa',
    role: 'Bubbleteer commander',
    blurb: 'Led the crossing into the Bubblenaughts\' kingdom in her father\'s name, same as he led it in his. Whatever happened out there, it ended in something other than blood, and now she keeps a corner of the hideout blue and pink at once.',
    room: 'main-floor',
    boost: { area: 0.1 },
    boostLabel: '+10% area',
    preferredActivityIds: ['scout-routes', 'study-anomalies'],
    palette: {
      ink: '#22091a', body: '#db2777', bodyDark: '#831843', accent: '#f9a8d4',
      accentBright: '#fff0f7', skin: '#f6c9de', glow: '#ff9ecb',
    },
  },
  {
    id: 'morrow',
    name: 'Morrow',
    role: 'Night-shift transit photographer',
    blurb: 'Keeps a camera loaded with the last safe routes. Her long exposures catch doors and people the city tries to erase.',
    room: 'rooftop-perch',
    boost: { crit: 0.06, magnet: 8 },
    boostLabel: '+6% crit, +8 pickup range',
    preferredActivityIds: ['scout-routes', 'mark-approach-lanes'],
    palette: {
      ink: '#0b0b19', body: '#2d2a70', bodyDark: '#17153d', accent: '#a5b4fc',
      accentBright: '#eef2ff', skin: '#9a5b48', glow: '#c084fc',
    },
  },
  {
    id: 'cinder',
    name: 'Cinder Vale',
    role: 'Street mechanic',
    blurb: 'Can turn a seized motor into a barricade before the next chorus hits. Keeps the crew’s tools quieter than they should be.',
    room: 'the-cellar',
    boost: { haste: -0.035, armor: 0.025 },
    boostLabel: '3.5% faster cooldowns, +2.5% armor',
    preferredActivityIds: ['tune-the-rig', 'study-anomalies'],
    palette: {
      ink: '#11100d', body: '#435143', bodyDark: '#20291f', accent: '#b8d66b',
      accentBright: '#f1ffd0', skin: '#81533b', glow: '#d8ff7a',
    },
  },
  {
    id: 'pippa',
    name: 'Pippa Coil',
    role: 'Ration runner',
    blurb: 'Knows the block’s kitchen windows, locked pantries, and every person who still needs a hot meal before a run.',
    room: 'main-floor',
    boost: { maxHp: 14, lifesteal: 0.015 },
    boostLabel: '+14 max HP, +1.5% lifesteal',
    preferredActivityIds: ['field-rations', 'sort-supplies'],
    palette: {
      ink: '#1b0e12', body: '#a53d62', bodyDark: '#5c1c33', accent: '#ffb3c7',
      accentBright: '#fff0f4', skin: '#a85b43', glow: '#ff7ab8',
    },
  },

  /**
   * Second wave. `denny` also fixes a latent content bug: `riverfront`
   * listed `rescueAllyId: 'sable'`, duplicating crystal-cellar's rescue --
   * clearing whichever of the two second granted nothing new. See
   * crew-feature.md.
   */
  {
    id: 'denny',
    name: 'Denny Locke',
    role: 'Ferry hand',
    blurb: 'Still runs the crossing by hand-crank when the current gets weird, which is most nights now. Keeps a log of who came back and who didn\'t bother waiting for the ferry at all.',
    room: 'the-storefront',
    boost: { crit: 0.05 },
    boostLabel: '+5% crit',
    preferredActivityIds: ['walk-the-block', 'keep-the-lookbook'],
    rigHint: 'cap',
    palette: {
      ink: '#040d1a', body: '#1d4ed8', bodyDark: '#1e3a8a', accent: '#60a5fa',
      accentBright: '#dbeafe', skin: '#3b6ea5', glow: '#93c5fd',
    },
  },
  {
    id: 'ruth',
    name: 'Ruth Okafor',
    role: 'Market stall keeper',
    blurb: 'Ran the last honest stall in the old market and still does the books from memory. Knows every trade the block has made since before you got here.',
    room: 'the-alley',
    boost: { magnet: 16 },
    boostLabel: '+16 pickup range',
    preferredActivityIds: ['run-the-numbers', 'paint-a-mural'],
    rigHint: 'bulk',
    palette: {
      ink: '#171203', body: '#a16207', bodyDark: '#422006', accent: '#facc15',
      accentBright: '#fef9c3', skin: '#854d0e', glow: '#eab308',
    },
  },
  {
    id: 'frankie',
    name: 'Frankie Reyes',
    role: 'Rail yard signalman',
    blurb: 'Worked the switch by lantern long after the yard stopped running trains on schedule. Still logs every arrival, real or otherwise.',
    room: 'the-cellar',
    boost: { haste: -0.04 },
    boostLabel: '4% faster cooldowns',
    preferredActivityIds: ['catalog-the-vinyl', 'tune-the-rig'],
    rigHint: 'staff',
    palette: {
      ink: '#150e08', body: '#7c4a2d', bodyDark: '#3f2815', accent: '#d97757',
      accentBright: '#fde4d0', skin: '#8a5a3a', glow: '#e8926a',
    },
  },
  {
    id: 'constance',
    name: 'Sister Constance',
    role: 'Courthouse clerk',
    blurb: 'Kept the civic plaza\'s records straight through everything that happened there. Says the fountain remembers more than the ledgers do.',
    room: 'the-storefront',
    boost: { armor: 0.05 },
    boostLabel: '+5% armor',
    preferredActivityIds: ['file-the-ledgers', 'mind-the-register'],
    rigHint: 'halo',
    palette: {
      ink: '#1a170f', body: '#d4c19c', bodyDark: '#8a7550', accent: '#f5e6c8',
      accentBright: '#fffdf5', skin: '#c9a876', glow: '#f0dfb0',
    },
  },
  {
    id: 'theo',
    name: 'Theo Marsh',
    role: 'Fire-escape locksmith',
    blurb: 'Can open anything on Monroe with a bent wire and enough patience. Started teaching the trick to whoever asks nicely.',
    room: 'the-alley',
    boost: { power: 0.07 },
    boostLabel: '+7% damage',
    preferredActivityIds: ['weld-a-brace', 'sharpen-the-edges'],
    rigHint: 'hunched',
    palette: {
      ink: '#0a140d', body: '#166534', bodyDark: '#14532d', accent: '#4ade80',
      accentBright: '#dcfce7', skin: '#5c4033', glow: '#4ade80',
    },
  },
];

export const ALLIES_BY_ID: Record<string, AllyDef> = Object.fromEntries(
  ALLIES.map((a) => [a.id, a]),
);

/**
 * Each authored arena can return to the rescue route after its first ally is
 * safe. This makes later crew recruitable through normal play instead of
 * adding inaccessible records to the archive.
 */
export const RESCUE_ROUTE_BY_AREA: Record<string, string[]> = {
  'monroe-strip': ['vee', 'pippa', 'theo'],
  rooftops: ['nyx', 'morrow'],
  'crystal-cellar': ['sable', 'cinder'],
};
// riverfront/old-market/northline-yard/civic-plaza each grant exactly one
// ally via their own `AreaDef.rescueAllyId` (denny/ruth/frankie/constance)
// -- same single-rescue pattern as back-alley/bar-siege/haven-of-the-bubs,
// which is why they're not listed here. Only areas with a genuine replay
// chain (more than one ally) belong in this table.

export function nextRescueAllyId(
  areaId: string,
  rescuedAllyIds: string[],
  fallbackAllyId?: string,
): string | undefined {
  const rescued = new Set(rescuedAllyIds);
  const route = RESCUE_ROUTE_BY_AREA[areaId];
  if (route) return route.find((allyId) => !rescued.has(allyId));
  return fallbackAllyId && !rescued.has(fallbackAllyId) ? fallbackAllyId : undefined;
}

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
    features: ['runs', 'roster', 'vendor', 'workshop', 'allies', 'music', 'settings', 'palette-store', 'account', 'feedback'],
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
    features: ['runs', 'recovery', 'bestiary', 'unlocks', 'settings', 'palette-store', 'account', 'feedback'],
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
    features: ['music', 'bestiary', 'allies', 'unlocks', 'settings', 'palette-store', 'account', 'feedback'],
  },
  {
    id: 'the-alley',
    name: 'The Alley Annex',
    subtitle: 'Back-door workshop',
    description:
      'A fire-escape and a propped-open service door. Crates of salvage, a workbench, and a lamp that never quite goes out.',
    backdrop: 'art/alley.jpeg',
    biome: 'alley',
    unlock: { kind: 'discovery', discoveryId: 'floodwall-mark' },
    features: ['vendor', 'workshop', 'allies', 'settings', 'palette-store', 'account', 'feedback'],
  },
  {
    id: 'the-storefront',
    name: 'The Storefront',
    subtitle: 'Street-level records room',
    description:
      'A shuttered storefront with the old ledger books still on the counter. Every name in the neighborhood ends up here eventually.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    unlock: { kind: 'discovery', discoveryId: 'sire-ledger' },
    features: ['bestiary', 'unlocks', 'allies', 'settings', 'palette-store', 'account', 'feedback'],
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
  { id: 'bubble-truce', name: 'The Bubble Truce', blurb: 'Two family lines, one rivalry passed down twice over, and one afternoon where nobody could remember why they were still fighting.' },
  { id: 'choir-hymn', name: 'The Choir\'s Hymn', blurb: 'Twenty verses, one voice each, none of them singing anything you could ever hum back.' },
  { id: 'arcade-high-score', name: 'The High Score', blurb: 'A cabinet screen still glowing under the dust, top of the board initials burned into the phosphor.' },
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
    id: 'lucky-strike',
    name: 'Lucky Strike',
    description: '+8% critical hit chance. Crits deal double damage.',
    weight: 8,
    maxStacks: 6,
    effects: [{ kind: 'stat', stat: 'crit', add: 0.08 }],
  },
  {
    id: 'vampiric',
    name: 'Vampiric',
    description: 'Heal for 6% of all damage dealt.',
    weight: 7,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'lifesteal', add: 0.06 }],
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
  {
    id: 'lucky-strike',
    name: 'Lucky Strike',
    description: '+8% chance to hit for double damage.',
    weight: 7,
    maxStacks: 6,
    effects: [{ kind: 'stat', stat: 'crit', add: 0.08 }],
  },
  {
    id: 'vampiric',
    name: 'Vampiric',
    description: 'Heal for 4% of the damage you deal.',
    weight: 7,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'lifesteal', add: 0.04 }],
  },
  {
    id: '33-rpm',
    name: '33 RPM',
    description: 'Slower, heavier attacks: -15% attack speed, +45% damage.',
    weight: 5,
    maxStacks: 3,
    effects: [
      { kind: 'stat', stat: 'haste', mult: 1.15 },
      { kind: 'stat', stat: 'power', mult: 1.45 },
    ],
    weaponKinds: ['projectile'],
  },
  {
    id: 'color-correct',
    name: 'Color Correct',
    description: 'Everything caught without its color takes 5% more damage from all sources.',
    weight: 6,
    maxStacks: 4,
    effects: [{ kind: 'stat', stat: 'power', mult: 1.05 }],
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

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
    preferredActivityIds: ['sort-supplies', 'fortify-doors', 'count-the-sheep'],
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
    preferredActivityIds: ['fortify-doors', 'field-rations', 'count-the-sheep'],
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
    preferredActivityIds: ['scout-routes', 'mark-approach-lanes', 'chart-the-horde', 'raise-the-palings'],
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
    preferredActivityIds: ['tune-the-rig', 'study-anomalies', 'tune-the-moon'],
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
    preferredActivityIds: ['field-rations', 'sort-supplies', 'cook-the-last-feast'],
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
    preferredActivityIds: ['cook-the-last-feast', 'count-the-sheep'],
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
    preferredActivityIds: ['scout-routes', 'mark-approach-lanes', 'chart-the-horde', 'raise-the-palings'],
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
    preferredActivityIds: ['tune-the-rig', 'study-anomalies', 'tune-the-moon'],
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
    preferredActivityIds: ['field-rations', 'sort-supplies', 'cook-the-last-feast'],
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
    // 'the-storefront' redirects straight to the card-shop screen (see
    // App.tsx's onChangeRoom special case) and never renders its own room
    // view, so an ally assigned there is permanently unreachable -- moved
    // to 'main-floor' instead. See .agents/memory/grpd-station.md's
    // cautionary section for the sibling bug this matches.
    room: 'main-floor',
    boost: { crit: 0.05 },
    boostLabel: '+5% crit',
    preferredActivityIds: ['walk-the-block', 'keep-the-lookbook', 'count-the-sheep'],
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
    preferredActivityIds: ['run-the-numbers', 'paint-a-mural', 'forge-the-banners'],
    rigHint: 'bulk',
    palette: {
      ink: '#171203', body: '#a16207', bodyDark: '#422006', accent: '#facc15',
      accentBright: '#fef9c3', skin: '#854d0e', glow: '#eab308',
    },
  },
  {
    id: 'frankie',
    name: 'Frankie Reyes',
    role: 'Rail yard switch operator',
    blurb: 'Worked the switch by lantern long after the yard stopped running trains on schedule. Still logs every arrival, real or otherwise.',
    room: 'the-cellar',
    boost: { haste: -0.04 },
    boostLabel: '4% faster cooldowns',
    preferredActivityIds: ['catalog-the-vinyl', 'tune-the-rig', 'mix-the-elixir'],
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
    room: 'main-floor',
    boost: { armor: 0.05 },
    boostLabel: '+5% armor',
    preferredActivityIds: ['file-the-ledgers', 'mind-the-register', 'count-the-sheep'],
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
    preferredActivityIds: ['weld-a-brace', 'sharpen-the-edges', 'forge-the-banners'],
    rigHint: 'hunched',
    palette: {
      ink: '#0a140d', body: '#166534', bodyDark: '#14532d', accent: '#4ade80',
      accentBright: '#dcfce7', skin: '#5c4033', glow: '#4ade80',
    },
  },
  {
    id: 'otis',
    name: 'Otis',
    role: 'Arcade repairman',
    blurb: 'Kept the Neon Arcade cabinets running years past when anyone should have. Says the machines still owe him a rematch.',
    room: 'the-back-room',
    boost: { crit: 0.05 },
    boostLabel: '+5% crit chance',
    preferredActivityIds: ['rewire-the-cabinets', 'run-the-high-score-board', 'repair-the-cabinets'],
    rigHint: 'cap',
    palette: {
      ink: '#1a0e00', body: '#b45309', bodyDark: '#78350f', accent: '#fde047',
      accentBright: '#fef9c3', skin: '#c2410c', glow: '#fde047',
    },
  },
  {
    id: 'archivist',
    name: 'Archivist',
    role: 'Rogue process',
    blurb: 'Something in Null Sector that kept a log nobody asked it to. Followed the exit route out and never stopped indexing the hideout.',
    room: 'the-cellar',
    boost: { crit: 0.04 },
    boostLabel: '+4% crit chance',
    preferredActivityIds: ['study-anomalies', 'press-new-records'],
    palette: {
      ink: '#020617', body: '#052e1a', bodyDark: '#031a0f', accent: '#22c55e',
      accentBright: '#bbf7d0', skin: '#0f3d24', glow: '#4ade80',
    },
  },
  {
    id: 'sarge',
    name: 'Sarge Holloway',
    role: 'Last officer standing',
    blurb: 'Never got the call to stand down, so she never did. Still runs the station like the shift never ended.',
    room: 'grpd-station',
    boost: { armor: 0.03 },
    boostLabel: '+3% armor',
    preferredActivityIds: ['run-the-drills', 'inspect-the-lockers'],
    rigHint: 'cap',
    palette: {
      ink: '#0a0f1a', body: '#1e3a5f', bodyDark: '#0b192c', accent: '#facc15',
      accentBright: '#fef08a', skin: '#334155', glow: '#93c5fd',
    },
  },
  {
    id: 'patch-mercer',
    name: 'Patch Mercer',
    role: 'Rapid Digi-Arch maintainer',
    blurb: 'Kept three emergency rooms pressurized with a watch battery and stripped wiring after both Digi-Arches went dark.',
    room: 'rapid-shelter',
    boost: { haste: -0.03 },
    boostLabel: '3% faster cooldowns',
    preferredActivityIds: ['cycle-the-air', 'seal-the-hatches'],
    rigHint: 'hood',
    palette: {
      ink: '#052e16', body: '#166534', bodyDark: '#14532d', accent: '#22d3ee',
      accentBright: '#cffafe', skin: '#3f6212', glow: '#86efac',
    },
  },
  {
    id: 'mara-vance',
    name: 'Mara Vance',
    role: 'Rapid pressure runner',
    blurb: 'Moved air canisters between sealed rooms whenever the pressure locks cycled. Never left anyone alone long enough to panic.',
    room: 'rapid-shelter',
    boost: { speed: 5 },
    boostLabel: '+5 move speed',
    preferredActivityIds: ['relay-the-pressure', 'seal-the-hatches'],
    rigHint: 'puffs',
    palette: {
      ink: '#172554', body: '#1d4ed8', bodyDark: '#1e3a8a', accent: '#86efac',
      accentBright: '#dcfce7', skin: '#92400e', glow: '#67e8f9',
    },
  },
  {
    id: 'latch-brooks',
    name: 'Latch Brooks',
    role: 'Rapid emergency-door keeper',
    blurb: 'Held the manual pressure wheel shut while Data-Gobs chewed the door code out from the other side.',
    room: 'rapid-shelter',
    boost: { maxHp: 16 },
    boostLabel: '+16 max HP',
    preferredActivityIds: ['seal-the-hatches', 'cycle-the-air'],
    rigHint: 'bulk',
    palette: {
      ink: '#1c1917', body: '#57534e', bodyDark: '#292524', accent: '#facc15',
      accentBright: '#fef9c3', skin: '#7c2d12', glow: '#86efac',
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
  'rapid-pressure-rooms': ['patch-mercer', 'mara-vance', 'latch-brooks'],
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
    kind: 'hideout',
    name: 'The Sanctum',
    subtitle: 'Main floor',
    description:
      'A basement bar with the lights kept low on purpose. Everyone you have pulled off the street ends up here first.',
    backdrop: 'art/bar.jpeg',
    biome: 'sanctum',
    unlock: { kind: 'default' },
    features: ['runs', 'roster', 'allies', 'settings', 'account', 'feedback'],
  },
  {
    id: 'rooftop-perch',
    kind: 'hideout',
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
    kind: 'hideout',
    name: 'The Cellar',
    subtitle: 'Hidden room',
    description:
      'Behind the walk-in cooler: your playable cabinets and the crypto-mining rigs. Nothing else competes for the cellar floor.',
    backdrop: 'art/cellar.jpeg',
    biome: 'cellar',
    unlock: { kind: 'discovery', discoveryId: 'lantern-shard' },
    features: ['allies', 'settings', 'account', 'feedback'],
  },
  {
    id: 'the-alley',
    kind: 'hideout',
    name: 'The Alley Annex',
    subtitle: 'Back-door workshop',
    description:
      'A fire-escape and a propped-open service door. Crates of salvage, a workbench, and a lamp that never quite goes out.',
    backdrop: 'art/alley.jpeg',
    biome: 'alley',
    unlock: { kind: 'discovery', discoveryId: 'floodwall-mark' },
    features: ['vendor', 'workshop', 'allies', 'settings', 'account', 'feedback'],
  },
  {
    id: 'the-storefront',
    kind: 'travel',
    name: 'The Neon Sleeve',
    subtitle: 'The Neon Sleeve',
    description:
      'A bright little storefront where Lock Packs, passive decks, duplicate cards, and rare variants change hands under a humming sign.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    // A travel destination outside the hideout. Selecting it launches the
    // Neon Sleeve shop immediately through App's room routing.
    unlock: { kind: 'default' },
    features: ['card-shop'],
  },
  {
    id: 'studio-28',
    kind: 'travel',
    name: 'Studio 28',
    subtitle: 'One-screen picture house',
    description:
      'Used to be the coolest theatre on this stretch of the city, and it still thinks it is. The marquee bulbs are hand-replaced one at a time, the popcorn machine runs on spite, and the booth never went dark, not even during what everyone on this block still calls the eclipse. Come sundown the projectionist curates tonight’s show — including which weapons are cleared to leave the lobby.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    // A travel destination outside the hideout, like 'the-storefront'.
    // Selecting it launches the weapon-bans screen immediately through
    // App's room routing.
    unlock: { kind: 'default' },
    features: ['weapon-bans'],
  },
  {
    id: 'the-back-room',
    kind: 'hideout',
    name: 'The Back Room',
    subtitle: 'Salvaged cabinet row',
    description:
      'Otis dragged three dead cabinets up from the arcade and got two of them glowing again. Nobody has beaten his high score yet.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    unlock: { kind: 'discovery', discoveryId: 'arcade-high-score' },
    features: ['allies', 'bestiary', 'unlocks', 'settings', 'account', 'feedback'],
  },
  {
    id: 'the-sound-booth',
    kind: 'hideout',
    name: 'The Sound Booth',
    subtitle: 'Patch bay and foldback',
    description:
      'A converted phone-booth-sized closet wired with a patch bay and a foldback speaker. Every hit and pickup out on the streets gets its character mixed in here.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    // Same reasoning as the-storefront: a Hideout destination from the start
    // so a fresh player can always find where their loot-token SFX packs live.
    unlock: { kind: 'default' },
    features: ['music', 'studio', 'sound-booth', 'settings', 'account', 'feedback'],
  },
  {
    id: 'grpd-station',
    kind: 'travel',
    name: 'GRPD Station',
    subtitle: 'Division St.',
    description:
      'A rundown precinct off Division nobody ever formally closed. The Digital Archive terminal hums in back, and Rapid Guard runs the K9 counter by the old holding cells.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    unlock: { kind: 'discovery', discoveryId: 'grpd-station-found' },
    // 'recovery' opens the shared Recovery panel (RECOVERY_HUTS, filtered to
    // unlocked huts regardless of entry room) -- this is the only way to
    // reach the SWAT Sauna hut (grpd-swat-sauna) from the station itself;
    // it shipped in Stage 1 with the hut/facility data but this feature
    // literal was never added, so the room had no path to it. See
    // .agents/memory/grpd-station.md.
    features: ['director-terminal', 'kennel', 'vendor', 'allies', 'recovery', 'settings', 'account', 'feedback'],
  },
  {
    id: 'grpd-vault',
    kind: 'travel',
    name: 'The Vault',
    subtitle: 'Sealed evidence room',
    description:
      'The Site Crew finally cut through the super-safe door. Inside, one legendary K9 is still standing the last watch.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    unlock: { kind: 'clearArea', areaId: 'site-crew-active-zone' },
    features: [],
  },
  {
    id: 'rapid-shelter',
    kind: 'travel',
    name: 'Rapid Shelter',
    subtitle: 'Digi-Arch safe side',
    description:
      'The cut-off Rapid camp after the pressure rooms reopen. One Digi-Arch is stable enough for supply runs; the other stays under Patch’s wrench and everyone’s suspicion.',
    backdrop: 'art/street.jpeg',
    biome: 'archive',
    unlock: { kind: 'discovery', discoveryId: 'rapid-pressure-rooms-cleared' },
    features: ['runs', 'allies', 'recovery', 'settings', 'account', 'feedback'],
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
  { id: 'overflow-manual', name: 'The Overflow Manual', blurb: 'A laminated repair binder for machines that were never supposed to need repairing this often.' },
  { id: 'null-sector-log', name: 'The Null Sector Log', blurb: 'A maintenance log with no author field. Every entry ends the same way: "still running."' },
  { id: 'lev-core-archive', name: 'The Lev Core Archive', blurb: 'A cracked data slate salvaged from the singularity generator, still cycling schematics for a spire that was never finished.' },
  { id: 'bubble-wash-cleanse', name: 'The Bubble Wash Cleanse', blurb: 'A siren-triggered wall of suds that scours the whole basin clean twice a shift, whether or not anyone is still standing in it.' },
  { id: 'digital-soul-core', name: 'The Digital Soul Core', blurb: "A crystallized fragment of every human essence The Director's foundry has compiled so far. It hums when it recognizes a name." },
  { id: 'tree-null-log', name: 'The Tree Null Log', blurb: "A growth ring cut from Yggdrasil Null's trunk, its rings encoded instead of counted -- one bio-digital season per line." },
  { id: 'floodline-breach-log', name: 'Floodline Exchange Ledger', blurb: 'A transit ledger that kept printing 616 after the roots reached the platforms.' },
  { id: 'glassroot-annex-log', name: 'Glassroot Field Note', blurb: 'A field note mapping false trees around the buried shrine.' },
  { id: 'breach-616-plate', name: 'The 616 Plate', blurb: 'A fractured station plate found under the Floodline relays. Its rain-worn number follows you home.' },
  { id: 'transit-coil-found', name: 'The Transit Coil', blurb: 'An intact rail coil that powers the Catenary Harpoon.' },
  { id: 'grpd-station-found', name: 'GRPD Station — Division St.', blurb: 'A precinct nobody decommissioned on paper. The lights are still department-metered.' },
  { id: 'rapid-pressure-rooms-cleared', name: 'Rapid Shelter Reconnected', blurb: 'The Data-Gobs scattered, the pressure doors opened, and one Digi-Arch finally held a route long enough to bring the trapped Rapids through.' },
  { id: 'supabuilda-belt', name: 'Supabuilda Championship Belt', blurb: 'A scarred heavyweight belt taken from the Main Event Rack after the Heavy Floor finally went quiet.' },
  { id: 'site-crew-permit', name: 'Site Crew Work Permit', blurb: 'A stamped permit recovered from the moving pour. Every inspection box is checked except “leave the block alive.”' },
  { id: 'mirrorball-frequency', name: 'The Mirrorball Frequency', blurb: 'A pulse of broadcast noise looping under the parquet, still keeping time for a dance floor nobody unplugged.' },
  { id: 'firefly-crown-shard', name: 'Firefly Crown Shard', blurb: 'A dazzling subterranean shard pulsing with trapped bio-phosphor light salvaged from the Firefly Hollows.' },
  // 'grpd-vault-code' is deliberately absent -- the vault room references it
  // and is intentionally never unlockable yet. See grpd-vault in HUB_ROOMS
  // below and .agents/memory/grpd-station.md.
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

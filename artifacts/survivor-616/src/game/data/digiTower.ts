import type { LokPetElement } from '@/game/types';

export type DigiTowerFloorKind = 'random' | 'planned' | 'faction' | 'rest' | 'mirror' | 'master';

export interface DigiTowerOpponentDef {
  variantId: string;
  level: number;
  name: string;
}

export interface DigiTowerRule {
  title: string;
  description: string;
  /** The named element gains 20% damage on both sides; never affects healing or status ticks. */
  elementBoost?: LokPetElement;
  /** Optional three-signal cycle used by the final Grandmaster protocol. */
  elementRotation?: LokPetElement[];
}

export interface DigiTowerSectorDef {
  number: number;
  id: string;
  name: string;
  district: string;
  factionId: string;
  masterId: string;
  masterName: string;
  masterTitle: string;
  masterBlurb: string;
  story: string;
  motif: string;
  color: string;
  rule: DigiTowerRule;
  regularVariants: string[];
  masterTeam: DigiTowerOpponentDef[];
  masterReward: number;
  unlock: string;
}

export interface DigiTowerFloorDef {
  id: string;
  sector: DigiTowerSectorDef;
  floor: number;
  sectorFloor: number;
  kind: DigiTowerFloorKind;
  name: string;
  briefing: string;
  opponents: DigiTowerOpponentDef[];
  rule: DigiTowerRule;
  firstClearTokens: number;
  repeatXpPercent: number;
}

/** Tower themes build on the ten provisional Master figures; names and stories here are now authored playable content. */
export const DIGI_TOWER_SECTORS: DigiTowerSectorDef[] = [
  {
    number: 1, id: 'boot-sector', name: 'Boot Sector', district: 'The First Signal', factionId: 'data-goblins',
    masterId: 'nib', masterName: 'Master Nib', masterTitle: 'Keeper of the First Bits',
    masterBlurb: 'Nib does not guard the entrance to keep you out. He guards it so the Tower can tell whether you are ready to come in.',
    story: 'A green boot screen flickers awake beneath the city. Nib has been gathering loose code and feeding it to the first floor until nothing can remember its own shape.',
    motif: 'boot glyphs · scrap shrines · checksum bells', color: '#8bdd69',
    rule: { title: 'Loose Bits', description: 'Terra attacks deal 20% more damage for either team.', elementBoost: 'terra' },
    regularVariants: ['moss-pouncer', 'cinder-pouncer', 'tin-cricket', 'chalk-grin', 'signal-mote'],
    masterTeam: [
      { variantId: 'tin-cricket', level: 8, name: 'Nib’s First Byte' },
      { variantId: 'moss-pouncer', level: 8, name: 'Checksum Gnawer' },
      { variantId: 'cinder-pouncer', level: 9, name: 'Master Nib' },
    ], masterReward: 80, unlock: 'Clear one LokPet battle to trace the first signal.',
  },
  {
    number: 2, id: 'packet-alley', name: 'Packet Alley', district: 'The Lost Route', factionId: 'glitch-breach',
    masterId: 'dropframe', masterName: 'Master Dropframe', masterTitle: 'Warden of the Skipped Beat',
    masterBlurb: 'Dropframe never moves where the last frame said they were. Watch the tell, not the afterimage.',
    story: 'Packets arrive out of order and the alleys have started looping. Dropframe has a route through the noise, but will not share it with anyone who cannot keep their footing.',
    motif: 'broken arrows · frame echoes · split routes', color: '#ed83d0',
    rule: { title: 'Frame Skip', description: 'Glitch attacks deal 20% more damage; the bonus applies to either side.', elementBoost: 'glitch' },
    regularVariants: ['glitch-fox', 'pink-static', 'neon-gear', 'violet-husk', 'ink-wing'],
    masterTeam: [
      { variantId: 'glitch-fox', level: 16, name: 'Dropped Frame' },
      { variantId: 'pink-static', level: 16, name: 'Out-of-Order Packet' },
      { variantId: 'static-null', level: 17, name: 'Master Dropframe' },
    ], masterReward: 100, unlock: 'Defeat Master Nib in the Boot Sector.',
  },
  {
    number: 3, id: 'canopy-stack', name: 'Canopy Stack', district: 'The Living Cache', factionId: 'arbor-collective',
    masterId: 'rootkit', masterName: 'Master Rootkit', masterTitle: 'Gardener of the Unplanted',
    masterBlurb: 'Rootkit asks for no surrender. Only that you notice what has been growing under your feet.',
    story: 'A cache has rooted itself through the Tower’s service layer. The Arbor Collective is tending it, and Rootkit believes the growth is trying to tell them something.',
    motif: 'living cables · data leaves · root bridges', color: '#7ed67b',
    rule: { title: 'Rooted Circuit', description: 'Terra attacks deal 20% more damage; each side gets the same rule.', elementBoost: 'terra' },
    regularVariants: ['moss-pouncer', 'rain-jelly', 'plum-jelly', 'clockwork-beetle', 'prism-moth'],
    masterTeam: [
      { variantId: 'moss-pouncer', level: 23, name: 'Cache Sprout' },
      { variantId: 'clockwork-beetle', level: 23, name: 'Trellis Sentinel' },
      { variantId: 'prism-moth', level: 24, name: 'Master Rootkit' },
    ], masterReward: 120, unlock: 'Defeat Master Dropframe in Packet Alley.',
  },
  {
    number: 4, id: 'neon-overflow', name: 'Neon Overflow', district: 'The High Score', factionId: 'cabinet-rot',
    masterId: 'cabinet', masterName: 'Master Cabinet', masterTitle: 'Champion of the Endless Round',
    masterBlurb: 'Cabinet remembers every score ever entered. It still has room on the board for yours.',
    story: 'An arcade floor keeps starting one more round. The Cabinet Rot crowd is caught in a loop between the cabinet lights and the exit door.',
    motif: 'arcade marquees · token rain · boss-stage curtains', color: '#f579cf',
    rule: { title: 'Bonus Round', description: 'Light attacks deal 20% more damage for both teams.', elementBoost: 'light' },
    regularVariants: ['neon-gear', 'pink-static', 'solar-owl', 'prism-moth', 'plum-jelly'],
    masterTeam: [
      { variantId: 'neon-gear', level: 30, name: 'Insert Coin' },
      { variantId: 'solar-owl', level: 30, name: 'High Score Ghost' },
      { variantId: 'plasma-kitsune', level: 31, name: 'Master Cabinet' },
    ], masterReward: 140, unlock: 'Defeat Master Rootkit in Canopy Stack.',
  },
  {
    number: 5, id: 'lev-spire', name: 'Lev Spire', district: 'The Overclock Line', factionId: 'lev-syndicate',
    masterId: 'overclock', masterName: 'Master Overclock', masterTitle: 'Keeper of the Hot Path',
    masterBlurb: 'Overclock increases the speed until something gives. The exam is knowing when to slow down.',
    story: 'The Spire is routing every process through one overheating core. The Lev Syndicate calls it progress. The pets in the vents call it Tuesday.',
    motif: 'rising clock rings · cooling fins · speed lanes', color: '#ff9c49',
    rule: { title: 'Overclock', description: 'Volt attacks deal 20% more damage on both sides.', elementBoost: 'volt' },
    regularVariants: ['clockwork-beetle', 'chrono-hare', 'tin-cricket', 'neon-gear', 'magnet-ursa'],
    masterTeam: [
      { variantId: 'chrono-hare', level: 37, name: 'Race Condition' },
      { variantId: 'clockwork-beetle', level: 37, name: 'Cooling-Fin Guard' },
      { variantId: 'titan-colossus', level: 38, name: 'Master Overclock' },
    ], masterReward: 160, unlock: 'Defeat Master Cabinet in Neon Overflow.',
  },
  {
    number: 6, id: 'hollow-cache', name: 'Hollow Cache', district: 'The Lantern Index', factionId: 'firefly-wranglers',
    masterId: 'hollow', masterName: 'Master Hollow', masterTitle: 'Keeper of the Quiet Light',
    masterBlurb: 'Hollow counts the fireflies before every battle. If one is missing, the whole floor waits.',
    story: 'The cache is nearly dark. A swarm of fireflies is trapped between corrupted entries, and the Tower’s most patient keeper has gone inside to guide them out.',
    motif: 'lantern code · moth-wing shadows · soft checkpoints', color: '#e7d979',
    rule: { title: 'Firefly Cover', description: 'Dark attacks deal 20% more damage for either team.', elementBoost: 'dark' },
    regularVariants: ['ink-wing', 'chalk-grin', 'void-pup', 'shadow-mantis', 'violet-husk'],
    masterTeam: [
      { variantId: 'ink-wing', level: 44, name: 'Hollow’s Lantern' },
      { variantId: 'void-pup', level: 44, name: 'Cache Shadow' },
      { variantId: 'shadow-mantis', level: 45, name: 'Master Hollow' },
    ], masterReward: 180, unlock: 'Defeat Master Overclock in Lev Spire.',
  },
  {
    number: 7, id: 'reel-vault', name: 'Reel Vault', district: 'The Lost Take', factionId: 'reel-syndicate',
    masterId: 'reel', masterName: 'Master Reel', masterTitle: 'Editor of the Last Cut',
    masterBlurb: 'Reel leaves every mistake in the cut. The challenge is to find the scene that can still change.',
    story: 'The vault keeps replaying the same defeat. Reel has preserved every take, including the one where someone chose to help instead of win.',
    motif: 'film perforations · duplicate silhouettes · rewind marks', color: '#d8a6ff',
    rule: { title: 'Second Take', description: 'Aero attacks deal 20% more damage for both sides.', elementBoost: 'aero' },
    regularVariants: ['glitch-fox', 'prism-moth', 'solar-owl', 'nano-phoenix', 'chrono-hare'],
    masterTeam: [
      { variantId: 'glitch-fox', level: 51, name: 'The Alternate Cut' },
      { variantId: 'nano-phoenix', level: 51, name: 'One More Take' },
      { variantId: 'prism-moth', level: 52, name: 'Master Reel' },
    ], masterReward: 200, unlock: 'Defeat Master Hollow in Hollow Cache.',
  },
  {
    number: 8, id: 'null-basement', name: 'Null Basement', district: 'The Unplugged Floor', factionId: 'null-sector',
    masterId: 'null', masterName: 'Master Null', masterTitle: 'The Signal That Is Not There',
    masterBlurb: 'Null never asks what you brought. Only what you can still do without it.',
    story: 'The basement has no power, no network and no enemy on the entry board. Something is still attacking the lights from the inside.',
    motif: 'dead sockets · missing floor labels · negative space', color: '#8fb4d9',
    rule: { title: 'Null Field', description: 'Glitch attacks deal 20% more damage for either team.', elementBoost: 'glitch' },
    regularVariants: ['static-null', 'void-pup', 'pink-static', 'magnet-ursa', 'cyber-hydra'],
    masterTeam: [
      { variantId: 'static-null', level: 58, name: 'Unassigned Process' },
      { variantId: 'magnet-ursa', level: 58, name: 'No-Input Guard' },
      { variantId: 'cyber-hydra', level: 59, name: 'Master Null' },
    ], masterReward: 220, unlock: 'Defeat Master Reel in Reel Vault.',
  },
  {
    number: 9, id: 'prism-core', name: 'Prism Core', district: 'The Many-Sided Truth', factionId: 'prism-choir',
    masterId: 'prism', masterName: 'Master Prism', masterTitle: 'Voice of the Split Light',
    masterBlurb: 'Prism never repeats a move. It wants to know if your answer changes when the color does.',
    story: 'Every path through the core is real, and every mirror has learned a different version of the same song.',
    motif: 'color-split bridges · refracted rivals · choirglass', color: '#8ee7f2',
    rule: { title: 'Refracted Core', description: 'Light attacks deal 20% more damage for both sides.', elementBoost: 'light' },
    regularVariants: ['prism-moth', 'solar-owl', 'plasma-kitsune', 'cyber-hydra', 'nano-phoenix'],
    masterTeam: [
      { variantId: 'solar-owl', level: 65, name: 'First Refraction' },
      { variantId: 'cyber-hydra', level: 65, name: 'Choir of One' },
      { variantId: 'plasma-kitsune', level: 66, name: 'Master Prism' },
    ], masterReward: 240, unlock: 'Defeat Master Null in Null Basement.',
  },
  {
    number: 10, id: 'apex-terminal', name: 'Apex Terminal', district: 'The Last Checksum', factionId: 'null-sector',
    masterId: 'apex', masterName: 'Grandmaster Apex', masterTitle: 'The Final Terminal',
    masterBlurb: 'Apex has beaten every master, including the masters who never took the Tower test. It has been waiting for someone to make the rules interesting again.',
    story: 'Every sector is running at once. The Terminal has opened the last checksum and called every faction’s strongest signal to the top floor.',
    motif: 'ten-sector remix · all-faction echoes · dawn in the boot log', color: '#ffe89a',
    rule: { title: 'Apex Protocol', description: 'A rotating signal boosts Light, Volt, then Glitch attacks by 20% for both sides. The active element changes each round.', elementRotation: ['light', 'volt', 'glitch'] },
    regularVariants: ['titan-colossus', 'cyber-hydra', 'nano-phoenix', 'magnet-ursa', 'plasma-kitsune'],
    masterTeam: [
      { variantId: 'titan-colossus', level: 77, name: 'The Tenfold Gate' },
      { variantId: 'cyber-hydra', level: 78, name: 'All Sectors, One Voice' },
      { variantId: 'nano-phoenix', level: 80, name: 'Grandmaster Apex' },
    ], masterReward: 500, unlock: 'Defeat Master Prism and reach the endgame.',
  },
];

export const DIGI_TOWER_SECTORS_BY_ID: Record<string, DigiTowerSectorDef> = Object.fromEntries(DIGI_TOWER_SECTORS.map((sector) => [sector.id, sector]));

const FLOOR_NAMES: Record<number, { name: string; briefing: string }[]> = {
  1: [
    { name: 'Cold Boot', briefing: 'A single signal answers. The floor is checking that your partner can hear it.' },
    { name: 'Loose Memory', briefing: 'The first scraps have learned to travel together.' },
    { name: 'Checksum Shrine', briefing: 'A planned guardian protects the Tower’s first saved memory.' },
    { name: 'Goblin Muster', briefing: 'The Data Goblins have mistaken the entry stairs for a loading dock.' },
    { name: 'Checkpoint Garden', briefing: 'Restore the whole party, clear every battle status and choose one field supply before you climb again.' },
    { name: 'Dust Library', briefing: 'The dust mites are carrying fragments they do not understand.' },
    { name: 'Mite Parade', briefing: 'A faction floor: the mites have formed a very small, very serious army.' },
    { name: 'Mirror Cache', briefing: 'A friendly mirror makes a copy of your lead companion for practice.' },
    { name: 'Nib’s Test', briefing: 'The threshold guardian wants to see what you learned before the Master floor.' },
    { name: 'Master Nib', briefing: 'The first Master stands between you and the route up. This is a full-team trial.' },
  ],
};

/** Hand-authored names for each rung keep the 100-floor climb readable and memorable. */
const SECTOR_FLOOR_NAMES: Record<number, string[]> = {
  2: ['Wrong-Way Packet', 'The Alley Loops', 'Dropped Breadcrumbs', 'Out-of-Order Crew', 'Frame Buffer', 'Afterimage Market', 'The Missing Beat', 'Mirror Latency', 'Route Recovered', 'Master Dropframe'],
  3: ['Seed Cache', 'Cable Canopy', 'Root Bridge', 'Arbor Patrol', 'Living Checksum', 'Rain in the Stack', 'Keeper of Sap', 'Mirror Orchard', 'Cache Heart', 'Master Rootkit'],
  4: ['Insert Coin', 'Token Rain', 'Prize Counter', 'Cabinet Rot', 'Bonus Round', 'The Tilt Table', 'High-Score Parade', 'Mirror Cabinet', 'Final Credit', 'Master Cabinet'],
  5: ['Warm Start', 'Cooling-Fin Run', 'Clockwork Lane', 'Lev Courier Crew', 'Thermal Gate', 'The Hot Path', 'Race Condition', 'Mirror Sprint', 'Core at Redline', 'Master Overclock'],
  6: ['First Firefly', 'Lantern Index', 'Quiet Entry', 'Wrangler Watch', 'The Dimmer Switch', 'Wingbeat Archive', 'Shadow Procession', 'Mirror Lantern', 'Light Returned', 'Master Hollow'],
  7: ['Slate One', 'Retake Alley', 'The Cut Room', 'Director’s Crew', 'Continuity Error', 'Lost Take Vault', 'The Unedited Scene', 'Mirror Screening', 'One Good Ending', 'Master Reel'],
  8: ['No Carrier', 'Cold Socket', 'Unassigned Process', 'Basement Sweep', 'The Powerless Room', 'Silent Rack', 'Null-Sector Patrol', 'Mirror Without Light', 'Signal from Below', 'Master Null'],
  9: ['First Refraction', 'Split-Color Walk', 'Choirglass Gate', 'Prism Choir', 'Two True Paths', 'The Bent Spectrum', 'Lockstep Refrain', 'Mirror Chorus', 'All Colors Answer', 'Master Prism'],
  10: ['Tenfold Gate', 'Boot Echo', 'Alley Echo', 'Canopy Echo', 'Arcade Echo', 'Hot-Path Echo', 'Lantern Echo', 'Reel Echo', 'Null Echo', 'Grandmaster Apex'],
};

const FLOOR_BEATS: Record<number, string> = {
  1: 'A single scout tests the signal you brought into the Tower.',
  2: 'The route doubles back; watch for the opponent hiding in the familiar pattern.',
  3: 'A named guardian is holding a fragment needed to read this sector.',
  4: 'A full faction squad has assembled around its home-floor advantage.',
  5: 'The checkpoint vault restores the party. Choose a field supply before climbing again.',
  6: 'A specialist blocks the safest route and forces a change of battle plan.',
  7: 'A full two-pet squad closes around the route before the floor can be called clear.',
  8: 'The Tower generates a mirror of your lead partner. Treat it as a practice duel.',
  9: 'The sector’s last guardian checks whether you learned its field rule.',
  10: 'The sector Master is a three-pet trial. Their seal opens the next signal route.',
};

const VARIANT_TEAMS: Record<number, string[]> = {
  1: ['moss-pouncer', 'cinder-pouncer', 'tin-cricket', 'chalk-grin', 'signal-mote'],
  2: ['glitch-fox', 'pink-static', 'neon-gear', 'violet-husk', 'ink-wing'],
  3: ['moss-pouncer', 'rain-jelly', 'plum-jelly', 'clockwork-beetle', 'prism-moth'],
  4: ['neon-gear', 'pink-static', 'solar-owl', 'prism-moth', 'plum-jelly'],
  5: ['clockwork-beetle', 'chrono-hare', 'tin-cricket', 'neon-gear', 'magnet-ursa'],
  6: ['ink-wing', 'chalk-grin', 'void-pup', 'shadow-mantis', 'violet-husk'],
  7: ['glitch-fox', 'prism-moth', 'solar-owl', 'nano-phoenix', 'chrono-hare'],
  8: ['static-null', 'void-pup', 'pink-static', 'magnet-ursa', 'cyber-hydra'],
  9: ['prism-moth', 'solar-owl', 'plasma-kitsune', 'cyber-hydra', 'nano-phoenix'],
  10: ['titan-colossus', 'cyber-hydra', 'nano-phoenix', 'magnet-ursa', 'plasma-kitsune'],
};

/** Curated story guardians at sector floors 3 and 9; other teams are seed-built. */
const PLANNED_TEAMS: Record<number, Record<number, DigiTowerOpponentDef[]>> = {
  1: { 3: [{ variantId: 'chalk-grin', level: 5, name: 'Shrine Sentry' }], 9: [{ variantId: 'signal-mote', level: 9, name: 'Checksum Warden' }, { variantId: 'cinder-pouncer', level: 8, name: 'Last-Bit Guard' }] },
  2: { 3: [{ variantId: 'glitch-fox', level: 13, name: 'Route Auditor' }], 9: [{ variantId: 'pink-static', level: 16, name: 'Frame-Echo Keeper' }, { variantId: 'violet-husk', level: 15, name: 'Lost Packet' }] },
  3: { 3: [{ variantId: 'rain-jelly', level: 20, name: 'Canopy Tender' }], 9: [{ variantId: 'clockwork-beetle', level: 23, name: 'Root Bridge Guard' }, { variantId: 'plum-jelly', level: 22, name: 'Cache Bloom' }] },
  4: { 3: [{ variantId: 'neon-gear', level: 27, name: 'Prize-Counter Keeper' }], 9: [{ variantId: 'solar-owl', level: 30, name: 'High-Score Ghost' }, { variantId: 'pink-static', level: 29, name: 'Last Credit' }] },
  5: { 3: [{ variantId: 'chrono-hare', level: 34, name: 'Lev Track Marshal' }], 9: [{ variantId: 'magnet-ursa', level: 37, name: 'Hot-Path Sentinel' }, { variantId: 'tin-cricket', level: 36, name: 'Cooling Crew' }] },
  6: { 3: [{ variantId: 'chalk-grin', level: 41, name: 'Lantern Indexer' }], 9: [{ variantId: 'void-pup', level: 44, name: 'Quiet-Cache Keeper' }, { variantId: 'ink-wing', level: 43, name: 'Lantern Guide' }] },
  7: { 3: [{ variantId: 'glitch-fox', level: 48, name: 'Continuity Editor' }], 9: [{ variantId: 'nano-phoenix', level: 51, name: 'The Uncut Take' }, { variantId: 'chrono-hare', level: 50, name: 'Retake Runner' }] },
  8: { 3: [{ variantId: 'static-null', level: 55, name: 'Basement Auditor' }], 9: [{ variantId: 'magnet-ursa', level: 58, name: 'No-Input Guard' }, { variantId: 'void-pup', level: 57, name: 'Unpowered Witness' }] },
  9: { 3: [{ variantId: 'solar-owl', level: 62, name: 'Choirglass Herald' }], 9: [{ variantId: 'cyber-hydra', level: 65, name: 'Many-Sided Chorus' }, { variantId: 'prism-moth', level: 64, name: 'True-Color Guide' }] },
  10: { 3: [{ variantId: 'titan-colossus', level: 72, name: 'Tenfold Auditor' }], 9: [{ variantId: 'nano-phoenix', level: 78, name: 'All-Signal Warden' }, { variantId: 'cyber-hydra', level: 77, name: 'Terminal Choir' }] },
};

function seededIndex(seed: number, length: number): number {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) % length;
}

/** Global floor number is 1..100: 10 floors per sector, with a rest floor at 5 and a Master trial at 10. */
export function getDigiTowerFloor(floor: number): DigiTowerFloorDef {
  const safeFloor = Math.max(1, Math.min(100, Math.floor(floor)));
  const sectorIndex = Math.ceil(safeFloor / 10) - 1;
  const sector = DIGI_TOWER_SECTORS[sectorIndex]!;
  const sectorFloor = ((safeFloor - 1) % 10) + 1;
  const kind: DigiTowerFloorKind = sectorFloor === 5 ? 'rest' : sectorFloor === 10 ? 'master' : sectorFloor === 3 || sectorFloor === 9 ? 'planned' : sectorFloor === 4 || sectorFloor === 7 ? 'faction' : sectorFloor === 8 ? 'mirror' : 'random';
  const levelBase = 3 + (sector.number - 1) * 7;
  const level = Math.round(levelBase + (sectorFloor / 10) * (6 + sector.number * 0.2));
  const template = FLOOR_NAMES[sector.number]?.[sectorFloor - 1];
  const variants = VARIANT_TEAMS[sector.number] ?? sector.regularVariants;
  const plannedTeam = kind === 'planned' ? PLANNED_TEAMS[sector.number]?.[sectorFloor] : undefined;
  const opponents = kind === 'rest' || kind === 'master'
    ? kind === 'master' ? sector.masterTeam : []
    : kind === 'mirror'
      ? [{ variantId: variants[seededIndex(safeFloor, variants.length)]!, level: Math.max(1, level - 2), name: 'Mirror Partner' }]
      : plannedTeam
        ? plannedTeam
      : Array.from({ length: sectorFloor >= 7 ? 2 : 1 }, (_, index) => ({
        variantId: variants[seededIndex(safeFloor * 13 + index * 17, variants.length)]!,
        level: Math.max(1, level + (sectorFloor >= 9 ? 1 : 0) - index),
        name: `${sectorFloor === 4 || sectorFloor === 7 ? sector.name.split(' ')[0] : 'Tower'} ${['Scout', 'Keeper', 'Runner'][index % 3]}`,
      }));
  return {
    id: `tower-floor-${safeFloor}`,
    sector,
    floor: safeFloor,
    sectorFloor,
    kind,
    name: template?.name ?? SECTOR_FLOOR_NAMES[sector.number]?.[sectorFloor - 1] ?? (kind === 'master' ? sector.masterName : kind === 'rest' ? 'Checkpoint Vault' : `${sector.name} · Floor ${sectorFloor}`),
    briefing: template?.briefing ?? (kind === 'master' ? sector.masterBlurb : `${FLOOR_BEATS[sectorFloor]} ${sector.story} Signal motif: ${sector.motif}.`),
    opponents,
    rule: sector.rule,
    firstClearTokens: kind === 'rest' ? 20 + sector.number * 5 : kind === 'master' ? sector.masterReward : 5 + sector.number * 2,
    repeatXpPercent: 25,
  };
}

export function allDigiTowerFloors(): DigiTowerFloorDef[] {
  return Array.from({ length: 100 }, (_, index) => getDigiTowerFloor(index + 1));
}

export function isDigiTowerSectorUnlocked(sector: DigiTowerSectorDef, defeatedMasterIds: readonly string[], endgameUnlocked: boolean): boolean {
  if (sector.number === 1) return true;
  if (sector.number === 10 && !endgameUnlocked) return false;
  return defeatedMasterIds.includes(DIGI_TOWER_SECTORS[sector.number - 2]!.masterId);
}

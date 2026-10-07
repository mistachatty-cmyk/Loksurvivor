import type { WeaponKind } from '@/game/types';

export interface ArmoryBlueprint {
  id: string;
  name: string;
  source: 'Volume I' | 'Volume II' | 'Volume III';
  kind: WeaponKind;
  color: string;
  description: string;
  /** A completed field prototype. Other blueprints remain in the archive. */
  playableWeaponId?: string;
}

/** Concept blueprints stay visible even while their combat implementation is sealed. */
export const GRPD_BLUEPRINTS: ArmoryBlueprint[] = [
  { id: 'digifrog-lance', name: 'DigiFrog Lance', source: 'Volume I', kind: 'melee', color: '#7ee787', description: 'A bonded frog sweeps and bounces a caught enemy.', playableWeaponId: 'digifrog-lance' },
  { id: 'firewall-verse', name: 'Firewall Verse', source: 'Volume I', kind: 'melee', color: '#ff765b', description: 'A legendary Digi-Tana draws protective cuts.', playableWeaponId: 'firewall-verse' },
  { id: 'rewind-mercy', name: 'Rewind Mercy', source: 'Volume I', kind: 'melee', color: '#c8e8ef', description: 'A legendary Digi-Tana returns marked threats to an earlier path.', playableWeaponId: 'rewind-mercy' },
  { id: 'eclipse-severance', name: 'Eclipse Severance', source: 'Volume I', kind: 'melee', color: '#b080ee', description: 'A legendary Digi-Tana opens and closes a breach seam.', playableWeaponId: 'eclipse-severance' },
  { id: 'cipher-cathedral', name: 'Cipher Cathedral', source: 'Volume I', kind: 'wave', color: '#9edfff', description: 'Three glyphs assemble into a temporary shelter and trap.', playableWeaponId: 'cipher-cathedral' },
  { id: 'subwoofer-railstaff', name: 'Subwoofer Railstaff', source: 'Volume I', kind: 'wave', color: '#e69cff', description: 'A staff drives a bass packet down a planted rail.', playableWeaponId: 'subwoofer-railstaff' },
  { id: 'commentstorm-crown', name: 'Commentstorm Crown', source: 'Volume I', kind: 'orbit', color: '#ffe38d', description: 'Hostile taunts feed a punctuation storm.', playableWeaponId: 'commentstorm-crown' },
  { id: 'pitch-reaper', name: 'Pitch Reaper', source: 'Volume I', kind: 'sweep', color: '#9de7ee', description: 'Sampled notes return as a broad scythe chord.', playableWeaponId: 'pitch-reaper' },
  { id: 'cache-of-lost-hooks', name: 'Cache of Lost Hooks', source: 'Volume I', kind: 'hazard', color: '#f7a8c1', description: 'A stored combat phrase replays as a chorus.', playableWeaponId: 'cache-of-lost-hooks' },
  { id: 'breakpoint-hands', name: 'Breakpoint Hands', source: 'Volume I', kind: 'punch', color: '#9fcfff', description: 'A punch sequence interrupts one hostile pattern.', playableWeaponId: 'breakpoint-hands' },
  { id: 'ghostwriter-relay', name: 'Ghostwriter Relay', source: 'Volume II', kind: 'follower', color: '#dad6ff', description: 'A delayed performer finishes the player’s crossfire.' },
  { id: '808-undertow', name: '808 Undertow', source: 'Volume II', kind: 'hazard', color: '#6bc9fa', description: 'A bass current follows the survivor’s route.' },
  { id: 'packet-orchard', name: 'Packet Orchard', source: 'Volume II', kind: 'hazard', color: '#8ee9ad', description: 'Data trees retransmit attacks through their roots.' },
  { id: 'palindrome-pistols', name: 'Palindrome Pistols', source: 'Volume II', kind: 'projectile', color: '#ff9dcb', description: 'Bullets return along their fired paths.' },
  { id: 'dead-air-gavel', name: 'Dead-Air Gavel', source: 'Volume II', kind: 'nova', color: '#d7d7ea', description: 'A quiet dome stores shots for one heavy verdict.' },
  { id: 'crowdsource-colossus', name: 'Crowdsource Colossus', source: 'Volume II', kind: 'follower', color: '#ffce7c', description: 'Audience holograms assemble into a giant ally.' },
  { id: 'redline-testament', name: 'Redline Testament', source: 'Volume II', kind: 'hazard', color: '#f85b79', description: 'Movement writes a temporary graffiti trap.' },
  { id: 'kernel-comet', name: 'Kernel Comet', source: 'Volume II', kind: 'meteor', color: '#ffbb76', description: 'A caught enemy ricochets through nearby packs.' },
  { id: 'viral-tether', name: 'Viral Tether', source: 'Volume II', kind: 'projectile', color: '#b6a7ef', description: 'A mic cable shares hits across linked enemies.' },
  { id: 'bootleg-seraph', name: 'Bootleg Seraph', source: 'Volume II', kind: 'wave', color: '#fff5ae', description: 'A safe sample of an enemy attack becomes a refrain.' },
  { id: 'siphon-reversal', name: 'Siphon Reversal', source: 'Volume III', kind: 'nova', color: '#ffd991', description: 'Captured siphon pulses return to their source.' },
  { id: 'right-of-way', name: 'Right-of-Way', source: 'Volume III', kind: 'wave', color: '#80f2c2', description: 'An intersection gives the survivor a crossing.', playableWeaponId: 'crossing-baton' },
  { id: 'salvage-saint', name: 'Salvage Saint', source: 'Volume III', kind: 'projectile', color: '#e0b78b', description: 'Broken street hardware becomes armor and rivets.', playableWeaponId: 'rivet-driver' },
  { id: 'stage-door-paradox', name: 'Stage Door Paradox', source: 'Volume III', kind: 'teleport', color: '#ff8dd2', description: 'A stage door displaces a pursuing crowd.' },
  { id: 'anima-loom', name: 'Anima Loom', source: 'Volume III', kind: 'hazard', color: '#fff3b5', description: 'Earned Soul Sparks weave a protective route.' },
  { id: 'antenna-harrier', name: 'Antenna Harrier', source: 'Volume III', kind: 'homing', color: '#89d9ff', description: 'A rooftop kite connects three strike points.' },
  { id: 'witness-array', name: 'Witness Array', source: 'Volume III', kind: 'laser', color: '#ffc889', description: 'Three lenses expose a true hostile weak point.' },
  { id: 'hydrant-hymn', name: 'Hydrant Hymn', source: 'Volume III', kind: 'wave', color: '#79d9ff', description: 'Wet pavement carries a three-note electric attack.' },
  { id: 'perimeter-tailor', name: 'Perimeter Tailor', source: 'Volume III', kind: 'hazard', color: '#a3efd9', description: 'Survey tape stitches a brief safe route.' },
  { id: 'lock-deck-unbound', name: 'Lock Deck Unbound', source: 'Volume III', kind: 'projectile', color: '#d6adff', description: 'Anima cards project from the Archive into a run.', playableWeaponId: 'deck-sling' },
];

export const GRPD_PLAYABLE_WEAPON_IDS = new Set(
  GRPD_BLUEPRINTS.flatMap((blueprint) => blueprint.playableWeaponId ? [blueprint.playableWeaponId] : []),
);

/** The new shelf opens after Victory Lap. Each step requires another 750k or 1m kills. */
export const GRPD_ENDGAME_WEAPON_ORDER = ['digifrog-lance', 'firewall-verse', 'rewind-mercy', 'eclipse-severance', 'cipher-cathedral', 'subwoofer-railstaff', 'commentstorm-crown', 'pitch-reaper', 'cache-of-lost-hooks', 'breakpoint-hands'] as const;
export const GRPD_ENDGAME_KILL_INTERVALS = [750_000, 1_000_000] as const;
const ENDGAME_IDS: ReadonlySet<string> = new Set(GRPD_ENDGAME_WEAPON_ORDER);

export function grpdEndgameKillGoal(weaponId: string): number | undefined {
  const index = GRPD_ENDGAME_WEAPON_ORDER.findIndex((id) => id === weaponId);
  if (index < 0) return undefined;
  let goal = 0;
  for (let step = 0; step <= index; step += 1) goal += GRPD_ENDGAME_KILL_INTERVALS[step % GRPD_ENDGAME_KILL_INTERVALS.length]!;
  return goal;
}

export function isGrpdEndgameWeapon(id: string): boolean {
  return ENDGAME_IDS.has(id);
}

export function grpdEndgameWeaponEarned(id: string, totalKills: number, endgameUnlocked: boolean): boolean {
  const goal = grpdEndgameKillGoal(id);
  return goal !== undefined && endgameUnlocked && totalKills >= goal;
}

export const GRPD_KILLS_PER_SEAL = 1000;
export const GRPD_UNLOCK_SEAL_COST = 1;
export const GRPD_MAX_SPAWN_MULTIPLIER = 5;

export function grpdEarnedSeals(totalKills: number): number {
  return Math.floor(Math.max(0, totalKills) / GRPD_KILLS_PER_SEAL);
}

export function grpdAvailableSeals(totalKills: number, spentSeals: number): number {
  return Math.max(0, grpdEarnedSeals(totalKills) - Math.max(0, spentSeals));
}

/** Buying the next tier costs its current multiplier in seals: 1, 2, 3, 4. */
export function grpdNextTierCost(currentTier: number): number {
  return Math.max(1, Math.min(4, Math.floor(currentTier)));
}

/** Each completed 1,000-kill milestone adds 0.01 relative offer weight. */
export function grpdOfferWeight(baseWeight: number, totalKills: number, multiplier: number, autoIncreaseEnabled = true): number {
  const tier = Math.max(1, Math.min(GRPD_MAX_SPAWN_MULTIPLIER, Math.floor(multiplier)));
  return baseWeight * (1 + (autoIncreaseEnabled ? grpdEarnedSeals(totalKills) * 0.01 : 0)) * tier;
}

export function isGrpdPlayableWeapon(id: string): boolean {
  return GRPD_PLAYABLE_WEAPON_IDS.has(id);
}

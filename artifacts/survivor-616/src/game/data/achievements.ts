import type { MetaState } from '@/game/types';
import { ALLIES } from './progression';
import { AREAS } from './areas';
import { CARD_MANIFESTS, cardCollectionSummary } from './cards';
import { CHARACTERS } from './characters';
import { CITY_RELICS } from './relics';
import { ENEMIES } from './enemies';
import { ENEMY_QUIRKS, QUIRK_EVERYWHERE_KILLS, QUIRK_TAKE_ON_KILLS } from './enemyQuirks';
import { LOKPET_VARIANTS } from './lokPets';
import { BOND_RANK_BY_ID, PET_NAME_SLOTS, bondRankFor, getPetNameValue } from '../engine/petGrowth';
import { RENTABLE_GENERATORS } from './generators';

export interface AchievementReward {
  kind: 'cred' | 'lootTokens' | 'cardCredits';
  amount: number;
}

/**
 * Pure function over `MetaState`, never a stored boolean -- see
 * `.agents/memory/achievements-unlockables-plan.md` for why. The one
 * exception is `reward`: a currency payout must fire exactly once, so
 * claiming one is tracked separately in `meta.claimedAchievementIds`
 * (see `claimAchievement` in `state/metaStore.tsx`) rather than here.
 */
export type AchievementCategory = 'combat' | 'survival' | 'world' | 'crew' | 'bestiary' | 'lokpet' | 'cards' | 'economy';

export const ACHIEVEMENT_CATEGORIES: Array<{ id: AchievementCategory; label: string }> = [
  { id: 'combat', label: 'Combat' },
  { id: 'survival', label: 'Survival' },
  { id: 'world', label: 'World' },
  { id: 'crew', label: 'Crew' },
  { id: 'bestiary', label: 'Bestiary' },
  { id: 'lokpet', label: 'LokPets' },
  { id: 'cards', label: 'Cards' },
  { id: 'economy', label: 'Economy' },
];

export interface AchievementDef {
  id: string;
  /** Filter group in the Archive. Filled in below for every entry. */
  category: AchievementCategory;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  isComplete: (meta: MetaState) => boolean;
  /** 0..1 for a progress bar on incomplete achievements; omit for a pure binary flag. */
  progress?: (meta: MetaState) => number;
  reward?: AchievementReward;
}

const ratio = (value: number, total: number) => (total <= 0 ? 0 : Math.min(1, value / total));

type RawAchievement = Omit<AchievementDef, 'category'>;

const RAW_ACHIEVEMENTS: RawAchievement[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Land your first kill in 616.',
    tier: 'bronze',
    isComplete: (meta) => meta.totalKills >= 1,
    reward: { kind: 'cred', amount: 25 },
  },
  {
    id: 'body-count-1000',
    name: 'Four Digits',
    description: 'Reach 1,000 lifetime kills.',
    tier: 'silver',
    isComplete: (meta) => meta.totalKills >= 1000,
    progress: (meta) => ratio(meta.totalKills, 1000),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'body-count-10000',
    name: 'Ten Thousand',
    description: 'Reach 10,000 lifetime kills.',
    tier: 'gold',
    isComplete: (meta) => meta.totalKills >= 10000,
    progress: (meta) => ratio(meta.totalKills, 10000),
    reward: { kind: 'cred', amount: 500 },
  },
  {
    id: 'survivor-20',
    name: 'Survivor',
    description: 'Survive a single run for 20 minutes.',
    tier: 'bronze',
    isComplete: (meta) => meta.bestSurvivalSec >= 1200,
    progress: (meta) => ratio(meta.bestSurvivalSec, 1200),
    reward: { kind: 'cred', amount: 50 },
  },
  {
    id: 'marathoner-45',
    name: 'Marathoner',
    description: 'Survive a single run for 45 minutes.',
    tier: 'gold',
    isComplete: (meta) => meta.bestSurvivalSec >= 2700,
    progress: (meta) => ratio(meta.bestSurvivalSec, 2700),
    reward: { kind: 'cred', amount: 400 },
  },
  {
    id: 'veteran-100-runs',
    name: 'Veteran',
    description: 'Complete 100 runs.',
    tier: 'gold',
    isComplete: (meta) => meta.totalRuns >= 100,
    progress: (meta) => ratio(meta.totalRuns, 100),
    reward: { kind: 'cred', amount: 300 },
  },
  {
    id: 'district-tourist',
    name: 'District Tourist',
    description: 'Clear half the districts in 616.',
    tier: 'silver',
    isComplete: (meta) => meta.clearedAreaIds.length >= Math.ceil(AREAS.length / 2),
    progress: (meta) => ratio(meta.clearedAreaIds.length, Math.ceil(AREAS.length / 2)),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'know-the-city',
    name: 'Know The City',
    description: 'Clear every district in 616.',
    tier: 'legendary',
    isComplete: (meta) => AREAS.every((area) => meta.clearedAreaIds.includes(area.id)),
    progress: (meta) => ratio(meta.clearedAreaIds.length, AREAS.length),
    reward: { kind: 'cred', amount: 750 },
  },
  {
    id: 'full-roster',
    name: 'Full Roster',
    description: 'Unlock every playable character.',
    tier: 'legendary',
    isComplete: (meta) => CHARACTERS.every((character) => meta.unlockedCharacterIds.includes(character.id)),
    progress: (meta) => ratio(meta.unlockedCharacterIds.length, CHARACTERS.length),
    reward: { kind: 'cred', amount: 750 },
  },
  {
    id: 'ride-or-die',
    name: 'Ride or Die',
    description: 'Rescue 5 allies.',
    tier: 'silver',
    isComplete: (meta) => meta.rescuedAllyIds.length >= 5,
    progress: (meta) => ratio(meta.rescuedAllyIds.length, 5),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'whole-crew',
    name: 'Whole Crew',
    description: 'Rescue every ally in 616.',
    tier: 'gold',
    isComplete: (meta) => ALLIES.every((ally) => meta.rescuedAllyIds.includes(ally.id)),
    progress: (meta) => ratio(meta.rescuedAllyIds.length, ALLIES.length),
    reward: { kind: 'cred', amount: 400 },
  },
  {
    id: 'field-researcher',
    name: 'Field Researcher',
    description: 'Log half the bestiary.',
    tier: 'silver',
    isComplete: (meta) => Object.keys(meta.bestiary).length >= Math.ceil(ENEMIES.length / 2),
    progress: (meta) => ratio(Object.keys(meta.bestiary).length, Math.ceil(ENEMIES.length / 2)),
    reward: { kind: 'lootTokens', amount: 10 },
  },
  {
    id: 'apex-predator',
    name: 'Apex Predator',
    description: 'Log the entire bestiary.',
    tier: 'legendary',
    isComplete: (meta) => ENEMIES.every((enemy) => (meta.bestiary[enemy.id] ?? 0) > 0),
    progress: (meta) => ratio(Object.keys(meta.bestiary).length, ENEMIES.length),
    reward: { kind: 'lootTokens', amount: 40 },
  },
  {
    id: 'relic-hunter',
    name: 'Relic Hunter',
    description: 'Discover 5 city relics.',
    tier: 'silver',
    isComplete: (meta) => meta.knownRelicIds.length >= 5,
    progress: (meta) => ratio(meta.knownRelicIds.length, 5),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'city-archivist',
    name: 'City Archivist',
    description: 'Discover every city relic.',
    tier: 'gold',
    isComplete: (meta) => CITY_RELICS.every((relic) => meta.knownRelicIds.includes(relic.id)),
    progress: (meta) => ratio(meta.knownRelicIds.length, CITY_RELICS.length),
    reward: { kind: 'cred', amount: 400 },
  },
  {
    id: 'lokpet-collector',
    name: 'LokPet Collector',
    description: 'Catalog 10 unique LokPet variants.',
    tier: 'silver',
    isComplete: (meta) => meta.lokPetCatalog.length >= 10,
    progress: (meta) => ratio(meta.lokPetCatalog.length, 10),
    reward: { kind: 'lootTokens', amount: 15 },
  },
  {
    id: 'lokpet-zoologist',
    name: 'LokPet Zoologist',
    description: 'Catalog every LokPet variant.',
    tier: 'legendary',
    isComplete: (meta) => LOKPET_VARIANTS.every((variant) => meta.lokPetCatalog.some((entry) => entry.variantId === variant.id)),
    progress: (meta) => ratio(meta.lokPetCatalog.length, LOKPET_VARIANTS.length),
    reward: { kind: 'lootTokens', amount: 60 },
  },
  {
    id: 'into-the-dark',
    name: 'Into the Dark',
    description: 'Reach dungeon depth 5 in endless mode.',
    tier: 'silver',
    isComplete: (meta) => meta.endlessRecordDepth >= 5,
    progress: (meta) => ratio(meta.endlessRecordDepth, 5),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'bottomless',
    name: 'Bottomless',
    description: 'Reach dungeon depth 10 in endless mode.',
    tier: 'legendary',
    isComplete: (meta) => meta.endlessRecordDepth >= 10,
    progress: (meta) => ratio(meta.endlessRecordDepth, 10),
    reward: { kind: 'cred', amount: 600 },
  },
  {
    id: 'something-new',
    name: 'Something New',
    description: 'Unlock your first signature evolution.',
    tier: 'bronze',
    isComplete: (meta) => meta.unlockedEvolutionIds.length >= 1,
    reward: { kind: 'cred', amount: 100 },
  },
  {
    id: 'passive-income',
    name: 'Passive Income',
    description: 'Own every rentable cred generator.',
    tier: 'gold',
    isComplete: (meta) => RENTABLE_GENERATORS.length > 0 && meta.ownedGeneratorIds.length >= RENTABLE_GENERATORS.length,
    progress: (meta) => ratio(meta.ownedGeneratorIds.length, RENTABLE_GENERATORS.length),
    reward: { kind: 'cred', amount: 300 },
  },
  {
    id: 'sealed-no-more',
    name: 'Sealed No More',
    description: 'Own your first Lock Deck card.',
    tier: 'bronze',
    isComplete: (meta) => cardCollectionSummary(meta).owned >= 1,
    reward: { kind: 'cardCredits', amount: 30 },
  },
  {
    id: 'triple-stamped',
    name: 'Triple Stamped',
    description: 'Own 3 copies of the same Lock Deck card.',
    tier: 'silver',
    isComplete: (meta) => meta.cardCollection.some((record) => record.copies >= 3),
    reward: { kind: 'cardCredits', amount: 20 },
  },
  {
    id: 'first-holo',
    name: 'First Holo',
    description: 'Pull a Holo-variant card from a Lock Pack.',
    tier: 'gold',
    isComplete: (meta) => meta.cardCollection.some((record) => record.bestVariant === 'holo'),
    reward: { kind: 'cardCredits', amount: 40 },
  },
  {
    id: 'passive-powerhouse',
    name: 'Passive Powerhouse',
    description: 'Equip 3 passive cards at once.',
    tier: 'silver',
    isComplete: (meta) => meta.activePassiveCardIds.length >= 3,
    reward: { kind: 'cardCredits', amount: 20 },
  },
  {
    id: 'half-the-deck',
    name: 'Half the Deck',
    description: 'Fill half the Lock Deck Binder.',
    tier: 'gold',
    isComplete: (meta) => cardCollectionSummary(meta).owned >= Math.ceil(CARD_MANIFESTS.length / 2),
    progress: (meta) => ratio(cardCollectionSummary(meta).owned, Math.ceil(CARD_MANIFESTS.length / 2)),
    reward: { kind: 'cardCredits', amount: 60 },
  },
  {
    id: 'complete-collector',
    name: 'Complete Collector',
    description: 'Fill every slot in the Lock Deck Binder.',
    tier: 'legendary',
    isComplete: (meta) => cardCollectionSummary(meta).owned >= CARD_MANIFESTS.length,
    progress: (meta) => ratio(cardCollectionSummary(meta).owned, CARD_MANIFESTS.length),
    reward: { kind: 'cardCredits', amount: 150 },
  },
  {
    id: 'glitch-hunter',
    name: 'Glitch Hunter',
    description: 'Defeat at least 25 Glitch Breach entities.',
    tier: 'silver',
    isComplete: (meta) => ((meta.bestiary['cursor-hound'] ?? 0) + (meta.bestiary['unrendered-mesh'] ?? 0) + (meta.bestiary['dead-pixel-swarm'] ?? 0) + (meta.bestiary['dropped-frame'] ?? 0) + (meta.bestiary['heap-colossus'] ?? 0) + (meta.bestiary['stack-overflow'] ?? 0)) >= 25,
    progress: (meta) => ratio((meta.bestiary['cursor-hound'] ?? 0) + (meta.bestiary['unrendered-mesh'] ?? 0) + (meta.bestiary['dead-pixel-swarm'] ?? 0) + (meta.bestiary['dropped-frame'] ?? 0) + (meta.bestiary['heap-colossus'] ?? 0) + (meta.bestiary['stack-overflow'] ?? 0), 25),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'stack-smasher',
    name: 'Stack Smasher',
    description: 'Overcome the Stack Overflow recursive boss.',
    tier: 'gold',
    isComplete: (meta) => (meta.bestiary['stack-overflow'] ?? 0) >= 1,
    reward: { kind: 'cred', amount: 350 },
  },
  {
    id: 'director-cut',
    name: "Director's Cut",
    description: 'Defeat all three members of the Reel Syndicate crew.',
    tier: 'gold',
    isComplete: (meta) => (meta.bestiary['the-director'] ?? 0) >= 1 && (meta.bestiary['boom-mic-runner'] ?? 0) >= 1 && (meta.bestiary['gaffer-brute'] ?? 0) >= 1,
    reward: { kind: 'cred', amount: 300 },
  },
  {
    id: 'bestiary-scholar',
    name: 'Field Naturalist',
    description: 'Record defeats for at least 30 different enemy types in the Bestiary.',
    tier: 'gold',
    isComplete: (meta) => Object.values(meta.bestiary).filter((count) => count > 0).length >= 30,
    progress: (meta) => ratio(Object.values(meta.bestiary).filter((count) => count > 0).length, 30),
    reward: { kind: 'cred', amount: 300 },
  },
  {
    id: 'bestiary-master',
    name: 'Master of the 616',
    description: 'Log defeats for at least 45 unique enemy species.',
    tier: 'legendary',
    isComplete: (meta) => Object.values(meta.bestiary).filter((count) => count > 0).length >= 45,
    progress: (meta) => ratio(Object.values(meta.bestiary).filter((count) => count > 0).length, 45),
    reward: { kind: 'cred', amount: 750 },
  },
  {
    id: 'null-terminator',
    name: 'Memory Leak Plugged',
    description: 'Fell the Glitch Breach Heap Colossus.',
    tier: 'silver',
    isComplete: (meta) => (meta.bestiary['heap-colossus'] ?? 0) >= 1,
    reward: { kind: 'cred', amount: 175 },
  },
  {
    id: 'fourth-wall-breaker',
    name: 'Fourth Wall Breaker',
    description: 'Reach 5,000 total lifetime kills.',
    tier: 'silver',
    isComplete: (meta) => meta.totalKills >= 5000,
    progress: (meta) => ratio(meta.totalKills, 5000),
    reward: { kind: 'cred', amount: 300 },
  },
  {
    id: 'skeleton-hoarder',
    name: 'Keymaster',
    description: 'Collect 10 Skeleton Keys from shattered street props.',
    tier: 'silver',
    isComplete: (meta) => meta.skeletonKeys >= 10,
    progress: (meta) => ratio(meta.skeletonKeys, 10),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'mission-operative',
    name: 'Sector Operative',
    description: 'Complete 3 different Sector Command missions.',
    tier: 'silver',
    isComplete: (meta) => (meta.completedSectorMissionIds?.length ?? 0) >= 3,
    progress: (meta) => ratio(meta.completedSectorMissionIds?.length ?? 0, 3),
    reward: { kind: 'cred', amount: 250 },
  },
  {
    id: 'grand-survivor',
    name: 'Endless Horizon',
    description: 'Reach 15,000 meters in endless mode.',
    tier: 'gold',
    isComplete: (meta) => meta.endlessRecordDistancePx >= 15000,
    progress: (meta) => ratio(meta.endlessRecordDistancePx, 15000),
    reward: { kind: 'cred', amount: 450 },
  },
  {
    id: 'lev-spire-conqueror',
    name: 'Spire Conqueror',
    description: 'Survive and clear the Lev Syndicate Spire highline plaza.',
    tier: 'gold',
    isComplete: (meta) => meta.clearedAreaIds.includes('lev-syndicate-spire'),
    reward: { kind: 'cred', amount: 350 },
  },
  {
    id: 'singularity-defector',
    name: 'Singularity Defector',
    description: 'Level up Vector Lev at least once during any run.',
    tier: 'silver',
    isComplete: (meta) => (meta.characterLevelUps['vector-lev'] ?? 0) >= 1,
    progress: (meta) => ratio(meta.characterLevelUps['vector-lev'] ?? 0, 1),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'familiar-face',
    name: 'Familiar Face',
    description: 'Bond with any LokPet until it is Familiar.',
    tier: 'bronze',
    isComplete: (meta) => meta.savedLokPets.some((pet) => bondRankFor(pet.bond).order >= BOND_RANK_BY_ID.familiar.order),
    reward: { kind: 'cred', amount: 50 },
  },
  {
    id: 'friend-for-life',
    name: 'Friend for Life',
    description: 'Bond with any LokPet until it is a Friend.',
    tier: 'silver',
    isComplete: (meta) => meta.savedLokPets.some((pet) => bondRankFor(pet.bond).order >= BOND_RANK_BY_ID.friend.order),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'soulbound',
    name: 'Soulbound',
    description: 'Bond with any LokPet until it is Soulbound.',
    tier: 'gold',
    isComplete: (meta) => meta.savedLokPets.some((pet) => bondRankFor(pet.bond).order >= BOND_RANK_BY_ID.soulbound.order),
    reward: { kind: 'cardCredits', amount: 100 },
  },
  {
    id: 'five-names',
    name: 'Five Names',
    description: 'Fill all five name slots on one LokPet.',
    tier: 'gold',
    isComplete: (meta) => meta.savedLokPets.some((pet) => PET_NAME_SLOTS.every((slot) => Boolean(getPetNameValue(pet, slot.id)))),
    reward: { kind: 'cardCredits', amount: 75 },
  },
  {
    id: 'pet-level-20',
    name: 'Getting Somewhere',
    description: 'Raise any LokPet to level 20.',
    tier: 'bronze',
    isComplete: (meta) => meta.savedLokPets.some((pet) => (pet.level ?? 1) >= 20),
    progress: (meta) => ratio(Math.max(0, ...meta.savedLokPets.map((pet) => pet.level ?? 1)), 20),
    reward: { kind: 'cred', amount: 75 },
  },
  {
    id: 'pet-level-50',
    name: 'Fully Grown',
    description: 'Raise any LokPet to level 50.',
    tier: 'silver',
    isComplete: (meta) => meta.savedLokPets.some((pet) => (pet.level ?? 1) >= 50),
    progress: (meta) => ratio(Math.max(0, ...meta.savedLokPets.map((pet) => pet.level ?? 1)), 50),
    reward: { kind: 'cred', amount: 250 },
  },
];

/**
 * Enemy quirk achievements, generated from the quirk list so a new quirk gets
 * its own pair automatically: one for the Everywhere unlock, one for Take it on.
 */
const quirkTotal = (meta: MetaState) => Object.values(meta.quirkKills ?? {}).reduce((sum, n) => sum + n, 0);
const quirkKillsOf = (meta: MetaState, id: string) => meta.quirkKills?.[id] ?? 0;

const QUIRK_ACHIEVEMENTS: RawAchievement[] = [
  {
    id: 'quirk-first-kill',
    name: 'Odd One Out',
    description: 'Defeat an enemy carrying a random quirk.',
    tier: 'bronze',
    isComplete: (meta) => quirkTotal(meta) >= 1,
    reward: { kind: 'cred', amount: 100 },
  },
  {
    id: 'quirk-collector',
    name: 'Quirk Collector',
    description: 'Defeat at least one enemy with every kind of quirk.',
    tier: 'silver',
    isComplete: (meta) => ENEMY_QUIRKS.every((quirk) => quirkKillsOf(meta, quirk.id) >= 1),
    progress: (meta) => ratio(ENEMY_QUIRKS.filter((quirk) => quirkKillsOf(meta, quirk.id) >= 1).length, ENEMY_QUIRKS.length),
    reward: { kind: 'cred', amount: 400 },
  },
  ...ENEMY_QUIRKS.flatMap((quirk): RawAchievement[] => [
    {
      id: `quirk-everywhere-${quirk.id}`,
      name: `${quirk.name} Everywhere`,
      description: `Defeat ${QUIRK_EVERYWHERE_KILLS.toLocaleString()} ${quirk.name} enemies. Unlocks the Everywhere option for it.`,
      tier: 'gold',
      isComplete: (meta) => quirkKillsOf(meta, quirk.id) >= QUIRK_EVERYWHERE_KILLS,
      progress: (meta) => ratio(quirkKillsOf(meta, quirk.id), QUIRK_EVERYWHERE_KILLS),
      reward: { kind: 'cred', amount: 2500 },
    },
    {
      id: `quirk-taken-${quirk.id}`,
      name: `Become ${quirk.name}`,
      description: `Defeat ${QUIRK_TAKE_ON_KILLS.toLocaleString()} ${quirk.name} enemies. Unlocks Take it on, so you gain the quirk yourself.`,
      tier: 'legendary',
      isComplete: (meta) => quirkKillsOf(meta, quirk.id) >= QUIRK_TAKE_ON_KILLS,
      progress: (meta) => ratio(quirkKillsOf(meta, quirk.id), QUIRK_TAKE_ON_KILLS),
      reward: { kind: 'lootTokens', amount: 25 },
    },
  ]),
  {
    id: 'quirk-everywhere-all',
    name: 'Nothing Is Normal',
    description: 'Unlock Everywhere for all ten quirks.',
    tier: 'legendary',
    isComplete: (meta) => ENEMY_QUIRKS.every((quirk) => quirkKillsOf(meta, quirk.id) >= QUIRK_EVERYWHERE_KILLS),
    progress: (meta) => ratio(ENEMY_QUIRKS.filter((quirk) => quirkKillsOf(meta, quirk.id) >= QUIRK_EVERYWHERE_KILLS).length, ENEMY_QUIRKS.length),
    reward: { kind: 'cred', amount: 15000 },
  },
  {
    id: 'quirk-taken-all',
    name: 'The Whole Weird Set',
    description: 'Unlock Take it on for all ten quirks.',
    tier: 'legendary',
    isComplete: (meta) => ENEMY_QUIRKS.every((quirk) => quirkKillsOf(meta, quirk.id) >= QUIRK_TAKE_ON_KILLS),
    progress: (meta) => ratio(ENEMY_QUIRKS.filter((quirk) => quirkKillsOf(meta, quirk.id) >= QUIRK_TAKE_ON_KILLS).length, ENEMY_QUIRKS.length),
    reward: { kind: 'lootTokens', amount: 100 },
  },
];
RAW_ACHIEVEMENTS.push(...QUIRK_ACHIEVEMENTS);

const CATEGORY_BY_ID: Record<string, AchievementCategory> = {
  'first-blood': 'combat', 'body-count-1000': 'combat', 'body-count-10000': 'combat', 'fourth-wall-breaker': 'combat',
  'glitch-hunter': 'combat', 'stack-smasher': 'combat', 'null-terminator': 'combat',
  'survivor-20': 'survival', 'marathoner-45': 'survival', 'veteran-100-runs': 'survival', 'grand-survivor': 'survival',
  'into-the-dark': 'survival', 'bottomless': 'survival', 'mission-operative': 'survival',
  'district-tourist': 'world', 'know-the-city': 'world', 'relic-hunter': 'world', 'city-archivist': 'world',
  'lev-spire-conqueror': 'world', 'skeleton-hoarder': 'world',
  'full-roster': 'crew', 'ride-or-die': 'crew', 'whole-crew': 'crew', 'something-new': 'crew', 'singularity-defector': 'crew',
  'field-researcher': 'bestiary', 'apex-predator': 'bestiary', 'bestiary-scholar': 'bestiary', 'bestiary-master': 'bestiary',
  'lokpet-collector': 'lokpet', 'lokpet-zoologist': 'lokpet', 'familiar-face': 'lokpet', 'friend-for-life': 'lokpet',
  'soulbound': 'lokpet', 'five-names': 'lokpet', 'pet-level-20': 'lokpet', 'pet-level-50': 'lokpet',
  'sealed-no-more': 'cards', 'triple-stamped': 'cards', 'first-holo': 'cards', 'passive-powerhouse': 'cards',
  'half-the-deck': 'cards', 'complete-collector': 'cards', 'director-cut': 'combat',
  'passive-income': 'economy',
};

export const ACHIEVEMENTS: AchievementDef[] = RAW_ACHIEVEMENTS.map((achievement) => ({
  ...achievement,
  category: CATEGORY_BY_ID[achievement.id] ?? (achievement.id.startsWith('quirk-') ? 'bestiary' : 'world'),
}));

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

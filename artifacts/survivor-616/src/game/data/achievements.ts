import type { MetaState } from '@/game/types';
import { ALLIES } from './progression';
import { AREAS } from './areas';
import { CARD_MANIFESTS, cardCollectionSummary } from './cards';
import { CHARACTERS } from './characters';
import { CITY_RELICS } from './relics';
import { ENEMIES } from './enemies';
import { FACTIONS_BY_ID } from './factions';
import { endgameReached, mapsCleared } from './endgameUnlocks';
import { QUIRK_SURGE_UNLOCK_MAPS } from './enemyQuirks';
import { ENEMY_QUIRKS, QUIRK_EVERYWHERE_KILLS, QUIRK_TAKE_ON_KILLS } from './enemyQuirks';
import { LOKPET_VARIANTS } from './lokPets';
import { BOND_RANK_BY_ID, PET_NAME_SLOTS, bondRankFor, getPetNameValue } from '../engine/petGrowth';
import { RENTABLE_GENERATORS } from './generators';
import { DEFAULT_DROP_PACK_ID, DROP_PACKS } from './dropPacks';
import { FACTIONS } from './factions';
import { earnedSlotCount, getForgeStats, loadCustomVariants, loadForgedOperators } from '@/game/state/operatorForgeStore';

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
export type AchievementCategory = 'combat' | 'survival' | 'world' | 'crew' | 'bestiary' | 'lokpet' | 'cards' | 'economy' | 'forge';

export const ACHIEVEMENT_CATEGORIES: Array<{ id: AchievementCategory; label: string }> = [
  { id: 'combat', label: 'Combat' },
  { id: 'survival', label: 'Survival' },
  { id: 'world', label: 'World' },
  { id: 'crew', label: 'Crew' },
  { id: 'bestiary', label: 'Bestiary' },
  { id: 'lokpet', label: 'LokPets' },
  { id: 'cards', label: 'Cards' },
  { id: 'economy', label: 'Economy' },
  { id: 'forge', label: 'Forge' },
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

/**
 * Forge achievements read the device-local Forge store (it lives outside MetaState).
 * Every counter only goes up, so a deleted operator never un-earns anything.
 */
const forge = {
  stats: () => getForgeStats(),
  distinctBases: (kind: 'enemy' | 'pet') => new Set(loadCustomVariants(kind).map((v) => v.baseId)),
};
const FACTION_ROSTERS = FACTIONS.map((f) => f.roster);
const PET_FAMILIES = ['animal', 'ghoul', 'bat', 'mote', 'blob', 'mechanical'] as const;

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
    id: 'new-loot-look',
    name: 'New Loot Look',
    description: 'Equip any drop pack other than the Potato Pack.',
    tier: 'bronze',
    isComplete: (meta) => meta.activeDropPackId !== DEFAULT_DROP_PACK_ID,
    reward: { kind: 'cred', amount: 50 },
  },
  {
    id: 'pack-rat',
    name: 'Pack Rat',
    description: 'Own three drop packs.',
    tier: 'silver',
    isComplete: (meta) => meta.ownedDropPackIds.length >= 3,
    progress: (meta) => ratio(meta.ownedDropPackIds.length, 3),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'full-stash',
    name: 'Full Stash',
    description: 'Own every drop pack.',
    tier: 'gold',
    isComplete: (meta) => meta.ownedDropPackIds.length >= DROP_PACKS.length,
    progress: (meta) => ratio(meta.ownedDropPackIds.length, DROP_PACKS.length),
    reward: { kind: 'cred', amount: 500 },
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
  {
    id: 'forge-first-spark',
    name: 'First Spark',
    description: 'Save your first operator from the Forge.',
    tier: 'bronze',
    isComplete: () => forge.stats().classicSaved + forge.stats().detailedSaved >= 1 || loadForgedOperators().length >= 1,
    reward: { kind: 'cred', amount: 50 },
  },
  {
    id: 'forge-old-school',
    name: 'Old School',
    description: 'Save an operator with the Classic v1 look.',
    tier: 'bronze',
    isComplete: () => forge.stats().classicSaved >= 1,
    reward: { kind: 'cred', amount: 50 },
  },
  {
    id: 'forge-both-eras',
    name: 'Both Eras',
    description: 'Save one Classic v1 operator and one Detailed v2 operator.',
    tier: 'silver',
    isComplete: () => forge.stats().classicSaved >= 1 && forge.stats().detailedSaved >= 1,
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'forge-full-house',
    name: 'Full House',
    description: 'Fill all five custom operator slots.',
    tier: 'gold',
    isComplete: () => earnedSlotCount() >= 5 && loadForgedOperators().length >= 5,
    progress: () => ratio(Math.min(loadForgedOperators().length, 5), 5),
    reward: { kind: 'lootTokens', amount: 10 },
  },
  {
    id: 'forge-palette-nerd',
    name: 'Palette Nerd',
    description: 'Save 10 recolored enemy or LokPet looks.',
    tier: 'silver',
    isComplete: () => forge.stats().recolored >= 10,
    progress: () => ratio(forge.stats().recolored, 10),
    reward: { kind: 'cred', amount: 150 },
  },
  {
    id: 'forge-rogues-gallery',
    name: "Rogue's Gallery",
    description: 'Keep custom looks for 10 different enemies.',
    tier: 'silver',
    isComplete: () => forge.distinctBases('enemy').size >= 10,
    progress: () => ratio(forge.distinctBases('enemy').size, 10),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'forge-menagerie',
    name: 'Menagerie',
    description: 'Keep custom looks for 10 different LokPets.',
    tier: 'silver',
    isComplete: () => forge.distinctBases('pet').size >= 10,
    progress: () => ratio(forge.distinctBases('pet').size, 10),
    reward: { kind: 'cardCredits', amount: 50 },
  },
  {
    id: 'forge-tab-hopper',
    name: 'Tab Hopper',
    description: 'Visit the Operators, Enemies and LokPets screens in the Forge.',
    tier: 'bronze',
    isComplete: () => ['operators', 'enemies', 'lokpets'].every((tab) => forge.stats().tabsVisited.includes(tab)),
    reward: { kind: 'cred', amount: 25 },
  },
  {
    id: 'forge-share-the-look',
    name: 'Share the Look',
    description: 'Copy a share code for one of your operators.',
    tier: 'bronze',
    isComplete: () => forge.stats().shareCodes >= 1,
    reward: { kind: 'cred', amount: 25 },
  },
  {
    id: 'forge-complete-collection',
    name: 'Complete Collection',
    description: 'Keep a custom look for an enemy from every faction and a LokPet from every family.',
    tier: 'legendary',
    isComplete: () => {
      const enemies = forge.distinctBases('enemy');
      const petBases = forge.distinctBases('pet');
      const factionsDone = FACTION_ROSTERS.every((roster) => roster.some((id) => enemies.has(id)));
      const familiesDone = PET_FAMILIES.every((family) => [...petBases].some((id) => LOKPET_VARIANTS.find((v) => v.id === id)?.family === family));
      return factionsDone && familiesDone;
    },
    reward: { kind: 'lootTokens', amount: 50 },
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

/** Gen Fitting Floor, its enemies, and actually playing with the quirk options. */
const GEN_FITTER_IDS = FACTIONS_BY_ID['gen-fitters']!.roster;
const GEN_STYLE_IDS = ['gen-fit-check-duelist', 'gen-pin-pouncer', 'gen-color-wheel', 'gen-grid-stitcher', 'gen-fan-sampler', 'gen-checkpoint-rewinder'];
const defeated = (meta: MetaState, ids: readonly string[]) => ids.filter((id) => (meta.bestiary[id] ?? 0) > 0).length;

const GEN_ACHIEVEMENTS: RawAchievement[] = [
  {
    id: 'gen-floor-cleared',
    name: 'Fitted for Survival',
    description: 'Survive Gen Fitting Floor.',
    tier: 'silver',
    isComplete: (meta) => meta.clearedAreaIds.includes('gen-fitting-floor'),
    reward: { kind: 'cred', amount: 400 },
  },
  {
    id: 'gen-warden-down',
    name: 'Seams Broken',
    description: 'Defeat the Tile Warden.',
    tier: 'gold',
    isComplete: (meta) => (meta.bestiary['gen-tile-warden'] ?? 0) > 0,
    reward: { kind: 'cred', amount: 600 },
  },
  {
    id: 'gen-six-styles',
    name: 'Six Ways to Lose',
    description: 'Defeat each of the six new fighting styles: the Duelist, Pouncer, Color Wheel, Stitcher, Sampler and Rewinder.',
    tier: 'silver',
    isComplete: (meta) => defeated(meta, GEN_STYLE_IDS) >= GEN_STYLE_IDS.length,
    progress: (meta) => ratio(defeated(meta, GEN_STYLE_IDS), GEN_STYLE_IDS.length),
    reward: { kind: 'cred', amount: 350 },
  },
  {
    id: 'gen-full-roster',
    name: 'Every Fit on the Rack',
    description: 'Defeat every Gen Fitter at least once.',
    tier: 'gold',
    isComplete: (meta) => defeated(meta, GEN_FITTER_IDS) >= GEN_FITTER_IDS.length,
    progress: (meta) => ratio(defeated(meta, GEN_FITTER_IDS), GEN_FITTER_IDS.length),
    reward: { kind: 'lootTokens', amount: 5 },
  },
  {
    id: 'quirk-everywhere-run',
    name: 'Nobody Is Normal Today',
    description: 'Finish a run with a quirk set to Everywhere.',
    tier: 'silver',
    isComplete: (meta) => meta.quirkEverywhereRuns >= 1,
    reward: { kind: 'cred', amount: 750 },
  },
  {
    id: 'quirk-everywhere-run-10',
    name: 'Weird Weather',
    description: 'Finish 10 runs with a quirk set to Everywhere.',
    tier: 'gold',
    isComplete: (meta) => meta.quirkEverywhereRuns >= 10,
    progress: (meta) => ratio(meta.quirkEverywhereRuns, 10),
    reward: { kind: 'lootTokens', amount: 10 },
  },
  {
    id: 'quirk-taken-run',
    name: 'Wearing the Weird',
    description: 'Finish a run with a quirk taken on.',
    tier: 'silver',
    isComplete: (meta) => meta.quirkTakenRuns >= 1,
    reward: { kind: 'cred', amount: 750 },
  },
  {
    id: 'quirk-taken-run-10',
    name: 'Quirk by Nature',
    description: 'Finish 10 runs with a quirk taken on.',
    tier: 'gold',
    isComplete: (meta) => meta.quirkTakenRuns >= 10,
    progress: (meta) => ratio(meta.quirkTakenRuns, 10),
    reward: { kind: 'lootTokens', amount: 10 },
  },
];
RAW_ACHIEVEMENTS.push(...GEN_ACHIEVEMENTS);

/** The Quirk Surge, its unlock, and the end game it leads to. */
const SURGE_ACHIEVEMENTS: RawAchievement[] = [
  {
    id: 'surge-glyph-reader',
    name: 'Glyph Reader',
    description: 'Clear 14 maps, enough to start seeing the glyphs.',
    tier: 'bronze',
    isComplete: (meta) => meta.clearedAreaIds.length >= QUIRK_SURGE_UNLOCK_MAPS,
    progress: (meta) => ratio(meta.clearedAreaIds.length, QUIRK_SURGE_UNLOCK_MAPS),
    reward: { kind: 'cred', amount: 200 },
  },
  {
    id: 'surge-first',
    name: 'Heard the Howls',
    description: 'Outlast a Quirk Surge.',
    tier: 'silver',
    isComplete: (meta) => meta.quirkSurgesSurvived >= 1,
    reward: { kind: 'cred', amount: 500 },
  },
  {
    id: 'surge-10',
    name: 'Eclipse Regular',
    description: 'Outlast 10 Quirk Surges.',
    tier: 'gold',
    isComplete: (meta) => meta.quirkSurgesSurvived >= 10,
    progress: (meta) => ratio(meta.quirkSurgesSurvived, 10),
    reward: { kind: 'lootTokens', amount: 5 },
  },
  {
    id: 'surge-50',
    name: 'Nothing Surprises Me',
    description: 'Outlast 50 Quirk Surges.',
    tier: 'legendary',
    isComplete: (meta) => meta.quirkSurgesSurvived >= 50,
    progress: (meta) => ratio(meta.quirkSurgesSurvived, 50),
    reward: { kind: 'lootTokens', amount: 25 },
  },
  {
    id: 'victory-lap-reached',
    name: 'Victory Lap',
    description: 'Clear every standard map and open the end game.',
    tier: 'gold',
    isComplete: (meta) => endgameReached(meta),
    progress: (meta) => { const { have, need } = mapsCleared(meta); return ratio(have, need); },
    reward: { kind: 'cred', amount: 1000 },
  },
];
RAW_ACHIEVEMENTS.push(...SURGE_ACHIEVEMENTS);

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
  'forge-first-spark': 'forge', 'forge-old-school': 'forge', 'forge-both-eras': 'forge', 'forge-full-house': 'forge',
  'forge-palette-nerd': 'forge', 'forge-rogues-gallery': 'forge', 'forge-menagerie': 'forge', 'forge-tab-hopper': 'forge',
  'forge-share-the-look': 'forge', 'forge-complete-collection': 'forge',
  'passive-income': 'economy', 'new-loot-look': 'economy', 'pack-rat': 'economy', 'full-stash': 'economy',
  'surge-glyph-reader': 'world', 'surge-first': 'combat', 'surge-10': 'combat', 'surge-50': 'combat', 'victory-lap-reached': 'world',
  'gen-floor-cleared': 'world', 'gen-warden-down': 'combat', 'gen-six-styles': 'bestiary', 'gen-full-roster': 'bestiary',
  'quirk-everywhere-run': 'combat', 'quirk-everywhere-run-10': 'combat', 'quirk-taken-run': 'combat', 'quirk-taken-run-10': 'combat',
};

export const ACHIEVEMENTS: AchievementDef[] = RAW_ACHIEVEMENTS.map((achievement) => ({
  ...achievement,
  category: CATEGORY_BY_ID[achievement.id] ?? (achievement.id.startsWith('quirk-') ? 'bestiary' : 'world'),
}));

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

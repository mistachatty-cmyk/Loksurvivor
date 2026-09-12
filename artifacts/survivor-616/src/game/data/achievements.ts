import type { MetaState } from '@/game/types';
import { ALLIES } from './progression';
import { AREAS } from './areas';
import { CHARACTERS } from './characters';
import { CITY_RELICS } from './relics';
import { ENEMIES } from './enemies';
import { LOKPET_VARIANTS } from './lokPets';
import { RENTABLE_GENERATORS } from './generators';

export interface AchievementReward {
  kind: 'cred' | 'lootTokens';
  amount: number;
}

/**
 * Pure function over `MetaState`, never a stored boolean -- see
 * `.agents/memory/achievements-unlockables-plan.md` for why. The one
 * exception is `reward`: a currency payout must fire exactly once, so
 * claiming one is tracked separately in `meta.claimedAchievementIds`
 * (see `claimAchievement` in `state/metaStore.tsx`) rather than here.
 */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  isComplete: (meta: MetaState) => boolean;
  /** 0..1 for a progress bar on incomplete achievements; omit for a pure binary flag. */
  progress?: (meta: MetaState) => number;
  reward?: AchievementReward;
}

const ratio = (value: number, total: number) => (total <= 0 ? 0 : Math.min(1, value / total));

export const ACHIEVEMENTS: AchievementDef[] = [
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
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

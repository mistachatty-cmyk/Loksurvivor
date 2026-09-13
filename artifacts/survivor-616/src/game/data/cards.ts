/**
 * 616 Survivor's trading-card layer: every card is a pure projection of
 * existing content records (roster, bestiary, crew, LokPets) into the LOK
 * Portable Asset Spec (`game/lok/types.ts`). Nothing here is separately
 * authored content and nothing here is separately persisted state --
 * ownership is derived from the same `MetaState` fields that already drive
 * the Archive (`unlockedCharacterIds`, `bestiary`, `rescuedAllyIds`,
 * `lokPetCatalog`, `endlessDiscoveryIds`, `endlessRecordDistancePx`) so a
 * card can never drift out of sync with the progression it represents.
 * See `.agents/memory/tcg-lokpet-crossover.md`.
 */
import type { EndlessBandId, MetaState, UnlockRule } from '@/game/types';
import type { LokAssetAcquisitionMethod, LokAssetManifest, LokAssetRarity, LokPetCardMetadata } from '@/game/lok/types';
import { G6_616_SURVIVOR_NAMESPACE, lokAssetId } from '@/game/lok/types';
import { CHARACTERS } from './characters';
import { ENEMIES } from './enemies';
import { ALLIES } from './progression';
import { LOKPET_VARIANTS } from './lokPets';
import { ENDLESS_BANDS } from './endlessBands';

const NS = G6_616_SURVIVOR_NAMESPACE;

function acquisitionForUnlock(rule: UnlockRule): LokAssetAcquisitionMethod[] {
  switch (rule.kind) {
    case 'default': return ['starter'];
    case 'rescue': return ['scenario'];
    case 'clearArea': return ['scenario'];
    case 'discovery': return ['secret'];
    case 'kills': return ['achievement'];
  }
}

const definitionOwnership = (uniqueInstance: boolean) => ({
  transferPolicy: 'soulbound' as const,
  uniqueInstance,
  stackable: false,
  requiresServerAuthorityForTransfer: true,
  survivesRunReset: true,
});

const BAND_RARITY: Record<EndlessBandId, LokAssetRarity> = {
  core: 'common',
  floodwall: 'uncommon',
  'rail-shadow': 'rare',
  'industrial-fringe': 'epic',
  'outer-threshold': 'legendary',
};

const DISTANCE_MILESTONES: Array<{ px: number; rarity: LokAssetRarity; slug: string; name: string }> = [
  { px: 5000, rarity: 'uncommon', slug: 'endless-milestone-5000', name: 'Endless Beacon: 5,000' },
  { px: 15000, rarity: 'rare', slug: 'endless-milestone-15000', name: 'Endless Beacon: 15,000' },
  { px: 30000, rarity: 'epic', slug: 'endless-milestone-30000', name: 'Endless Beacon: 30,000' },
];

/** Character roster, one card per playable operative. */
export const CHARACTER_CARDS: LokAssetManifest[] = CHARACTERS.map((character) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, `character-${character.id}`),
  namespace: NS,
  slug: `character-${character.id}`,
  kind: 'card',
  version: 1,
  name: character.name,
  description: character.tagline,
  rarity: character.rarity === 'legendary' ? 'legendary' : 'uncommon',
  tags: ['character', 'roster'],
  acquisition: acquisitionForUnlock(character.unlock),
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
}));

function enemyRarity(enemy: (typeof ENEMIES)[number]): LokAssetRarity {
  if (enemy.family === 'Boss') return 'epic';
  if (enemy.sizeClass === 'giant') return 'rare';
  if (enemy.sizeClass === 'elite') return 'uncommon';
  return 'common';
}

/** Bestiary, one card per enemy -- owned once the player has recorded a defeat. */
export const ENEMY_CARDS: LokAssetManifest[] = ENEMIES.map((enemy) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, `enemy-${enemy.id}`),
  namespace: NS,
  slug: `enemy-${enemy.id}`,
  kind: 'card',
  version: 1,
  name: enemy.name,
  description: enemy.lore,
  rarity: enemyRarity(enemy),
  tags: ['enemy', 'bestiary', enemy.family],
  acquisition: ['scenario'],
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
}));

/**
 * Rescued crew -- `companion-profile` is the spec's exact fit for an advisor
 * that can appear inside another G-Six game (see `LokCompanionProfileMetadata`
 * upstream). 616 Survivor doesn't render companion behavior itself; this only
 * describes the portable identity a receiving game could hang one on.
 */
export const ALLY_CARDS: LokAssetManifest[] = ALLIES.map((ally) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, `ally-${ally.id}`),
  namespace: NS,
  slug: `ally-${ally.id}`,
  kind: 'companion-profile',
  version: 1,
  name: ally.name,
  description: ally.blurb,
  rarity: 'rare',
  tags: ['ally', 'crew'],
  acquisition: ['scenario'],
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
}));

/**
 * LokPet variant definitions -- the family/silhouette a player has ever
 * rolled, not a specific roll. Metadata mirrors `LokPetCardMetadata` so a
 * receiving game can recognize the species even without 616 Survivor's own
 * stat model.
 */
export const LOKPET_CARDS: LokAssetManifest<LokPetCardMetadata>[] = LOKPET_VARIANTS.map((variant) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, `pet-${variant.id}`),
  namespace: NS,
  slug: `pet-${variant.id}`,
  kind: 'pet',
  version: 1,
  name: variant.name,
  description: variant.description,
  rarity: variant.legendary ? 'mythic' : 'common',
  tags: ['lokpet', variant.family],
  acquisition: ['generated'],
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
  metadata: { species: variant.family, variant: variant.silhouette },
}));

/** Endless-mode exclusive cards -- one per distance band, awarded on first discovery. */
export const ENDLESS_BAND_CARDS: LokAssetManifest[] = ENDLESS_BANDS.map((band) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, `endless-band-${band.id}`),
  namespace: NS,
  slug: `endless-band-${band.id}`,
  kind: 'collectible',
  version: 1,
  name: `Endless Beacon: ${band.label}`,
  description: band.eventDescription,
  rarity: BAND_RARITY[band.id],
  tags: ['endless', 'band'],
  acquisition: ['achievement'],
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
}));

/** Endless-mode exclusive cards -- one per lifetime distance milestone. */
export const ENDLESS_MILESTONE_CARDS: LokAssetManifest[] = DISTANCE_MILESTONES.map((milestone) => ({
  schema: 'lok.asset',
  schemaVersion: 1,
  id: lokAssetId(NS, milestone.slug),
  namespace: NS,
  slug: milestone.slug,
  kind: 'collectible',
  version: 1,
  name: milestone.name,
  description: `Reached ${milestone.px.toLocaleString()} world units from the core in a single endless run.`,
  rarity: milestone.rarity,
  tags: ['endless', 'milestone'],
  acquisition: ['achievement'],
  ownership: definitionOwnership(false),
  provenance: { sourceGame: '616-survivor' },
}));

export const CARD_MANIFESTS: LokAssetManifest[] = [
  ...CHARACTER_CARDS,
  ...ENEMY_CARDS,
  ...ALLY_CARDS,
  ...LOKPET_CARDS,
  ...ENDLESS_BAND_CARDS,
  ...ENDLESS_MILESTONE_CARDS,
];

export const CARD_MANIFESTS_BY_ID: Record<string, LokAssetManifest> = Object.fromEntries(
  CARD_MANIFESTS.map((card) => [card.id, card]),
);

/**
 * Pure function over `MetaState`, same contract as `AchievementDef.isComplete`
 * -- never a stored boolean. Ownership is a projection of progression that
 * already persists elsewhere, so it can't desync from the Archive tabs it
 * mirrors.
 */
export function isCardOwned(card: LokAssetManifest, meta: MetaState): boolean {
  if (card.slug.startsWith('character-')) {
    return meta.unlockedCharacterIds.includes(card.slug.slice('character-'.length));
  }
  if (card.slug.startsWith('enemy-')) {
    return (meta.bestiary[card.slug.slice('enemy-'.length)] ?? 0) > 0;
  }
  if (card.slug.startsWith('ally-')) {
    return meta.rescuedAllyIds.includes(card.slug.slice('ally-'.length));
  }
  if (card.slug.startsWith('pet-')) {
    const variantId = card.slug.slice('pet-'.length);
    return meta.lokPetCatalog.some((entry) => entry.variantId === variantId);
  }
  if (card.slug.startsWith('endless-band-')) {
    const bandId = card.slug.slice('endless-band-'.length) as EndlessBandId;
    return meta.endlessDiscoveryIds.includes(bandId);
  }
  const milestone = DISTANCE_MILESTONES.find((m) => card.slug === m.slug);
  if (milestone) {
    return meta.endlessRecordDistancePx >= milestone.px;
  }
  return false;
}

export interface CardCollectionSummary {
  owned: number;
  total: number;
}

export function cardCollectionSummary(meta: MetaState): CardCollectionSummary {
  let owned = 0;
  for (const card of CARD_MANIFESTS) {
    if (isCardOwned(card, meta)) owned += 1;
  }
  return { owned, total: CARD_MANIFESTS.length };
}

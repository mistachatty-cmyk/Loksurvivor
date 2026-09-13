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

export type LokDeckSetId = 'operatives' | 'threats' | 'crew' | 'lokpets' | 'endless';

/**
 * Presentation metadata shared by Survivor 616's binder and the future
 * Lock Decks application. It describes a card definition, never a player's
 * owned/tradeable instance.
 */
export interface LokDeckCardMetadata extends Record<string, unknown> {
  setId: LokDeckSetId;
  cardNumber: string;
  subjectType: 'character' | 'enemy' | 'ally' | 'lokpet' | 'discovery';
  subjectId: string;
  sourceApp: 'survivor-616';
  playableInSurvivor616: boolean;
}

export interface LokDeckSet {
  id: LokDeckSetId;
  name: string;
  kicker: string;
  description: string;
  cardIds: string[];
}

function deckMetadata(
  setId: LokDeckSetId,
  subjectType: LokDeckCardMetadata['subjectType'],
  subjectId: string,
  cardNumber: string,
  playableInSurvivor616 = false,
): LokDeckCardMetadata {
  return { setId, subjectType, subjectId, cardNumber, sourceApp: 'survivor-616', playableInSurvivor616 };
}

function acquisitionForUnlock(rule: UnlockRule): LokAssetAcquisitionMethod[] {
  switch (rule.kind) {
    case 'default': return ['starter'];
    case 'rescue': return ['scenario'];
    case 'clearArea': return ['scenario'];
    case 'discovery': return ['secret'];
    case 'kills': return ['achievement'];
    case 'lokPetCards': return ['achievement'];
    case 'lokCollector': return ['achievement'];
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
export const CHARACTER_CARDS: LokAssetManifest<LokDeckCardMetadata>[] = CHARACTERS.map((character, index) => ({
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
  visual: { previewKey: `character:${character.id}`, paletteId: character.id },
  metadata: deckMetadata('operatives', 'character', character.id, `S616-OP-${String(index + 1).padStart(3, '0')}`, true),
}));

function enemyRarity(enemy: (typeof ENEMIES)[number]): LokAssetRarity {
  if (enemy.family === 'Boss') return 'epic';
  if (enemy.sizeClass === 'giant') return 'rare';
  if (enemy.sizeClass === 'elite') return 'uncommon';
  return 'common';
}

/** Bestiary, one card per enemy -- owned once the player has recorded a defeat. */
export const ENEMY_CARDS: LokAssetManifest<LokDeckCardMetadata>[] = ENEMIES.map((enemy, index) => ({
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
  visual: { previewKey: `enemy:${enemy.id}`, paletteId: enemy.id },
  metadata: deckMetadata('threats', 'enemy', enemy.id, `S616-TH-${String(index + 1).padStart(3, '0')}`),
}));

/**
 * Rescued crew -- `companion-profile` is the spec's exact fit for an advisor
 * that can appear inside another G-Six game (see `LokCompanionProfileMetadata`
 * upstream). 616 Survivor doesn't render companion behavior itself; this only
 * describes the portable identity a receiving game could hang one on.
 */
export const ALLY_CARDS: LokAssetManifest<LokDeckCardMetadata>[] = ALLIES.map((ally, index) => ({
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
  visual: { previewKey: `ally:${ally.id}`, paletteId: ally.id },
  metadata: deckMetadata('crew', 'ally', ally.id, `S616-CR-${String(index + 1).padStart(3, '0')}`),
}));

/**
 * LokPet variant definitions -- the family/silhouette a player has ever
 * rolled, not a specific roll. Metadata mirrors `LokPetCardMetadata` so a
 * receiving game can recognize the species even without 616 Survivor's own
 * stat model.
 */
export const LOKPET_CARDS: LokAssetManifest<LokPetCardMetadata & LokDeckCardMetadata>[] = LOKPET_VARIANTS.map((variant, index) => ({
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
  visual: { previewKey: `lokpet:${variant.id}`, paletteId: variant.id },
  metadata: {
    ...deckMetadata('lokpets', 'lokpet', variant.id, `S616-LP-${String(index + 1).padStart(3, '0')}`),
    species: variant.family,
    variant: variant.silhouette,
  },
}));

/** Endless-mode exclusive cards -- one per distance band, awarded on first discovery. */
export const ENDLESS_BAND_CARDS: LokAssetManifest<LokDeckCardMetadata>[] = ENDLESS_BANDS.map((band, index) => ({
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
  visual: { previewKey: `endless-band:${band.id}` },
  metadata: deckMetadata('endless', 'discovery', band.id, `S616-EN-${String(index + 1).padStart(3, '0')}`),
}));

/** Endless-mode exclusive cards -- one per lifetime distance milestone. */
export const ENDLESS_MILESTONE_CARDS: LokAssetManifest<LokDeckCardMetadata>[] = DISTANCE_MILESTONES.map((milestone, index) => ({
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
  visual: { previewKey: `endless-milestone:${milestone.px}` },
  metadata: deckMetadata('endless', 'discovery', milestone.slug, `S616-EN-${String(ENDLESS_BANDS.length + index + 1).padStart(3, '0')}`),
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

function cardsForSet(setId: LokDeckSetId): string[] {
  return CARD_MANIFESTS
    .filter((card) => (card.metadata as LokDeckCardMetadata | undefined)?.setId === setId)
    .map((card) => card.id);
}

/** Pack/set definitions are portable catalog organization, not loot odds. */
export const CARD_PACKS: LokDeckSet[] = [
  {
    id: 'operatives',
    name: 'Sector Operatives',
    kicker: 'Playable character pack',
    description: 'Every survivor you can field, rendered from their real in-game rig.',
    cardIds: cardsForSet('operatives'),
  },
  {
    id: 'threats',
    name: 'Night Shift Threats',
    kicker: 'Bestiary pack',
    description: 'Hostiles catalogued by defeating them in the city.',
    cardIds: cardsForSet('threats'),
  },
  {
    id: 'crew',
    name: 'Hideout Crew',
    kicker: 'Companion pack',
    description: 'Rescued allies and future cross-app companion profiles.',
    cardIds: cardsForSet('crew'),
  },
  {
    id: 'lokpets',
    name: 'Signal Beasts',
    kicker: 'LokPet discovery pack',
    description: 'Survivor 616 LokPet families, ready to bridge into Lock Decks later.',
    cardIds: cardsForSet('lokpets'),
  },
  {
    id: 'endless',
    name: 'Beyond the Grid',
    kicker: 'Endless chase pack',
    description: 'Distance beacons and strange districts found past the city core.',
    cardIds: cardsForSet('endless'),
  },
];

export const CARD_PACKS_BY_ID: Record<LokDeckSetId, LokDeckSet> = Object.fromEntries(
  CARD_PACKS.map((pack) => [pack.id, pack]),
) as Record<LokDeckSetId, LokDeckSet>;

export function cardPackFor(card: LokAssetManifest): LokDeckSet {
  const setId = (card.metadata as LokDeckCardMetadata | undefined)?.setId ?? 'endless';
  return CARD_PACKS_BY_ID[setId];
}

/**
 * Serializable definition catalog for G6.online / Lock Decks. Player ownership
 * is intentionally excluded: account sync will layer instances onto these IDs.
 */
export const LOK_DECK_CATALOG = {
  schema: 'lok.deck-catalog' as const,
  schemaVersion: 1 as const,
  namespace: NS,
  catalogVersion: 1,
  sourceApp: 'survivor-616' as const,
  sets: CARD_PACKS,
  cards: CARD_MANIFESTS,
};

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

/**
 * Local mirror of the G-Six "LOK Portable Asset Spec v1" contract, defined
 * upstream at `spend-ut-all/integrations/lok/assets/types.ts` and documented
 * in `spend-ut-all/docs/LOK_PORTABLE_ASSET_SPEC.md`. See
 * `.agents/memory/tcg-lokpet-crossover.md` for why this is a hand-kept
 * mirror rather than a shared package import: 616 Survivor and Spend It All
 * are independently deployed apps in separate repos with no shared build,
 * so the contract is duplicated by value. Any change here must be mirrored
 * there (and vice versa) or the two repos' JSON stops being
 * structurally interchangeable -- `schemaVersion` is the field that exists
 * specifically to catch that drift.
 *
 * 616 Survivor's namespace is `g6.616-survivor`, following the spec's
 * `g6.<repo-name>` convention (see `g6.spend-it-all`, `g6.localingu`).
 */

export type LokAssetKind =
  | 'theme'
  | 'palette'
  | 'hud'
  | 'money-counter'
  | 'background'
  | 'profile-frame'
  | 'title-style'
  | 'effect'
  | 'motion-pack'
  | 'pet'
  | 'companion-profile'
  | 'pet-accessory'
  | 'collectible'
  | 'card';

export type LokAssetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';
export type LokAssetTransferPolicy = 'soulbound' | 'tradeable' | 'giftable' | 'server-controlled';
export type LokAssetAcquisitionMethod = 'starter' | 'achievement' | 'scenario' | 'lok' | 'lok-pass' | 'event' | 'secret' | 'supporter' | 'generated' | 'trade';

export type LokAssetProvenance = {
  sourceGame: string;
  sourceVersion?: string;
  createdAt?: number;
  generation?: number;
  generationSeed?: string;
  eventId?: string;
  achievementId?: string;
  scenarioId?: string;
  originalOwnerId?: string | null;
};

export type LokAssetOwnershipRules = {
  transferPolicy: LokAssetTransferPolicy;
  uniqueInstance: boolean;
  stackable: boolean;
  maxStack?: number;
  requiresServerAuthorityForTransfer: boolean;
  survivesRunReset: boolean;
};

export type LokAssetVisualRef = {
  previewKey?: string;
  spriteSheet?: string;
  spriteFrameWidth?: number;
  spriteFrameHeight?: number;
  paletteId?: string;
  animationSetId?: string;
};

export type LokAssetManifest<TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
  schema: 'lok.asset';
  schemaVersion: 1;
  id: string;
  namespace: string;
  slug: string;
  kind: LokAssetKind;
  version: number;
  name: string;
  description?: string;
  rarity: LokAssetRarity;
  tags?: string[];
  acquisition: LokAssetAcquisitionMethod[];
  ownership: LokAssetOwnershipRules;
  provenance: LokAssetProvenance;
  visual?: LokAssetVisualRef;
  metadata?: TMetadata;
};

/** Portable metadata for a character/card inside the broad LOKdex universe. */
export type LokPetCardMetadata = {
  species: string;
  generation?: number;
  variant?: string;
  personality?: string;
  traits?: string[];
  cardNumber?: string;
  evolutionFamily?: string;
  powerProfile?: Record<string, number>;
};

/**
 * A companion profile is a separate presentation/behavior asset that
 * references a LOKdex character. Only curated characters receive one; card
 * ownership alone never grants advisor behavior in a receiving game.
 */
export type LokCompanionProfileMetadata = {
  characterAssetId: string;
  hostGame: string;
  advisorRole: 'starter' | 'money' | 'work' | 'risk' | 'travel' | 'general';
  preferredAnchor: 'money-counter' | 'sidebar' | 'footer' | 'room' | 'free';
  reactionIds: string[];
  dialogueSetId?: string;
  animationSetId?: string;
};

/** Namespaced id helper -- mirrors the upstream `namespace:slug` convention. */
export function lokAssetId(namespace: string, slug: string): string {
  return `${namespace}:${slug}`;
}

export const G6_616_SURVIVOR_NAMESPACE = 'g6.616-survivor';

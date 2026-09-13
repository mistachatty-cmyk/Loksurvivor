import type { LokPetPalette, LokPetSilhouette, VisitingLokCard } from '@/game/types';

/**
 * Self-contained implementation of the `lok.card-exchange` protocol that
 * Spend It All's LOKdex documents in docs/LOK_CARD_EXCHANGE_PROTOCOL.md and
 * docs/LOK_PORTABLE_ASSET_SPEC.md. Deliberately has zero dependency on that
 * repository or any shared package -- the contract is plain JSON, and any
 * G-Six game (this one included) implements its own copy of it.
 *
 * 616 Survivor's side of the exchange is one-directional in spirit with the
 * rest of this game's rules: an imported card only ever becomes a
 * VisitingLokCard, a cosmetic Archive record. It can never become a
 * SavedLokPet (the kennel entries `RunScreen.tsx` turns into
 * `startingLokPets`), because nothing here can trust another game's numbers
 * for combat balance, and per `.agents/memory/survivor-616-art-assets.md`
 * only this game's own procedural rig may ever represent a character on
 * screen -- an imported card is rendered with a fixed local silhouette
 * (see LokPetIcon usage in ArchivePanel), never reconstructed foreign art.
 */

export const LOK_CARD_EXCHANGE_FORMAT = 'lok.card-exchange';
export const LOK_CARD_EXCHANGE_FORMAT_VERSION = 1;
export const LOK_ASSET_SCHEMA = 'lok.asset';
export const LOK_ASSET_SCHEMA_VERSION = 1;
/** This game's own namespace when it becomes the sender. */
export const LOK_NAMESPACE = 'g6.616-survivor';

type LokAssetProvenance = {
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

type LokAssetManifest = {
  schema: string;
  schemaVersion: number;
  id: string;
  namespace: string;
  slug: string;
  kind: string;
  version: number;
  name: string;
  description?: string;
  rarity: string;
  tags?: string[];
  acquisition: string[];
  ownership: {
    transferPolicy: string;
    uniqueInstance: boolean;
    stackable: boolean;
    requiresServerAuthorityForTransfer: boolean;
    survivesRunReset: boolean;
  };
  provenance: LokAssetProvenance;
  metadata?: Record<string, unknown>;
};

type LokOwnedAsset = {
  instanceId: string;
  assetId: string;
  assetVersion: number;
  acquiredAt: number;
  acquisitionMethod: string;
  ownerId: string | null;
  sourceGame: string;
  quantity: number;
  provenance: LokAssetProvenance;
  transferCount: number;
};

/**
 * Fixed local rendering identity for every visiting card, regardless of
 * source game. Never derived from the import's own data: only this game's
 * own procedural rig may represent a character on screen, so a foreign card
 * reads as "an incoming signal," never a guess at the sender's actual art.
 */
export const VISITING_CARD_SILHOUETTE: LokPetSilhouette = 'spark';
export const VISITING_CARD_PALETTE: LokPetPalette = {
  body: '#3d4759',
  bodyDark: '#1b212c',
  accent: '#8fb8ff',
  glow: '#8fb8ff',
  eye: '#eef4ff',
};

export type LokPortableCardExport = {
  format: typeof LOK_CARD_EXCHANGE_FORMAT;
  formatVersion: typeof LOK_CARD_EXCHANGE_FORMAT_VERSION;
  manifest: LokAssetManifest;
  owned: LokOwnedAsset;
  printVariant: string;
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Flavor-only fields safe to hand to another game -- never combat stats. */
export type ExportableLokPet = {
  id: string;
  name: string;
  variantId: string;
  family: string;
  rarity: string;
  description: string;
};

/**
 * Turns a captured kennel companion (or a catalogued sighting) into a
 * portable card export. Only cosmetic flavor crosses over -- silhouette,
 * family, and rarity label -- never `LokPetRoll.stats`, since a receiving
 * game has no way to validate an arbitrary power number and shouldn't have
 * to trust one.
 */
export function exportLokPetAsPortableCard(pet: ExportableLokPet): LokPortableCardExport {
  const slug = slugify(pet.id);
  const id = `${LOK_NAMESPACE}:${slug}`;
  const now = Date.now();
  const provenance: LokAssetProvenance = { sourceGame: LOK_NAMESPACE, createdAt: now };
  const manifest: LokAssetManifest = {
    schema: LOK_ASSET_SCHEMA,
    schemaVersion: LOK_ASSET_SCHEMA_VERSION,
    id,
    namespace: LOK_NAMESPACE,
    slug,
    kind: 'card',
    version: 1,
    name: pet.name,
    description: pet.description,
    rarity: pet.rarity,
    tags: ['lokpet', pet.family, pet.variantId],
    acquisition: ['generated'],
    ownership: {
      // Cosmetic-only for now, same as Spend It All's side of this protocol:
      // giftable in policy, but requiresServerAuthorityForTransfer keeps a
      // local save-file copy from ever posing as a secure transfer.
      transferPolicy: 'giftable',
      uniqueInstance: true,
      stackable: false,
      requiresServerAuthorityForTransfer: true,
      survivesRunReset: true,
    },
    provenance,
    metadata: { species: pet.family, variant: pet.variantId },
  };
  const owned: LokOwnedAsset = {
    instanceId: `${id}#${slugify(pet.id)}-${now}`,
    assetId: id,
    assetVersion: 1,
    acquiredAt: now,
    acquisitionMethod: 'generated',
    ownerId: null,
    sourceGame: LOK_NAMESPACE,
    quantity: 1,
    provenance,
    transferCount: 0,
  };
  return { format: LOK_CARD_EXCHANGE_FORMAT, formatVersion: LOK_CARD_EXCHANGE_FORMAT_VERSION, manifest, owned, printVariant: 'standard' };
}

export function serializeLokCardExport(payload: LokPortableCardExport): string {
  return JSON.stringify(payload, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseLokCardExport(raw: string): LokPortableCardExport | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.format !== LOK_CARD_EXCHANGE_FORMAT || value.formatVersion !== LOK_CARD_EXCHANGE_FORMAT_VERSION) return null;
  if (!isRecord(value.manifest) || !isRecord(value.owned)) return null;
  return value as LokPortableCardExport;
}

export type LokCardImportResult =
  | { success: true; card: VisitingLokCard }
  | { success: false; error: string };

/**
 * Validates a pasted export and turns it into a display-only VisitingLokCard.
 * Never grants gameplay power or a kennel slot -- see the module doc above.
 */
export function importLokCardExport(raw: string): LokCardImportResult {
  const payload = parseLokCardExport(raw);
  if (!payload) return { success: false, error: 'That is not a recognized LOK card export.' };

  const { manifest, owned } = payload;
  if (manifest.schema !== LOK_ASSET_SCHEMA || manifest.schemaVersion !== LOK_ASSET_SCHEMA_VERSION) {
    return { success: false, error: 'Unsupported LOK asset schema version.' };
  }
  if (typeof manifest.namespace !== 'string' || !manifest.namespace.trim()) {
    return { success: false, error: 'Card is missing a namespace.' };
  }
  if (manifest.namespace === LOK_NAMESPACE) {
    return { success: false, error: 'This card already belongs to 616 Survivor -- nothing to import.' };
  }
  if (manifest.kind !== 'card') return { success: false, error: 'Only card-kind LOK assets can be imported.' };
  if (!isRecord(manifest.provenance) || typeof manifest.provenance.sourceGame !== 'string' || !manifest.provenance.sourceGame) {
    return { success: false, error: 'Card is missing provenance.' };
  }
  if (typeof owned.instanceId !== 'string' || !owned.instanceId) {
    return { success: false, error: 'Card is missing an instance id.' };
  }

  const card: VisitingLokCard = {
    instanceId: owned.instanceId,
    assetId: typeof manifest.id === 'string' ? manifest.id : owned.assetId ?? owned.instanceId,
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name : 'Unknown visitor',
    description: typeof manifest.description === 'string' ? manifest.description : undefined,
    rarity: typeof manifest.rarity === 'string' && manifest.rarity ? manifest.rarity : 'common',
    sourceGame: manifest.provenance.sourceGame,
    tags: Array.isArray(manifest.tags) ? manifest.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    importedAt: Date.now(),
  };
  return { success: true, card };
}

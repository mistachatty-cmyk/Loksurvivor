import type { LokPetRarity, MetaState } from '@/game/types';
import { G6_616_SURVIVOR_NAMESPACE, lokAssetId } from '@/game/lok/types';

/**
 * The compact "what does this player own" record 616 Survivor publishes to
 * their account so the GSix hub's LokDex can show it. Hand-kept mirror of
 * `apps/hub/lib/lokdex/types.ts` in the Gsixhub repo (separate repos, no
 * shared build -- same arrangement as `game/lok/types.ts`). `version` is the
 * drift alarm: bump it on both sides together.
 *
 * Deliberately a summary: card ids and counts plus a few fields per pet. It is
 * derived from `MetaState` on every push, never stored, so it cannot drift
 * from the progression it describes.
 */
export const LOKDEX_APP_KEY = 'survivor616';
export const LOKDEX_SNAPSHOT_SCHEMA = 'lok.dex-snapshot';
export const LOKDEX_SNAPSHOT_VERSION = 1;

type DexRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';

export interface DexSnapshotCard {
  id: string;
  copies: number;
  best?: string;
}

export interface DexSnapshotPet {
  id: string;
  speciesId: string;
  name: string;
  level?: number;
  rarity?: DexRarity;
  starter?: boolean;
}

export interface LokDexSnapshot {
  schema: typeof LOKDEX_SNAPSHOT_SCHEMA;
  version: typeof LOKDEX_SNAPSHOT_VERSION;
  appKey: string;
  updatedAt: number;
  cards: DexSnapshotCard[];
  pets: DexSnapshotPet[];
}

const RARITY_BY_LOKPET_RARITY: Record<LokPetRarity, DexRarity> = {
  common: 'common',
  charged: 'uncommon',
  rare: 'rare',
  mythic: 'mythic',
};

const MAX_NAME_LENGTH = 24;

type DexSource = Pick<MetaState, 'cardCollection' | 'savedLokPets'>;

/** `now` is injectable so the output is deterministic under test. */
export function buildLokDexSnapshot(meta: DexSource, now = Date.now()): LokDexSnapshot {
  const cards: DexSnapshotCard[] = meta.cardCollection
    .filter((record) => record.copies > 0)
    .map((record) => ({
      id: record.cardId,
      copies: record.copies,
      ...(record.bestVariant && record.bestVariant !== 'standard' ? { best: record.bestVariant } : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const pets: DexSnapshotPet[] = meta.savedLokPets.map((pet) => ({
    id: pet.id,
    speciesId: lokAssetId(G6_616_SURVIVOR_NAMESPACE, `pet-${pet.roll.variantId}`),
    name: (pet.name?.trim() || pet.roll.name).slice(0, MAX_NAME_LENGTH),
    level: pet.level ?? pet.roll.level ?? 1,
    rarity: RARITY_BY_LOKPET_RARITY[pet.roll.rarity],
    ...(pet.starter ? { starter: true } : {}),
  }));

  return {
    schema: LOKDEX_SNAPSHOT_SCHEMA,
    version: LOKDEX_SNAPSHOT_VERSION,
    appKey: LOKDEX_APP_KEY,
    updatedAt: now,
    cards,
    pets,
  };
}

/**
 * Stable fingerprint of everything in a snapshot except `updatedAt`, so the
 * sync layer can skip a network write when nothing the hub shows has changed
 * (a run that only moved gold must not re-upload the collection).
 */
export function lokDexSnapshotFingerprint(snapshot: LokDexSnapshot): string {
  return JSON.stringify([snapshot.cards, snapshot.pets]);
}

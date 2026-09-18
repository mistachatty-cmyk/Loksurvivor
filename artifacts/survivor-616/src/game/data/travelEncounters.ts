/**
 * Data for the hub-side "travel encounter" minigame -- the "classic version"
 * described in .agents/memory/travel-encounters.md: flat, mildly
 * rarity/variant-scaled card-throw damage, no per-card unique effects yet.
 * Only ever read from `game/travelEncounter.ts` and the travel-encounter UI;
 * `engine/world.ts` never touches any of this.
 */
import type { CardVariant, OwnedCardRecord } from '@/game/types';
import type { LokAssetRarity } from '@/game/lok/types';
import { CARD_MANIFESTS_BY_ID } from './cards';
import { PASSIVE_CARDS_BY_ID, type PassiveCardRarity } from './passiveCards';

export type TravelEncounterSource = 'hub-room' | 'run-launch';

export interface TravelEncounterTrigger {
  id: string;
  source: TravelEncounterSource;
  /** Only meaningful when source === 'hub-room': the HubRoomDef id that fires this trigger on entry. */
  roomId?: string;
  /** Chance in [0,1] this trigger rolls an actual encounter each time its hook fires. */
  chance: number;
  /** Flavor line shown on the popup. */
  label: string;
}

/**
 * More city-location triggers get added here over time -- this is a data
 * table specifically so a new destination is a new entry, not a new `if`
 * check wired into HubScreen/AreaSelect. Deliberately excludes every other
 * hideout room.
 */
export const TRAVEL_ENCOUNTER_TRIGGERS: TravelEncounterTrigger[] = [
  { id: 'storefront-entry', source: 'hub-room', roomId: 'the-storefront', chance: 0.2, label: 'Someone by the LokPet Card Shop wants a piece of your sleeve.' },
  { id: 'head-out', source: 'run-launch', chance: 0.2, label: 'Something crosses your path on the way out.' },
];

export type TravelEncounterOpponent =
  | { kind: 'enemy'; enemyId: string }
  | { kind: 'lokpet' }; // resolved fresh via rollLokPet(rng) each encounter

export interface TravelEncounterOpponentEntry {
  opponent: TravelEncounterOpponent;
  weight: number;
}

/**
 * Curated low-tier pool: existing low-hp EnemyDef ids only (no new enemy
 * content), plus a 'lokpet' slot that always rolls a fresh wild LokPet via
 * rollLokPet(rng) -- so "what you fight" and "what you can catch" stay
 * byte-identical, and the whole existing LokPet roster surfaces here with
 * zero new authoring.
 */
export const TRAVEL_ENCOUNTER_OPPONENTS: TravelEncounterOpponentEntry[] = [
  { opponent: { kind: 'enemy', enemyId: 'nightcrawler' }, weight: 3 },
  { opponent: { kind: 'enemy', enemyId: 'watchlight' }, weight: 2 },
  { opponent: { kind: 'enemy', enemyId: 'sodium-lamp' }, weight: 2 },
  { opponent: { kind: 'enemy', enemyId: 'corner-cutter' }, weight: 2 },
  { opponent: { kind: 'enemy', enemyId: 'marquee-static' }, weight: 2 },
  { opponent: { kind: 'lokpet' }, weight: 11 },
];

export const TRAVEL_ENCOUNTER_REWARD = { cred: 6, cardCredits: 1, catchChance: 0.35 };

export const PLAYER_TRAVEL_HP = 50;
export const UNARMED_PUNCH_DAMAGE = 5;
export const BASE_CARD_THROW_DAMAGE = 8;
export const BATTLE_DECK_SLOTS = 6;

/**
 * Deliberately its own, much flatter curve than passiveCards.ts's
 * CARD_VARIANT_VALUE trade-value table (1/2/4/7/12) -- a 12x combat swing
 * from one holo pull would break the "classic version" flat/uniform mandate.
 */
export const CARD_VARIANT_DAMAGE_MULT: Record<CardVariant, number> = {
  standard: 1,
  foil: 1.1,
  neon: 1.25,
  glitch: 1.45,
  holo: 1.7,
};

export const CARD_RARITY_DAMAGE_MULT: Record<LokAssetRarity, number> = {
  common: 1,
  uncommon: 1.15,
  rare: 1.35,
  epic: 1.6,
  legendary: 1.9,
  mythic: 2.2,
  secret: 2.5,
};

export interface OwnedCardDisplay {
  name: string;
  description?: string;
  rarity: LokAssetRarity | PassiveCardRarity;
}

/** A `cardCollection` entry may be backed by either card catalog -- cards.ts's LokAssetManifest ids or passiveCards.ts's PassiveCardDef ids share one collection. */
export function describeOwnedCard(cardId: string): OwnedCardDisplay | undefined {
  const manifest = CARD_MANIFESTS_BY_ID[cardId];
  if (manifest) return { name: manifest.name, description: manifest.description, rarity: manifest.rarity };
  const passive = PASSIVE_CARDS_BY_ID[cardId];
  if (passive) return { name: passive.name, description: passive.description, rarity: passive.rarity };
  return undefined;
}

/** Flat, mildly rarity/variant-scaled throw damage -- no per-card unique effects in the "classic version". */
export function cardThrowDamage(record: OwnedCardRecord): number {
  const rarity = describeOwnedCard(record.cardId)?.rarity ?? 'common';
  return Math.round(BASE_CARD_THROW_DAMAGE * CARD_RARITY_DAMAGE_MULT[rarity] * CARD_VARIANT_DAMAGE_MULT[record.bestVariant]);
}

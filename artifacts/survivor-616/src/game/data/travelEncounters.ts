/**
 * Data for the hub-side "travel encounter" minigame. Started as the "classic
 * version" described in .agents/memory/travel-encounters.md (flat, mildly
 * rarity/variant-scaled card-throw damage, no per-card effects); the 2026-09-20
 * pass layered a first, deliberately small step of the "richer move system"
 * that doc named as the future direction -- a subject-type damage multiplier
 * plus two small on-throw effects (see CARD_SUBJECT_DAMAGE_MULT and
 * cardThrowOutcome below). Still no cross-round status effects or elemental
 * matchups -- see the memory doc for why that stays a bigger, separate pass.
 * Only ever read from `game/travelEncounter.ts` and the travel-encounter UI;
 * `engine/world.ts` never touches any of this.
 */
import type { CardVariant, OwnedCardRecord } from '@/game/types';
import type { LokAssetRarity } from '@/game/lok/types';
import { CARD_MANIFESTS_BY_ID, type LokDeckCardMetadata } from './cards';
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
  { id: 'storefront-entry', source: 'hub-room', roomId: 'the-storefront', chance: 0.2, label: 'Someone by the Neon Sleeve wants a piece of your deck.' },
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
  { opponent: { kind: 'enemy', enemyId: 'neon-leech' }, weight: 2 },
  { opponent: { kind: 'enemy', enemyId: 'pallet-wraith' }, weight: 2 },
  { opponent: { kind: 'lokpet' }, weight: 15 },
];

export const TRAVEL_ENCOUNTER_REWARD = { cred: 6, cardCredits: 1, catchChance: 0.35 };

export const PLAYER_TRAVEL_HP = 50;
export const UNARMED_PUNCH_DAMAGE = 5;
export const BASE_CARD_THROW_DAMAGE = 8;
export const BATTLE_DECK_SLOTS = 6;

/**
 * Handheld DigiScope: until bought, a thrown Battle Deck card is consumed on
 * throw (win, lose, or flee -- see `consumeThrownCard` in metaStore.tsx) the
 * same way a real thrown object would be. `CARD_SALVAGE_EARN_RUNS` is the
 * "you have to earn it" half of the gate (reusing the totalRuns counter
 * every save already tracks, rather than adding a new one); the CC cost is
 * the permanent device purchase, made in the LokPet Shop.
 * Cards are otherwise never decremented anywhere else in the game -- see
 * .agents/memory/travel-encounters.md.
 */
export const CARD_SALVAGE_EARN_RUNS = 3;
export const CARD_SALVAGE_COST = 40;

/**
 * A once-per-fight bonus attack using the player's own selected LokPet
 * companion (`meta.selectedLokPetIds[0]`) -- closes the gap between the
 * original "fight using your lock pet" request and v1, which otherwise only
 * offered card-throws/an unarmed punch. Visually it's still the player's
 * own left-side sprite acting (no third actor rendered) -- a deliberate
 * "classic version" simplification, not a bug. See travel-encounters.md.
 */
export const PET_ASSIST_DAMAGE_MULT = 1.4;

/** Minimum real-world ms between two travel encounters firing in one session -- prevents rapid-fire spam from bouncing between the storefront and other rooms. */
export const TRAVEL_ENCOUNTER_COOLDOWN_MS = 45_000;
/** Don't ambush a brand-new player before they've finished a single real run and learned the basics. */
export const TRAVEL_ENCOUNTER_MIN_TOTAL_RUNS = 1;

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
  /** Only set for cards.ts-backed cards (a LokAssetManifest) -- passiveCards.ts cards have no subject and use the 1x default below. */
  subjectType?: LokDeckCardMetadata['subjectType'];
}

/** A `cardCollection` entry may be backed by either card catalog -- cards.ts's LokAssetManifest ids or passiveCards.ts's PassiveCardDef ids share one collection. */
export function describeOwnedCard(cardId: string): OwnedCardDisplay | undefined {
  const manifest = CARD_MANIFESTS_BY_ID[cardId];
  if (manifest) {
    const subjectType = (manifest.metadata as LokDeckCardMetadata | undefined)?.subjectType;
    return { name: manifest.name, description: manifest.description, rarity: manifest.rarity, subjectType };
  }
  const passive = PASSIVE_CARDS_BY_ID[cardId];
  if (passive) return { name: passive.name, description: passive.description, rarity: passive.rarity };
  return undefined;
}

/**
 * A card's subject decides a flat multiplier on top of rarity/variant --
 * operatives (signature-weapon flavor) hit hardest, allies hold back on raw
 * damage in favor of the heal in `cardThrowOutcome`, and a discovery/beacon
 * card is a keepsake, not a fighter. `enemy`/`lokpet` stay at the rarity/
 * variant baseline; a `lokpet` card's own edge is the type-match bonus below.
 */
export const CARD_SUBJECT_DAMAGE_MULT: Record<NonNullable<LokDeckCardMetadata['subjectType']>, number> = {
  character: 1.15,
  enemy: 1,
  ally: 0.85,
  lokpet: 1,
  discovery: 0.9,
};

/** Flat heal applied to the player when an `ally` card is thrown -- calling in support, not just swinging harder. */
export const ALLY_CARD_HEAL = 6;
/** Bonus multiplier when a `lokpet` card is thrown at a `lokpet`-kind opponent -- the one type-match edge in the "classic version". */
export const LOKPET_CARD_TYPE_BONUS_MULT = 1.25;

/** Rarity/variant/subject-scaled throw damage. See the file header for how this differs from the original flat "classic version" formula. */
export function cardThrowDamage(record: OwnedCardRecord): number {
  const info = describeOwnedCard(record.cardId);
  const rarity = info?.rarity ?? 'common';
  const subjectMult = info?.subjectType ? CARD_SUBJECT_DAMAGE_MULT[info.subjectType] : 1;
  return Math.round(BASE_CARD_THROW_DAMAGE * CARD_RARITY_DAMAGE_MULT[rarity] * CARD_VARIANT_DAMAGE_MULT[record.bestVariant] * subjectMult);
}

export interface CardThrowOutcome {
  damage: number;
  /** HP restored to the player the instant the card is thrown (currently only `ally` cards). */
  heal: number;
}

/** `cardThrowDamage` plus the two small per-subject effects: a lokpet-vs-lokpet type bonus and an ally's support heal. */
export function cardThrowOutcome(record: OwnedCardRecord, opponentKind: 'enemy' | 'lokpet'): CardThrowOutcome {
  const info = describeOwnedCard(record.cardId);
  let damage = cardThrowDamage(record);
  if (info?.subjectType === 'lokpet' && opponentKind === 'lokpet') damage = Math.round(damage * LOKPET_CARD_TYPE_BONUS_MULT);
  const heal = info?.subjectType === 'ally' ? ALLY_CARD_HEAL : 0;
  return { damage, heal };
}

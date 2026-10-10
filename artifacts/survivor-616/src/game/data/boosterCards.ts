import { CHARACTERS } from '@/game/data/characters';
import type { BaseStats, BoosterCardRecord, BoosterGroup, BoosterStat } from '@/game/types';

/**
 * Booster cards are ghosted copies of a character, sold in bootleg packs and
 * boxes for Card Credits. Each one adds whole units to one stat for every run.
 * A unit is a fixed step per stat, so a +1 is always the same size for that stat.
 */

export interface BoosterStatDef {
  stat: BoosterStat;
  label: string;
  groups: BoosterGroup[];
  /** One unit's effect, applied by `applyBoosterToPlayerStats` or `boosterMultipliers`. */
  unit: number;
  /** How a unit is applied: additive for raw amounts, multiplicative for rates. */
  kind: 'add' | 'mult';
}

export const BOOSTER_STATS: BoosterStatDef[] = [
  { stat: 'maxHp', label: 'Max HP', groups: ['character', 'operatives', 'crew'], unit: 4, kind: 'add' },
  { stat: 'speed', label: 'Speed', groups: ['character', 'operatives', 'crew'], unit: 0.01, kind: 'mult' },
  { stat: 'power', label: 'Power', groups: ['character', 'operatives', 'crew'], unit: 0.01, kind: 'mult' },
  { stat: 'area', label: 'Area', groups: ['character', 'operatives', 'crew'], unit: 0.01, kind: 'mult' },
  { stat: 'haste', label: 'Cooldown', groups: ['character', 'operatives', 'crew'], unit: 0.01, kind: 'mult' },
  { stat: 'magnet', label: 'Pickup reach', groups: ['character', 'operatives', 'crew'], unit: 0.02, kind: 'mult' },
  { stat: 'armor', label: 'Armor', groups: ['character', 'operatives', 'crew'], unit: 0.005, kind: 'add' },
  { stat: 'lokPetDamage', label: 'LokPet damage', groups: ['lokpets'], unit: 0.01, kind: 'mult' },
  { stat: 'lokPetHaste', label: 'LokPet speed', groups: ['lokpets'], unit: 0.01, kind: 'mult' },
  { stat: 'enemyHp', label: 'Enemy HP', groups: ['enemies'], unit: 0.01, kind: 'mult' },
];

export const BOOSTER_STAT_BY_KEY = Object.fromEntries(BOOSTER_STATS.map((def) => [def.stat, def])) as Record<BoosterStat, BoosterStatDef>;

export const BOOSTER_GROUPS: BoosterGroup[] = ['character', 'operatives', 'crew', 'lokpets', 'enemies'];

export const BOOSTER_GROUP_LABEL: Record<BoosterGroup, string> = {
  character: 'Character',
  operatives: 'Operatives',
  crew: 'Crew',
  lokpets: 'LokPets',
  enemies: 'Enemies',
};

export interface BoosterProductDef {
  id: string;
  name: string;
  blurb: string;
  cards: number;
  cost: number;
}

/** Parody bootleg stock. The copy is deliberately a knock-off of retail packaging. */
export const BOOSTER_PRODUCTS: BoosterProductDef[] = [
  { id: 'bootleg-booster-pack', name: 'Totally Real Booster Pack', blurb: 'Three ghosted copies. Each one boosts a random stat. Results may vary.', cards: 3, cost: 40 },
  { id: 'bulk-hype-booster-box', name: 'Bulk Hype Booster Box', blurb: 'Twelve ghosted copies in one box. Shake well. Do not expect a refund.', cards: 12, cost: 150 },
];
export const BOOSTER_PRODUCTS_BY_ID = Object.fromEntries(BOOSTER_PRODUCTS.map((product) => [product.id, product])) as Record<string, BoosterProductDef>;

/** Units per card: most roll 1, some 2, a rare few 3. Always 1 or more. */
export function rollBoosterUnits(rng: () => number): number {
  const roll = rng();
  return roll < 0.08 ? 3 : roll < 0.3 ? 2 : 1;
}

/** One random ghosted copy: a group, a stat that belongs to it, and 1+ units. */
export function rollBoosterCard(rng: () => number, productId: string, now: number, index: number): BoosterCardRecord {
  const group = BOOSTER_GROUPS[Math.floor(rng() * BOOSTER_GROUPS.length)]!;
  const stats = BOOSTER_STATS.filter((def) => def.groups.includes(group));
  const stat = stats[Math.floor(rng() * stats.length)]!.stat;
  const character = CHARACTERS[Math.floor(rng() * CHARACTERS.length)]!;
  return {
    id: `booster-${now.toString(36)}-${index}-${Math.floor(rng() * 1e9).toString(36)}`,
    group,
    stat,
    units: rollBoosterUnits(rng),
    characterId: character.id,
    productId,
    acquiredAt: now,
  };
}

/** Sums owned units per stat. Every consumer reads boosts through this one function. */
export function boosterUnits(cards: BoosterCardRecord[]): Partial<Record<BoosterStat, number>> {
  const totals: Partial<Record<BoosterStat, number>> = {};
  for (const card of cards) totals[card.stat] = (totals[card.stat] ?? 0) + card.units;
  return totals;
}

/** Applies player-facing boosts (character, operatives, crew) to base stats. */
export function applyBoosterToPlayerStats(stats: BaseStats, units: Partial<Record<BoosterStat, number>>): BaseStats {
  const next = { ...stats };
  for (const def of BOOSTER_STATS) {
    const amount = units[def.stat] ?? 0;
    if (!amount || !def.groups.some((group) => group === 'character' || group === 'operatives' || group === 'crew')) continue;
    const key = def.stat as keyof BaseStats;
    if (def.kind === 'add') next[key] = next[key] + def.unit * amount;
    else if (def.stat === 'haste') next.haste = Math.max(0.2, next.haste * (1 - def.unit * amount));
    else next[key] = next[key] * (1 + def.unit * amount);
  }
  next.armor = Math.min(0.6, next.armor);
  return next;
}

/** Multipliers for LokPet damage, LokPet cooldown and enemy HP, read by the run setup. */
export function boosterMultipliers(units: Partial<Record<BoosterStat, number>>) {
  return {
    lokPetDamageMult: 1 + BOOSTER_STAT_BY_KEY.lokPetDamage.unit * (units.lokPetDamage ?? 0),
    lokPetHasteMult: Math.max(0.4, 1 - BOOSTER_STAT_BY_KEY.lokPetHaste.unit * (units.lokPetHaste ?? 0)),
    enemyHpMult: 1 + BOOSTER_STAT_BY_KEY.enemyHp.unit * (units.enemyHp ?? 0),
  };
}

export function describeBooster(card: Pick<BoosterCardRecord, 'stat' | 'units'>) {
  const def = BOOSTER_STAT_BY_KEY[card.stat];
  return `+${card.units} ${def.label}`;
}

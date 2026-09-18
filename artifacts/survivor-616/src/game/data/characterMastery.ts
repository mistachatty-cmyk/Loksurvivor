import type { BaseStats, VendorEffect } from '@/game/types';

/**
 * Permanent per-character mastery bonus, applied in `effectiveStats()`
 * scaled by the character's own lifetime mastery level (see
 * `characterLevelProgress` in `state/metaStore.tsx`). Shared across every
 * character rather than hand-authored per character -- reuses the exact
 * `{ stat, add?, mult?, cap? }` shape `VENDOR_CATALOG` already stacks in
 * `effectiveStats()`, just with "stacks" being the character's level instead
 * of a purchased item count.
 */
export const CHARACTER_MASTERY_STAT_EFFECTS: VendorEffect[] = [
  { kind: 'stat', stat: 'power', add: 0.01, cap: 0.5 },
  { kind: 'stat', stat: 'maxHp', add: 3, cap: 150 },
];

export interface CharacterRankTier {
  minLevel: number;
  title: string;
}

/** Cosmetic rank titles shown alongside a character's mastery level. */
export const CHARACTER_RANK_TIERS: CharacterRankTier[] = [
  { minLevel: 1, title: 'Rookie' },
  { minLevel: 5, title: 'Veteran' },
  { minLevel: 10, title: 'Elite' },
  { minLevel: 20, title: 'Legend' },
  { minLevel: 35, title: 'Mythic' },
];

export function characterRankTitle(level: number): string {
  let title = CHARACTER_RANK_TIERS[0]!.title;
  for (const tier of CHARACTER_RANK_TIERS) {
    if (level >= tier.minLevel) title = tier.title;
  }
  return title;
}

/**
 * The current mastery bonus for a single stat, for display purposes --
 * mirrors the additive-with-cap arithmetic `effectiveStats()` applies from
 * `CHARACTER_MASTERY_STAT_EFFECTS`, without needing a full `CharacterDef`.
 */
export function characterMasteryStatBonus(level: number, stat: keyof BaseStats): number {
  const stacks = Math.max(0, level - 1);
  if (!stacks) return 0;
  let bonus = 0;
  for (const effect of CHARACTER_MASTERY_STAT_EFFECTS) {
    if (effect.kind !== 'stat' || effect.stat !== stat || !effect.add) continue;
    bonus = effect.cap !== undefined ? Math.min(effect.cap, effect.add * stacks) : effect.add * stacks;
  }
  return bonus;
}

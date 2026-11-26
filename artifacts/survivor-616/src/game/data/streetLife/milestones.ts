/**
 * Block milestones: every few new city blocks you cross, a small bonus to one stat.
 * Pure data. The step sizes are the single place to tune how strong a milestone feels.
 */

export type MilestoneStat = 'power' | 'area' | 'speed' | 'magnet' | 'maxHp' | 'armor' | 'crit';

export interface MilestoneStatDef {
  stat: MilestoneStat;
  label: string;
  /** Added to the stat on each milestone. Armor and crit are fractions, so 0.005 is half a percent. */
  add: number;
}

export const MILESTONE_STATS: MilestoneStatDef[] = [
  { stat: 'power', label: 'POWER', add: 0.02 },
  { stat: 'area', label: 'REACH', add: 0.02 },
  { stat: 'speed', label: 'SPEED', add: 2 },
  { stat: 'magnet', label: 'PICKUP RANGE', add: 3 },
  { stat: 'maxHp', label: 'MAX HEALTH', add: 4 },
  { stat: 'armor', label: 'ARMOR', add: 0.005 },
  { stat: 'crit', label: 'CRIT', add: 0.005 },
];

export interface BlockMilestoneDef {
  id: string;
  /** Fires on every Nth newly entered block. */
  every: number;
  /** How many times the stat step it is worth. */
  stepMult: number;
  /** Tokens thrown out in a mini burst, if any. */
  tokens?: number;
}

/** Checked from the largest `every` down, so a big milestone replaces a small one on the same block. */
export const BLOCK_MILESTONES: BlockMilestoneDef[] = [
  { id: 'grand', every: 25, stepMult: 3, tokens: 6 },
  { id: 'minor', every: 5, stepMult: 1 },
];

export function milestoneForBlockCount(count: number): BlockMilestoneDef | null {
  if (count <= 0) return null;
  const sorted = [...BLOCK_MILESTONES].sort((a, b) => b.every - a.every);
  return sorted.find((m) => count % m.every === 0) ?? null;
}

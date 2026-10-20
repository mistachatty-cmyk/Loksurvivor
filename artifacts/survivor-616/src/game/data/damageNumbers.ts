/**
 * Damage number styles and the damage tiers behind them.
 *
 * `classic` is the original popup: one short-lived yellow number, red for a
 * crit. `cascade` is the second style: numbers live longer, pile up above the
 * enemy they hit instead of overlapping, and change color and size as the hit
 * gets bigger. More styles are meant to slot in as extra `DamageNumberStyle`
 * values; see docs/DAMAGE_NUMBERS.md for the roadmap.
 *
 * Pure data and helpers -- no engine or canvas imports -- so the simulation,
 * the renderer and the tests all share one table.
 */
export type DamageNumberStyle = 'classic' | 'cascade';

export const DAMAGE_NUMBER_STYLES: ReadonlyArray<{ id: DamageNumberStyle; label: string; description: string }> = [
  { id: 'classic', label: 'Classic', description: 'The original short yellow numbers.' },
  { id: 'cascade', label: 'Cascade', description: 'Longer-lived numbers that stack up, grow and change color with bigger hits.' },
];

export function isDamageNumberStyle(value: unknown): value is DamageNumberStyle {
  return value === 'classic' || value === 'cascade';
}

export interface DamageTier {
  /** Smallest damage that reaches this tier. */
  min: number;
  color: string;
  /** Font size in canvas pixels. */
  size: number;
}

/** Lowest to highest. Index in this array is the tier number. */
export const DAMAGE_TIERS: readonly DamageTier[] = [
  { min: 0, color: '#e2e8f0', size: 12 },
  { min: 8, color: '#fde047', size: 13 },
  { min: 20, color: '#fb923c', size: 14 },
  { min: 45, color: '#f87171', size: 16 },
  { min: 90, color: '#f472b6', size: 18 },
  { min: 180, color: '#c084fc', size: 20 },
  { min: 400, color: '#22d3ee', size: 22 },
  { min: 1000, color: '#fffbeb', size: 25 },
];

/** First tier whose glow is drawn. Lower tiers stay flat so a swarm of small hits stays cheap. */
export const GLOW_FROM_TIER = 4;

/** Tier index for a hit. A crit counts as one tier higher than its raw damage. */
export function damageTier(amount: number, crit = false): number {
  let tier = 0;
  for (let i = 0; i < DAMAGE_TIERS.length; i += 1) {
    if (amount >= DAMAGE_TIERS[i]!.min) tier = i;
  }
  return crit ? Math.min(DAMAGE_TIERS.length - 1, tier + 1) : tier;
}

/** How long a cascade number lasts. Bigger hits linger a little longer. */
export function cascadeLifeMs(tier: number): number {
  return 1500 + tier * 90;
}

/** Cascade numbers kept per enemy; older ones are dropped so one boss can't fill the screen. */
export const CASCADE_STACK_PER_ENEMY = 6;
/** Pixels an older number is pushed up when a new one lands on the same enemy. */
export const CASCADE_STACK_STEP = 13;

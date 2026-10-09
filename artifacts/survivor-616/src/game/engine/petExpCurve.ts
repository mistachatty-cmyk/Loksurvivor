/**
 * The pet level curve and XP application, split out so both the arena engine
 * (lokPetBattle.ts) and the growth rules (petGrowth.ts) can use it without
 * importing each other.
 */

/** Experience required for next level. Unchanged: existing levels must not move. */
export function getExpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.4));
}

/** Multiplies every pet XP source (battle, run, travel, treat). Thresholds are untouched. */
export const PET_EXP_SCALE = 10;

export const scalePetExp = (base: number): number => Math.max(0, Math.round(base * PET_EXP_SCALE));

/** Starter partners cap at 99, every other pet at 50 (Limit Break raises these later). */
export const petMaxLevel = (starter?: boolean): number => (starter === true ? 99 : 50);

/**
 * Bounded run-power scaling (docs/lokpet-rpg-and-digi-tower-plan.md 3.2):
 * leveling barely mattered in a real run before this, since spawnLokPet
 * reads roll.stats verbatim with no level term. Non-starters cap at +45%
 * by level 50; starters taper on to +70% by 99. The 0-50 term is the plan
 * doc's own formula; the starter 50-99 tail is this feature's own linear
 * interpretation landing exactly on +70% at 99 (the doc only states that
 * target in prose, it doesn't formalize the tail).
 */
export function runPowerScale(level: number, starter?: boolean): number {
  const capLevel = starter ? 99 : 50;
  const clamped = Math.min(Math.max(1, level), capLevel);
  const base = 1 + Math.min(clamped, 50) * 0.009;
  return starter ? base + Math.max(0, clamped - 50) * (0.25 / 49) : base;
}

export interface PetExpResult {
  level: number;
  exp: number;
  levelsGained: number;
  capped: boolean;
}

/** Adds XP, rolling the remainder into the next level. At the cap the bar sits full, never overflowing. */
export function applyPetExp(pet: { level?: number; exp?: number; starter?: boolean }, gained: number): PetExpResult {
  const max = petMaxLevel(pet.starter);
  let level = Math.max(1, Math.min(max, Math.floor(pet.level ?? 1)));
  let exp = Math.max(0, Math.floor(pet.exp ?? 0)) + Math.max(0, Math.floor(gained));
  const start = level;
  while (level < max && exp >= getExpForLevel(level)) {
    exp -= getExpForLevel(level);
    level += 1;
  }
  const capped = level >= max;
  if (capped) exp = Math.min(exp, Math.max(0, getExpForLevel(level) - 1));
  return { level, exp, levelsGained: level - start, capped };
}

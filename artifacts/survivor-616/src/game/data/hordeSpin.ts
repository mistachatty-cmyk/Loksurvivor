import type { HordeSpinTierDef, HordeSpinTierId } from '@/game/types';

/**
 * HordeSpin: an optional run modifier (see `RunModifiers.hordeSpinEnabled`).
 * Every `HORDE_SPIN_INTERVAL_MS` the run pauses for a wheel spin, lands on a
 * weighted tier, then spawns a scaled horde and pays out a cred reward (plus
 * a guaranteed LokPet on the rarest tier) once the horde is cleared. All
 * tuning lives here; the state machine is `updateWheelSpin` in `engine/world.ts`.
 */
export const HORDE_SPIN_INTERVAL_MS = 45_000;
export const HORDE_SPIN_SPIN_MS = 2_600;
export const HORDE_SPIN_RESULT_MS = 1_800;
/** Base cluster size a tier's `spawnMultiplier` scales; 5x5 and 666 use this to build "groups". */
export const HORDE_SPIN_BASE_CLUSTER = 5;
/** How long the horde stays "active" (still spawning/being fought) per multiplier step. */
export const HORDE_SPIN_ACTIVE_MS_PER_STEP = 2_200;

export const HORDE_SPIN_TIERS: HordeSpinTierDef[] = [
  { id: '1x', label: '1x', weight: 38, spawnMultiplier: 1, hpMult: 1, rewardCred: 20, celebration: 'mild' },
  { id: '2x', label: '2x', weight: 27, spawnMultiplier: 2, hpMult: 1.1, rewardCred: 35, celebration: 'mild' },
  { id: '3x', label: '3x', weight: 17, spawnMultiplier: 3, hpMult: 1.2, rewardCred: 55, celebration: 'big' },
  { id: '4x', label: '4x', weight: 10, spawnMultiplier: 4, hpMult: 1.3, rewardCred: 80, celebration: 'big' },
  { id: '5x5', label: '5x5', weight: 6, spawnMultiplier: 5, hpMult: 1.35, rewardCred: 150, rare: true, celebration: 'legendary' },
  { id: '666', label: '666', weight: 2, spawnMultiplier: 6, hpMult: 1.5, rewardCred: 300, rare: true, colorFluctuation: true, grantsPet: true, celebration: 'legendary' },
];

export const HORDE_SPIN_TIERS_BY_ID: Record<HordeSpinTierId, HordeSpinTierDef> = Object.fromEntries(
  HORDE_SPIN_TIERS.map((tier) => [tier.id, tier]),
) as Record<HordeSpinTierId, HordeSpinTierDef>;

export function getHordeSpinTier(id: HordeSpinTierId): HordeSpinTierDef {
  return HORDE_SPIN_TIERS_BY_ID[id];
}

/** Weighted pick. `rng` must return a value in [0, 1) -- pass `w.rng` for a seeded, replayable roll. */
export function pickHordeSpinTier(rng: () => number): HordeSpinTierDef {
  const totalWeight = HORDE_SPIN_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = rng() * totalWeight;
  for (const tier of HORDE_SPIN_TIERS) {
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return HORDE_SPIN_TIERS[0]!;
}

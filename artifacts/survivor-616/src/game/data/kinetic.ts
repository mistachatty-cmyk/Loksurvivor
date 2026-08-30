/**
 * The Kinetic Bender line.
 *
 * These are the specials that change what a run *is* rather than what its
 * numbers are: stopping the street dead, or throwing a dumpster through it.
 * They are deliberately kept apart from the level-up pool and the
 * Quartermaster's stat shelves -- you go to the Kinetic Bender room, pick a
 * kit up, and carry exactly one into a run.
 *
 * Like every other locked surface in the game, a kit's `unlock` is read by
 * the shared evaluator in `state/unlocks.ts`, so the development all-unlocks
 * switch reaches these without rewriting progression.
 */

import { isUnlocked } from '@/game/state/unlocks';
import type { KineticKitDef, KineticKitId, MetaState } from '@/game/types';

export const KINETIC_KITS: KineticKitDef[] = [
  {
    id: 'kinetic-throw',
    name: 'Kinetic Throw',
    tagline: 'Hurl the street at them',
    description:
      'Grabs the nearest loose prop — dumpster, wreck, crate — and throws it along your facing. Everything it passes through takes the hit, and it keeps its momentum after.',
    flavor: 'Sable rigged a harness out of speaker magnets. It picks up a dumpster like it is nothing.',
    unlock: { kind: 'discovery', discoveryId: 'floodwall-mark' },
    cost: 900,
    currency: 'cred',
    cooldownMs: 6500,
    durationMs: 0,
    accent: '#ffb347',
  },
  {
    id: 'time-stop',
    name: 'Time Stop',
    tagline: 'The street holds still',
    description:
      'Stops the block dead for four seconds. Enemies and everything they have thrown hang in the air; you keep moving, keep swinging, and props still shove where you put them.',
    flavor: 'The endgame of the Bender line. Nobody in the Sanctum agrees on what it costs you.',
    // Endgame: this is the last thing on the shelf, and it is priced in the
    // rare currency on purpose.
    unlock: { kind: 'kills', count: 2500 },
    cost: 12,
    currency: 'skeletonKeys',
    cooldownMs: 34_000,
    durationMs: 4000,
    accent: '#8be9ff',
  },
];

export const KINETIC_KITS_BY_ID: Record<string, KineticKitDef> = Object.fromEntries(
  KINETIC_KITS.map((kit) => [kit.id, kit]),
);

export function getKineticKit(id: KineticKitId | null | undefined): KineticKitDef | null {
  if (!id) return null;
  return KINETIC_KITS_BY_ID[id] ?? null;
}

/** Kits whose unlock rule the player has satisfied -- purchasable or owned. */
export function availableKineticKits(meta: MetaState): KineticKitDef[] {
  return KINETIC_KITS.filter((kit) => isUnlocked(kit.unlock, meta));
}

/** The kit a run should carry: equipped, owned, and actually unlocked. */
export function equippedKineticKit(meta: MetaState): KineticKitDef | null {
  const kit = getKineticKit(meta.equippedKineticKitId);
  if (!kit) return null;
  if (!meta.ownedKineticKitIds.includes(kit.id)) return null;
  return isUnlocked(kit.unlock, meta) ? kit : null;
}

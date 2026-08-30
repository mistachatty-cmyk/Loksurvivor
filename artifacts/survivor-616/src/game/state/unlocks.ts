/**
 * The single unlock evaluator.
 *
 * It lives in its own module, apart from `metaStore`, only so that content
 * modules (`data/vendor.ts` and friends) can reach it without importing the
 * store that already imports them. `metaStore` re-exports it, so every
 * existing caller keeps its import site and there is still exactly one
 * implementation of what "unlocked" means.
 */

import type { MetaState, UnlockRule } from '@/game/types';

export function isUnlocked(rule: UnlockRule, meta: MetaState): boolean {
  if (meta.devModeAllUnlocks) return true;

  switch (rule.kind) {
    case 'default':
      return true;
    case 'rescue':
      return meta.rescuedAllyIds.includes(rule.allyId);
    case 'clearArea':
      return meta.clearedAreaIds.includes(rule.areaId);
    case 'discovery':
      return meta.discoveryIds.includes(rule.discoveryId);
    case 'kills':
      return meta.totalKills >= rule.count;
    default:
      return false;
  }
}

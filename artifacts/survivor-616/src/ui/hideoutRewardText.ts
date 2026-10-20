import type { MessageKey } from '@/lib/i18n';
import type { SmallReward } from '@/game/engine/hideoutRewards';

type Translate = (key: MessageKey, vars?: Record<string, unknown>) => string;

const ITEM_KEYS: Array<[keyof SmallReward, MessageKey]> = [
  ['cred', 'hideout.life.item.cred'],
  ['cardCredits', 'hideout.life.item.cardCredits'],
  ['lokPetTreats', 'hideout.life.item.lokPetTreats'],
  ['petElixirs', 'hideout.life.item.petElixirs'],
  ['skeletonKeys', 'hideout.life.item.skeletonKeys'],
  ['petExp', 'hideout.life.item.petExp'],
];

/** "5 cred, 1 CC" for what a hideout grant actually paid; empty when nothing was paid. */
export function describeReward(applied: SmallReward, t: Translate): string {
  const parts: string[] = [];
  for (const [field, key] of ITEM_KEYS) {
    const amount = applied[field];
    if (typeof amount === 'number' && amount > 0) parts.push(t(key, { n: amount }));
  }
  if (applied.bond) parts.push(t('hideout.life.item.bond'));
  return parts.join(', ');
}

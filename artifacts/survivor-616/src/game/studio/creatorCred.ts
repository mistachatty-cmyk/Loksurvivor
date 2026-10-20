import type { MetaState } from '@/game/types';

/** Account grants are cumulative. The save records how much it has already used. */
export function applyCreatorCredTotal<T extends Pick<MetaState, 'cred' | 'creatorCredApplied'>>(meta: T, total: number): T {
  const applied = Math.max(0, Math.floor(meta.creatorCredApplied ?? 0));
  const earned = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  if (earned <= applied) return meta;
  return { ...meta, cred: meta.cred + earned - applied, creatorCredApplied: earned };
}

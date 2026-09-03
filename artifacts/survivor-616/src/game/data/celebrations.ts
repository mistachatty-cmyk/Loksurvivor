import type { CelebrationDef, CelebrationStyle } from '@/game/types';

export const CELEBRATIONS: CelebrationDef[] = [
  { id: 'paper-stars', name: 'Paper Stars', description: 'Small hand-cut stars burst from a landed reward.', cost: 0, tier: 'standard', style: 'paper-stars' },
  { id: 'coin-burst', name: 'Coin Burst', description: 'Warm token flashes and a little lucky shine.', cost: 2, tier: 'uncommon', style: 'coin-burst' },
  { id: 'signal-hearts', name: 'Signal Hearts', description: 'Tiny neon hearts confirm a beautiful pull.', cost: 2, tier: 'uncommon', style: 'signal-hearts' },
  { id: 'confetti-rain', name: 'Confetti Rain', description: 'A sharp little shower of color without covering the arena.', cost: 3, tier: 'rare', style: 'confetti-rain' },
  { id: 'moth-swarm', name: 'Moth Swarm', description: 'A drifting constellation of gold-winged static.', cost: 4, tier: 'legendary', style: 'moth-swarm' },
];
export const CELEBRATIONS_BY_ID: Record<string, CelebrationDef> = Object.fromEntries(CELEBRATIONS.map((entry) => [entry.id, entry]));
export const DEFAULT_CELEBRATION_ID = 'paper-stars';
export function getCelebrationStyle(id: string): CelebrationStyle { return CELEBRATIONS_BY_ID[id]?.style ?? 'paper-stars'; }

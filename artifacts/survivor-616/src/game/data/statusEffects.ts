import type { StatusEffectDef } from '@/game/types';

/** The single source of truth for combat status-effect behaviour and copy. */
export const STATUS_EFFECTS: StatusEffectDef[] = [
  {
    id: 'freeze',
    name: 'Freeze',
    description: 'Locks an enemy in place. Reapplying refreshes the duration and adds a stack.',
    color: '#8be9ff',
    durationMs: 2200,
    maxStacks: 3,
    speedMultiplier: 0,
  },
  {
    id: 'burning',
    name: 'Burning',
    description: 'A hot stack that keeps dealing damage until it gutters out.',
    color: '#ff6b35',
    durationMs: 2600,
    maxStacks: 3,
    speedMultiplier: 1,
  },
  {
    id: 'slow',
    name: 'Slow',
    description: 'Makes movement drag like wet pavement. Reapplying refreshes it.',
    color: '#a78bfa',
    durationMs: 3000,
    maxStacks: 2,
    speedMultiplier: 0.52,
  },
  {
    id: 'acid',
    name: 'Acid',
    description: 'Corrodes armor and ticks for damage while the stain remains.',
    color: '#b8ff5c',
    durationMs: 3200,
    maxStacks: 3,
    speedMultiplier: 0.82,
  },
];

export const STATUS_EFFECTS_BY_ID: Record<string, StatusEffectDef> =
  Object.fromEntries(STATUS_EFFECTS.map((effect) => [effect.id, effect]));

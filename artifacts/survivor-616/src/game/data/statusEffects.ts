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
];

export const STATUS_EFFECTS_BY_ID: Record<string, StatusEffectDef> =
  Object.fromEntries(STATUS_EFFECTS.map((effect) => [effect.id, effect]));

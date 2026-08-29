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
  {
    id: 'wet',
    name: 'Wet',
    description: 'Soaked from a broken hydrant. Drags movement slightly and conducts electricity.',
    color: '#3fb6ff',
    durationMs: 650,
    maxStacks: 1,
    speedMultiplier: 0.85,
  },
  {
    id: 'chilled',
    name: 'Chilled',
    description: 'Coolant underfoot bites harder than wet pavement.',
    color: '#bfe9ff',
    durationMs: 750,
    maxStacks: 1,
    speedMultiplier: 0.4,
  },
  {
    id: 'irradiated',
    name: 'Irradiated',
    description: 'Chemical runoff empowers whatever stands in it.',
    color: '#b6ff2e',
    durationMs: 700,
    maxStacks: 1,
    speedMultiplier: 1.3,
    damageMultiplier: 1.25,
  },
];

export const STATUS_EFFECTS_BY_ID: Record<string, StatusEffectDef> =
  Object.fromEntries(STATUS_EFFECTS.map((effect) => [effect.id, effect]));

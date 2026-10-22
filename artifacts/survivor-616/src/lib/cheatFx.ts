import type { CheatFx } from '@/game/data/cheatCodes';

/** Tiny event bus: the Cheat bar fires an effect, `CheatFxLayer` (mounted once in App) plays it. */
const EVENT = 'survivor616:cheat-fx';

export function fireCheatFx(fx: CheatFx): void {
  try { window.dispatchEvent(new CustomEvent<CheatFx>(EVENT, { detail: fx })); } catch { /* no window */ }
}

export const CHEAT_FX_EVENT = EVENT;
export const CHEAT_FX_MS: Record<CheatFx, number> = { confetti: 3600, disco: 7000, pulse616: 2600 };

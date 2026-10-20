/**
 * Key adapters for the characters whose skills are pointer-shaped in the real game. The game drives them
 * with a drag-select box (Zero Day's freeze-then-throw) or a freehand stroke (Artiste's draw-dodge); the
 * overlay has no pointer to spare (it is keyboard-played over a live page), so each gets ONE key, F:
 *  - Zero Day: F fires the freeze cone; pressing F again throws every frozen enemy at the nearest unfrozen one.
 *  - Artiste: F draws a straight line ahead of you (in your move direction) and dashes through it.
 * Everyone else needs nothing: Storm Chaser's cloud cycles by itself, the dash skills ride the dash key, and
 * every other skill is the ultimate on Space. Sector Command (the RTS mode) is not part of the overlay.
 */
import type { CharacterDef } from '@/game/types';
import {
  armArtisteDraw,
  beginArtisteDraw,
  cancelArtisteDraw,
  castFreezeCone,
  commitArtisteDraw,
  endFreezeSelectionDrag,
  throwSelectedFrozenEnemies,
  updateFreezeSelection,
  type World,
} from '@/game/engine/world';

export type AbilityKind = 'freeze' | 'draw';

export interface OverlayAbility {
  kind: AbilityKind;
  /** `overlay.ability.<kind>` message key suffix. */
  labelKey: AbilityKind;
}

export function abilityFor(character: CharacterDef): OverlayAbility | null {
  if (character.freezeThrow) return { kind: 'freeze', labelKey: 'freeze' };
  if (character.artisteDraw) return { kind: 'draw', labelKey: 'draw' };
  return null;
}

const FAR = 1e9;

function nearestUnfrozen(w: World): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const e of w.enemies) {
    if (e.dying || w.now < e.frozenUntil) continue;
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  return best;
}

/** Fire the character's key skill. Returns true when something happened. `aim` is the current move direction. */
export function castAbility(w: World, aim: { x: number; y: number }): boolean {
  const p = w.player;
  const len = Math.hypot(aim.x, aim.y);
  const dir = len > 0.1 ? { x: aim.x / len, y: aim.y / len } : { x: p.facing > 0 ? 1 : -1, y: 0 };

  if (w.freezeThrow && w.character.freezeThrow) {
    const anyFrozen = w.enemies.some((e) => !e.dying && w.now < e.frozenUntil);
    if (!anyFrozen) return castFreezeCone(w) > 0;
    updateFreezeSelection(w, -FAR, -FAR, FAR, FAR);
    endFreezeSelectionDrag(w);
    const target = nearestUnfrozen(w) ?? { x: p.x + dir.x * 320, y: p.y + dir.y * 320 };
    return throwSelectedFrozenEnemies(w, target.x, target.y) > 0;
  }

  if (w.artisteDraw && w.character.artisteDraw) {
    if (!armArtisteDraw(w)) return false;
    const reach = w.character.artisteDraw.maxPathLength;
    if (!beginArtisteDraw(w, p.x + dir.x * reach, p.y + dir.y * reach)) {
      cancelArtisteDraw(w);
      return false;
    }
    return commitArtisteDraw(w);
  }
  return false;
}

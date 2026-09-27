/**
 * LokSurvivorArena: match setup for the shared-arena "most kills wins" mode.
 * Deliberately thin -- it composes the same `createWorld`/`addGuestPlayer`
 * the campaign uses, rather than a parallel world-construction path. See
 * `.agents/memory/loksurvivor-arena.md` for the scope this mode intentionally
 * cuts (no per-guest leveling/weapon evolution -- see `updateGuest` in
 * `engine/world.ts`).
 */
import { addGuestPlayer, createWorld, type World } from '@/game/engine/world';
import type { AreaDef, CharacterDef } from '@/game/types';

export const ARENA_MAX_PLAYERS = 4;
export const ARENA_MIN_PLAYERS = 2;

/** One local seat's character pick, in join order: index 0 is always the host. */
export interface ArenaSeat {
  id: string;
  character: CharacterDef;
}

/** Spawns seats in a small ring around the arena center so nobody starts stacked on the host. */
function spawnOffset(index: number, total: number): { x: number; y: number } {
  if (index === 0) return { x: 0, y: 0 };
  const angle = (index / total) * Math.PI * 2;
  const radius = 90;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function createArenaWorld(area: AreaDef, seats: ArenaSeat[], seed?: number): World {
  if (seats.length < ARENA_MIN_PLAYERS || seats.length > ARENA_MAX_PLAYERS) {
    throw new Error(`LokSurvivorArena: expected ${ARENA_MIN_PLAYERS}-${ARENA_MAX_PLAYERS} seats, got ${seats.length}`);
  }
  const host = seats[0]!;
  const world = createWorld(area, host.character, host.character.stats, seed);
  world.arenaMode = true;
  for (let i = 1; i < seats.length; i += 1) {
    const seat = seats[i]!;
    const offset = spawnOffset(i, seats.length);
    addGuestPlayer(world, seat.id, seat.character, offset.x, offset.y);
  }
  return world;
}

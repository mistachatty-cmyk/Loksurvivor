/**
 * LokSurvivorArena: derives the live "most kills" standings from a `World`.
 * Pure read model, same spirit as `hudSnapshot` in engine/world.ts -- never
 * mutates the world, safe to call every rendered frame.
 */
import type { World } from '@/game/engine/world';

export interface ArenaStanding {
  id: string;
  name: string;
  kills: number;
  isHost: boolean;
}

/** `host` labels the scoreboard row for `w.player` -- the host's kills live in `w.kills`, not `w.guestKills`. */
export function arenaStandings(w: World, hostName: string): ArenaStanding[] {
  const rows: ArenaStanding[] = [
    { id: 'host', name: hostName, kills: w.kills, isHost: true },
    ...w.guests.map((guest) => ({
      id: guest.id,
      name: guest.character.name,
      kills: w.guestKills[guest.id] ?? 0,
      isHost: false,
    })),
  ];
  return rows.sort((a, b) => b.kills - a.kills);
}

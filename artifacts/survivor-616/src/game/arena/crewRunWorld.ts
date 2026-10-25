/**
 * Crew run worlds: building the shared starting world from a roster, and keeping the world's helpers in step
 * with who is in the room as people drop in and out. Pure engine calls, no network or screen code.
 */
import { CHARACTERS, CHARACTERS_BY_ID } from '@/game/data/characters';
import { AREAS } from '@/game/data/areas';
import { addGuestPlayer, createWorld, removeGuestPlayer, type World } from '@/game/engine/world';
import type { AreaDef, CharacterDef } from '@/game/types';
import type { RunSeat } from '@/lib/social/crewRun';
import type { CrewRunRoster } from './crewRunNet';

export const characterFor = (id: string): CharacterDef => CHARACTERS_BY_ID[id] ?? CHARACTERS[0]!;

/** Makes the world's guests match the roster: adds who dropped in, removes who dropped out. Returns the names of both. */
export function reconcileGuests(world: World, seats: readonly RunSeat[]): { joined: RunSeat[]; left: string[] } {
  const wanted = seats.filter((seat) => seat.id !== 'host');
  const joined: RunSeat[] = [];
  for (const seat of wanted) {
    if (world.guests.some((guest) => guest.id === seat.id)) continue;
    const angle = (world.guests.length + 1) * 1.9;
    addGuestPlayer(world, seat.id, characterFor(seat.characterId), world.player.x + Math.cos(angle) * 70, world.player.y + Math.sin(angle) * 70);
    joined.push(seat);
  }
  const left: string[] = [];
  for (const guest of [...world.guests]) {
    if (!wanted.some((seat) => seat.id === guest.id)) { removeGuestPlayer(world, guest.id); left.push(guest.id); }
  }
  return { joined, left };
}

export function buildCrewRunWorld(roster: CrewRunRoster): { world: World; area: AreaDef } | null {
  const area = AREAS.find((a) => a.id === roster.areaId);
  const host = roster.seats[0];
  if (!area || !host) return null;
  const character = characterFor(host.characterId);
  const world = createWorld(area, character, character.stats, roster.seed);
  world.arenaMode = true;
  reconcileGuests(world, roster.seats);
  return { world, area };
}


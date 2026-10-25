/**
 * Crew runs: the rules for an open room that crewmates can drop into and out of. Kept apart from the
 * screens so they can be tested. The host is always seat `host`; everyone else gets `p2`, `p3`, `p4`.
 */
import type { LokCrewState, LokPresence } from '@workspace/lok-client';

export const CREW_RUN_MAX = 4;
export const GUEST_SEATS = ['p2', 'p3', 'p4'] as const;
/** A seat that has sent nothing for this long has dropped out (closed tab, lost connection). */
export const SEAT_TIMEOUT_MS = 8000;
/** The longest a crew run lasts, so a run in an endless area still ends. */
export const CREW_RUN_CAP_SEC = 420;

export interface RunSeat {
  id: string;
  userId: string;
  name: string;
  characterId: string;
}

export interface HeldSeat extends RunSeat {
  lastHeardAt: number;
}

export function crewRunChannel(crewId: string): string {
  return `crewrun:${crewId}`;
}

export function crewRunLength(area: { endless?: boolean; durationSec: number }): number {
  return area.endless ? Math.min(300, CREW_RUN_CAP_SEC) : Math.min(area.durationSec, CREW_RUN_CAP_SEC);
}

/** The first free guest seat id, or null when the room is full. */
export function freeSeatId(taken: readonly string[]): string | null {
  return GUEST_SEATS.find((id) => !taken.includes(id)) ?? null;
}

/** Adds a joiner. The same account joining again keeps its seat (a retried request), never takes two. */
export function seatJoiner(
  seats: readonly HeldSeat[],
  joiner: Omit<RunSeat, 'id'>,
  now: number,
): { seats: HeldSeat[]; seatId: string } | 'full' {
  const existing = seats.find((seat) => seat.userId === joiner.userId);
  if (existing) {
    return { seats: seats.map((seat) => (seat === existing ? { ...seat, characterId: joiner.characterId, name: joiner.name, lastHeardAt: now } : seat)), seatId: existing.id };
  }
  const id = freeSeatId(seats.map((seat) => seat.id));
  if (!id) return 'full';
  return { seats: [...seats, { ...joiner, id, lastHeardAt: now }], seatId: id };
}

export function seatLeaves(seats: readonly HeldSeat[], seatId: string): HeldSeat[] {
  return seats.filter((seat) => seat.id !== seatId);
}

export function heardFrom(seats: readonly HeldSeat[], seatId: string, now: number): HeldSeat[] {
  return seats.map((seat) => (seat.id === seatId ? { ...seat, lastHeardAt: now } : seat));
}

/** Drops seats that have gone quiet. */
export function expireSeats(seats: readonly HeldSeat[], now: number): { seats: HeldSeat[]; dropped: HeldSeat[] } {
  const kept: HeldSeat[] = [];
  const dropped: HeldSeat[] = [];
  for (const seat of seats) (now - seat.lastHeardAt > SEAT_TIMEOUT_MS ? dropped : kept).push(seat);
  return { seats: kept, dropped };
}

/** The crewmate (never yourself) who is hosting an open run for this crew, if any. */
export function openCrewRun(
  crew: LokCrewState,
  online: Record<string, LokPresence>,
  myId: string | null | undefined,
): { userId: string; name: string; room: string } | null {
  const crewId = crew.crew?.id;
  if (!crewId) return null;
  for (const member of crew.members) {
    if (member.userId === myId) continue;
    const presence = online[member.userId];
    if (presence && presence.doing === 'run' && presence.room === crewId) return { userId: member.userId, name: member.name, room: crewId };
  }
  return null;
}

/** Turns a drag on screen into a move: full strength at `radius`, nothing inside the dead zone. */
export function stickToMove(dx: number, dy: number, radius = 54, deadZone = 0.12): { moveX: number; moveY: number } {
  const len = Math.hypot(dx, dy);
  if (len < radius * deadZone) return { moveX: 0, moveY: 0 };
  const strength = Math.min(1, len / radius);
  return { moveX: (dx / len) * strength, moveY: (dy / len) * strength };
}

/**
 * lib/couch/core.ts -- game-agnostic pre-match lobby rules for the Lok ecosystem.
 *
 * Pure functions only. This module imports nothing from any game (test-enforced) so it can be lifted
 * into its own package (`@lok/couch`) and reused by Lok Party, Survivor 616 crews and future games.
 * A game keeps its own seat extras by extending LobbySeat.
 */

/** No I, L, O, 0 or 1, so a code read aloud from a TV is never ambiguous. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export type LobbySeatKind = 'host' | 'guest' | 'bot';

export interface LobbySeat {
  index: number;
  kind: LobbySeatKind;
  name: string;
  /** A guest's stable join id (one per tab or device). */
  clientId?: string;
  /** A guest's ready-up flag. The host needs none and bots never block. */
  ready?: boolean;
}

export function createRoomCode(length = ROOM_CODE_LENGTH, rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += ROOM_CODE_ALPHABET[Math.floor(rand() * ROOM_CODE_ALPHABET.length)];
  return code;
}

export function normalizeRoomCode(raw: string, length = ROOM_CODE_LENGTH): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, length);
}

/** Set one guest's ready flag, found by clientId so a stale seat index can never flip the wrong seat. */
export function setGuestReady<S extends LobbySeat>(seats: S[], clientId: string, ready: boolean): S[] {
  return seats.map((s) => (s.kind === 'guest' && s.clientId === clientId ? { ...s, ready } : s));
}

export function readyCounts(seats: readonly LobbySeat[]): { guests: number; ready: number } {
  const guests = seats.filter((s) => s.kind === 'guest');
  return { guests: guests.length, ready: guests.filter((s) => s.ready).length };
}

/** The host may start when every human guest is ready; a lobby with no guests may always start. */
export function canStart(seats: readonly LobbySeat[]): boolean {
  const c = readyCounts(seats);
  return c.ready === c.guests;
}

/** Turn a guest seat back into a bot (they left); clears their ready flag and identity. */
export function guestToBot<S extends LobbySeat>(seats: S[], index: number): S[] {
  return seats.map((s) => (s.index === index && s.kind === 'guest' ? { ...s, kind: 'bot' as const, name: '', clientId: undefined, ready: undefined } : s));
}

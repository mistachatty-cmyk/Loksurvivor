/**
 * partyNet.ts -- online Lok Party rooms (Slice 4).
 *
 * Same free relay as the 616 Arena: Supabase Realtime broadcast on the project `lokClient` already
 * uses. No server, no stored state, nothing billed per match.
 *
 * Why so little crosses the wire: the board engine is pure and seeded, so every screen runs the same
 * game. The host only orders the choices: every action (a guest's tap, the host's tap, a bot's
 * decision made on the host) gets a sequence number and is broadcast; each client applies them in
 * order. Minigames are async score-attack: everyone plays the same seed on their own screen and
 * reports what they banked; the host combines the scores into placements.
 *
 * The pure helpers at the bottom (seat assignment, placements) are what the tests cover.
 */

import type { BoardAction } from './lokBoard';

export const PARTY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createPartyCode(length = 5, rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += PARTY_CODE_ALPHABET[Math.floor(rand() * PARTY_CODE_ALPHABET.length)];
  return code;
}

export function normalizePartyCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => PARTY_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, 5);
}

export function partyLink(code: string, origin: string): string {
  return `${origin}/?screen=lok-party&party=${code}`;
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export type SeatKind = 'host' | 'guest' | 'bot';

export interface Seat {
  index: number;
  kind: SeatKind;
  characterId: string;
  name: string;
  /** The guest's join request id (stable per tab). */
  clientId?: string;
  /** A guest's ready-up flag. The host does not need one and bots are always ready. */
  ready?: boolean;
}

/** Default lobby: host in seat 0, three bots on the rest of the launch roster. */
export function initialSeats(hostCharacter: string, hostName: string, roster: readonly string[]): Seat[] {
  const rest = roster.filter((id) => id !== hostCharacter);
  return [{ index: 0, kind: 'host', characterId: hostCharacter, name: hostName, clientId: 'host' }, ...rest.slice(0, 3).map((characterId, i) => ({ index: i + 1, kind: 'bot' as const, characterId, name: '' }))];
}

/**
 * Put a joining guest into the first bot seat. A guest keeps its wished character if no human holds
 * it (swapping it with the bot that had it); otherwise it takes the seat's character.
 * Returns null when every seat already holds a human. Re-joining with the same clientId returns the
 * guest's existing seat.
 */
export function assignSeat(seats: Seat[], req: { clientId: string; characterId: string; name: string }): { seats: Seat[]; seat: number } | null {
  const existing = seats.find((s) => s.clientId === req.clientId);
  if (existing) return { seats, seat: existing.index };
  const free = seats.find((s) => s.kind === 'bot');
  if (!free) return null;
  const next = seats.map((s) => ({ ...s }));
  const target = next[free.index];
  const holder = next.find((s) => s.characterId === req.characterId);
  if (holder && holder.kind === 'bot' && holder.index !== target.index) {
    holder.characterId = target.characterId;
  }
  if (!holder || holder.kind === 'bot') target.characterId = req.characterId;
  target.kind = 'guest';
  target.name = req.name.slice(0, 24);
  target.clientId = req.clientId;
  return { seats: next, seat: target.index };
}

export function seatToBot(seats: Seat[], index: number): Seat[] {
  return seats.map((s) => (s.index === index && s.kind === 'guest' ? { ...s, kind: 'bot', name: '', clientId: undefined, ready: undefined } : s));
}

/** Set one guest's ready flag, found by clientId (so a stale seat index can never flip the wrong seat). */
export function setGuestReady(seats: Seat[], clientId: string, ready: boolean): Seat[] {
  return seats.map((s) => (s.kind === 'guest' && s.clientId === clientId ? { ...s, ready } : s));
}

/** How many human guests there are and how many have readied up. */
export function readyCounts(seats: Seat[]): { guests: number; ready: number } {
  const guests = seats.filter((s) => s.kind === 'guest');
  return { guests: guests.length, ready: guests.filter((s) => s.ready).length };
}

/** The host may start when every human guest is ready (a lobby with no guests may always start). */
export function canStart(seats: Seat[]): boolean {
  const c = readyCounts(seats);
  return c.ready === c.guests;
}

// ---------------------------------------------------------------------------
// Minigame placements (async score-attack)
// ---------------------------------------------------------------------------

/**
 * Combine banked scores into placements per seat (1 = first). Humans report their own score; bot
 * seats use the host's run. Ties keep seat order, so every screen computes the same answer.
 */
export function minigamePlacements(banked: number[]): number[] {
  const order = banked.map((b, i) => ({ b: Number.isFinite(b) ? b : 0, i })).sort((x, y) => y.b - x.b || x.i - y.i);
  const place = new Array<number>(banked.length).fill(4);
  order.forEach((o, rank) => {
    place[o.i] = rank + 1;
  });
  return place;
}

// ---------------------------------------------------------------------------
// Wire messages
// ---------------------------------------------------------------------------

export interface StartPayload {
  seed: number;
  rounds: number;
  seats: Seat[];
}

export interface ApplyPayload {
  seq: number;
  action: BoardAction;
}

export interface PartyHandlers {
  onJoinRequest?(m: { clientId: string; characterId: string; name: string }): void;
  onLobby?(m: { seats: Seat[]; rounds: number }): void;
  onReady?(m: { clientId: string; ready: boolean }): void;
  onStart?(m: StartPayload): void;
  onAct?(m: { seat: number; action: BoardAction }): void;
  onApply?(m: ApplyPayload): void;
  onMiniReport?(m: { round: number; seat: number; banked: number }): void;
  onMiniResult?(m: { round: number; placements: number[] }): void;
  onSeatBot?(m: { seat: number }): void;
  onPing?(m: { seat: number; host: boolean }): void;
  onLeave?(m: { seat: number; host: boolean }): void;
  onStatus?(s: PartyStatus): void;
}

export type PartyStatus = 'connecting' | 'connected' | 'disconnected';

/** The slice of a Supabase client this needs (kept tiny so tests can fake it). */
export interface BroadcastClient {
  channel(name: string, opts: { config: { broadcast: { self: boolean } } }): {
    on(type: 'broadcast', filter: { event: string }, cb: (msg: { payload: any }) => void): any;
    subscribe(cb: (status: string) => void): any;
    send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown> | unknown;
    unsubscribe(): Promise<unknown> | unknown;
  };
}

export interface PartyRoom {
  code: string;
  setHandlers(h: PartyHandlers): void;
  send(event: string, payload: Record<string, unknown>): void;
  close(): void;
}

const EVENTS: [string, keyof PartyHandlers][] = [
  ['join-request', 'onJoinRequest'],
  ['lobby', 'onLobby'],
  ['ready', 'onReady'],
  ['start', 'onStart'],
  ['act', 'onAct'],
  ['apply', 'onApply'],
  ['mini-report', 'onMiniReport'],
  ['mini-result', 'onMiniResult'],
  ['seat-bot', 'onSeatBot'],
  ['ping', 'onPing'],
  ['leave', 'onLeave'],
];

export function openPartyRoom(client: BroadcastClient, code: string): PartyRoom {
  let handlers: PartyHandlers = {};
  let status: PartyStatus = 'connecting';
  const channel = client.channel(`lokparty:${code}`, { config: { broadcast: { self: false } } });
  for (const [event, key] of EVENTS) {
    channel.on('broadcast', { event }, ({ payload }) => {
      const fn = handlers[key] as ((p: unknown) => void) | undefined;
      fn?.(payload);
    });
  }
  channel.subscribe((s: string) => {
    status = s === 'SUBSCRIBED' ? 'connected' : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED' ? 'disconnected' : 'connecting';
    handlers.onStatus?.(status);
  });
  return {
    code,
    setHandlers: (h) => {
      handlers = h;
      h.onStatus?.(status);
    },
    send: (event, payload) => {
      void channel.send({ type: 'broadcast', event, payload });
    },
    close: () => {
      void channel.unsubscribe();
    },
  };
}

/** Everything the board needs to play online. */
export interface OnlineSession {
  room: PartyRoom;
  host: boolean;
  mySeat: number;
  seats: Seat[];
  seed: number;
  rounds: number;
}

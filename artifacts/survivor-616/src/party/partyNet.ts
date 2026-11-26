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
 * The relay is best-effort (nothing is replayed), so everything that matters is sent again until it
 * lands: guests say how far they got in each ping and the host resends the rest; a guest repeats its
 * choice or minigame score until the host has answered.
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
  return seats.map((s) => (s.index === index && s.kind === 'guest' ? { ...s, kind: 'bot', name: '', clientId: undefined } : s));
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

/** A guest's choice. `after` is how many actions it had applied when it chose. */
export interface ActPayload {
  seat: number;
  after: number;
  action: BoardAction;
}

export interface PingPayload {
  seat: number;
  host: boolean;
  /** Guest: highest action number held with no gap. */
  have?: number;
  /** Guest: the minigame round it is still waiting on a result for. */
  waiting?: number;
}

// ---------------------------------------------------------------------------
// Ordering and recovery (pure; used by both sides)
// ---------------------------------------------------------------------------

export function createActionSync() {
  const log: BoardAction[] = [];
  const inbox = new Map<number, BoardAction>();
  let applied = 0;
  return {
    /** Actions handed to the engine so far. */
    get applied(): number {
      return applied;
    },
    /** Host: actions numbered so far. */
    get committed(): number {
      return log.length;
    },
    /** Host: number an action, keep it for resends and queue it locally. */
    commit(action: BoardAction): number {
      const seq = log.push(action);
      inbox.set(seq, action);
      return seq;
    },
    /** Guest: store a numbered action. Repeats are harmless. */
    receive(seq: number, action: BoardAction): void {
      if (Number.isInteger(seq) && seq > applied) inbox.set(seq, action);
    },
    /** The next action in order, or null while it has not arrived. */
    take(): BoardAction | null {
      const next = inbox.get(applied + 1);
      if (!next) return null;
      applied += 1;
      inbox.delete(applied);
      return next;
    },
    /** Highest number held with no gap. */
    have(): number {
      let n = applied;
      while (inbox.has(n + 1)) n += 1;
      return n;
    },
    /** Host: what a guest holding `have` actions still needs, oldest first. */
    missing(have: number, limit = 40): ApplyPayload[] {
      const from = Math.max(0, Math.floor(have) || 0);
      return log.slice(from, from + limit).map((action, i) => ({ seq: from + i + 1, action }));
    },
  };
}

/**
 * What the host does with a guest's choice: `commit` it, `hold` it until the host's own board
 * reaches that moment, or `drop` it because the game has already moved past it (a repeat).
 */
export function actVerdict(
  act: { seat: number; after: number },
  now: { turnOf: number; waiting: boolean; applied: number; committed: number },
): 'commit' | 'hold' | 'drop' {
  if (!(act.after >= now.committed)) return 'drop';
  if (act.after !== now.applied || now.applied !== now.committed) return 'hold';
  return now.waiting && now.turnOf === act.seat ? 'commit' : 'hold';
}

export interface PartyHandlers {
  onJoinRequest?(m: { clientId: string; characterId: string; name: string }): void;
  onLobby?(m: { seats: Seat[]; rounds: number }): void;
  onStart?(m: StartPayload): void;
  onAct?(m: ActPayload): void;
  onApply?(m: ApplyPayload): void;
  onMiniReport?(m: { round: number; seat: number; banked: number }): void;
  onMiniResult?(m: { round: number; placements: number[] }): void;
  onSeatBot?(m: { seat: number }): void;
  onPing?(m: PingPayload): void;
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

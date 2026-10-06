/**
 * LokSurvivorArena online mode: a thin relay over Supabase Realtime
 * broadcast on the already-free `LokServices` project `lokClient` already
 * connects to for LokTokens -- no new servers, no new infra, no future
 * cost. See `.agents/memory/loksurvivor-arena.md` for why this replaced an
 * earlier Fly.io `ws`-relay idea (Fly's free tier is gone; this needs none).
 *
 * Design: the host relays the merged per-tick input vector (every seat's
 * `{moveX, moveY}`) plus the authoritative kill/time/outcome counters.
 * Every client -- including the host -- runs its own full local
 * `stepWorld` off that shared input, so only tiny input/scoreboard messages
 * ever cross the wire, never enemy/actor state (which would mean
 * serializing `EnemyActor`'s ~40 fields, several not JSON-safe, e.g.
 * `Set<number>` hit-tracking). Minor enemy-position drift between two
 * screens is an accepted tradeoff of this design, not a bug -- the
 * scoreboard (kills/time/outcome) is always the host's broadcast numbers,
 * so "who's winning" never disagrees between screens even if the swarm
 * looks slightly different frame-to-frame.
 */
import type { SupabaseClient } from '@workspace/lok-client';
import type { RunOutcome } from '@/game/engine/world';
import type { ArenaMove } from './arenaInput';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I -- avoids read-aloud ambiguity

export function createRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export interface ArenaTickMessage {
  /** index 0 = host, rest = guests in seat order -- same shape `readArenaInputs` returns. */
  inputs: ArenaMove[];
  time: number;
  kills: number;
  guestKills: Record<string, number>;
  outcome: RunOutcome;
}

export interface ArenaMatchStartPayload {
  areaId: string;
  /** Seat order; index 0 is always the host. Guests resolve `characterId` against their own local `CHARACTERS` data. */
  seats: Array<{ id: string; characterId: string; name: string }>;
}

interface HostHandlers {
  onJoinRequest?(msg: { requestId: string; characterId: string; name: string }): void;
  onGuestInput?(msg: { seatId: string; moveX: number; moveY: number }): void;
}

interface GuestHandlers {
  onJoinAccepted?(seatId: string): void;
  onMatchStart?(payload: ArenaMatchStartPayload): void;
  onTick?(msg: ArenaTickMessage): void;
}

export interface HostArenaRoom {
  code: string;
  setHandlers(handlers: HostHandlers): void;
  sendJoinAccepted(requestId: string, seatId: string): void;
  sendMatchStart(payload: ArenaMatchStartPayload): void;
  sendTick(msg: ArenaTickMessage): void;
  close(): void;
}

export interface GuestArenaRoom {
  code: string;
  setHandlers(handlers: GuestHandlers): void;
  requestJoin(characterId: string, name: string): void;
  sendInput(move: ArenaMove): void;
  /** Assigned by the host in its `join-accepted` reply; null until then. */
  getSeatId(): string | null;
  close(): void;
}

/** Host side: owns the room's channel for its whole lifetime (lobby through match end). */
export function hostArenaRoom(client: SupabaseClient, code: string): HostArenaRoom {
  let handlers: HostHandlers = {};
  const channel = client.channel(`arena:${code}`, { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'join-request' }, ({ payload }) => handlers.onJoinRequest?.(payload))
    .on('broadcast', { event: 'input' }, ({ payload }) => handlers.onGuestInput?.(payload))
    .subscribe();

  return {
    code,
    setHandlers: (next) => { handlers = next; },
    sendJoinAccepted: (requestId, seatId) => {
      void channel.send({ type: 'broadcast', event: 'join-accepted', payload: { requestId, seatId } });
    },
    sendMatchStart: (payload) => {
      void channel.send({ type: 'broadcast', event: 'match-start', payload });
    },
    sendTick: (msg) => {
      void channel.send({ type: 'broadcast', event: 'tick', payload: msg });
    },
    close: () => { void channel.unsubscribe(); },
  };
}

/** Carried from the lobby/join screen into `ArenaScreen` once a match is ready to start. */
export type ArenaNetRole =
  | { kind: 'host'; code: string; room: HostArenaRoom }
  | { kind: 'guest'; code: string; room: GuestArenaRoom };

/** Guest side: owns the room's channel from join request through match end. */
export function joinArenaRoom(client: SupabaseClient, code: string): GuestArenaRoom {
  let handlers: GuestHandlers = {};
  let mySeatId: string | null = null;
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = client.channel(`arena:${code}`, { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'join-accepted' }, ({ payload }) => {
      if (payload.requestId !== requestId) return;
      mySeatId = payload.seatId;
      handlers.onJoinAccepted?.(payload.seatId);
    })
    .on('broadcast', { event: 'match-start' }, ({ payload }) => handlers.onMatchStart?.(payload))
    .on('broadcast', { event: 'tick' }, ({ payload }) => handlers.onTick?.(payload))
    .subscribe();

  return {
    code,
    setHandlers: (next) => { handlers = next; },
    requestJoin: (characterId, name) => {
      void channel.send({ type: 'broadcast', event: 'join-request', payload: { requestId, characterId, name } });
    },
    sendInput: (move) => {
      if (!mySeatId) return;
      void channel.send({ type: 'broadcast', event: 'input', payload: { seatId: mySeatId, moveX: move.moveX, moveY: move.moveY } });
    },
    getSeatId: () => mySeatId,
    close: () => { void channel.unsubscribe(); },
  };
}

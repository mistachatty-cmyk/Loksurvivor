/**
 * Crew run networking: an open room per crew on Supabase Realtime broadcast, like the arena's online mode
 * (see `arenaNet.ts`) but built for dropping in and out. The host relays everyone's move input plus the
 * shared clock and kill counts; every screen runs its own simulation, so no enemy state ever crosses the
 * wire. Nothing here is stored. The room is named after the crew, so only people who can see that crew's
 * id (its members) can find it.
 */
import type { SupabaseClient } from '@workspace/lok-client';

import type { RunOutcome } from '@/game/engine/world';
import { crewRunChannel, type RunSeat } from '@/lib/social/crewRun';
import type { ArenaMove } from './arenaInput';

export interface CrewRunRoster {
  areaId: string;
  /** Shared so every screen builds the same starting world. */
  seed: number;
  /** Seat 0 is always the host (`id: 'host'`). */
  seats: RunSeat[];
}

export interface CrewRunTick {
  inputs: Record<string, ArenaMove>;
  time: number;
  kills: number;
  guestKills: Record<string, number>;
  outcome: RunOutcome;
}

export type CrewRunStatus = 'connecting' | 'connected' | 'disconnected';

const statusOf = (status: string): CrewRunStatus =>
  status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'disconnected' : 'connecting';

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0);
const text = (value: unknown, max = 40): string => (typeof value === 'string' ? value.slice(0, max) : '');

export interface JoinRequest { requestId: string; userId: string; name: string; characterId: string }

export interface CrewRunHost {
  setHandlers(handlers: {
    onJoin?(request: JoinRequest): void;
    onInput?(seatId: string, move: ArenaMove): void;
    onLeave?(seatId: string): void;
    onStatus?(status: CrewRunStatus): void;
  }): void;
  sendJoined(requestId: string, seatId: string, roster: CrewRunRoster, time: number): void;
  sendFull(requestId: string): void;
  sendRoster(roster: CrewRunRoster): void;
  sendTick(tick: CrewRunTick): void;
  sendEnd(outcome: RunOutcome): void;
  close(): void;
}

export interface CrewRunGuest {
  setHandlers(handlers: {
    onJoined?(seatId: string, roster: CrewRunRoster, time: number): void;
    onFull?(): void;
    onRoster?(roster: CrewRunRoster): void;
    onTick?(tick: CrewRunTick): void;
    onEnd?(outcome: RunOutcome): void;
    onStatus?(status: CrewRunStatus): void;
  }): void;
  requestJoin(info: { userId: string; name: string; characterId: string }): void;
  sendInput(seatId: string, move: ArenaMove): void;
  sendLeave(seatId: string): void;
  close(): void;
}

function readRoster(payload: Record<string, unknown>): CrewRunRoster | null {
  const raw = payload.roster as { areaId?: unknown; seed?: unknown; seats?: unknown } | undefined;
  if (!raw || typeof raw.areaId !== 'string' || !Array.isArray(raw.seats)) return null;
  const seats: RunSeat[] = [];
  for (const entry of raw.seats.slice(0, 4)) {
    const seat = entry as Partial<RunSeat> | null;
    if (!seat || typeof seat.id !== 'string' || typeof seat.characterId !== 'string') continue;
    seats.push({ id: text(seat.id, 8), userId: text(seat.userId, 80), name: text(seat.name) || 'Player', characterId: text(seat.characterId, 60) });
  }
  return seats.length > 0 ? { areaId: raw.areaId.slice(0, 60), seed: typeof raw.seed === 'number' && Number.isFinite(raw.seed) ? raw.seed : 616, seats } : null;
}

function readTick(payload: Record<string, unknown>): CrewRunTick | null {
  if (typeof payload.time !== 'number' || typeof payload.kills !== 'number' || !payload.inputs || typeof payload.inputs !== 'object') return null;
  const inputs: Record<string, ArenaMove> = {};
  for (const [id, move] of Object.entries(payload.inputs as Record<string, { moveX?: unknown; moveY?: unknown }>).slice(0, 4)) {
    inputs[text(id, 8)] = { moveX: num(move?.moveX), moveY: num(move?.moveY) };
  }
  const guestKills: Record<string, number> = {};
  for (const [id, kills] of Object.entries((payload.guestKills ?? {}) as Record<string, unknown>).slice(0, 4)) {
    if (typeof kills === 'number' && Number.isFinite(kills)) guestKills[text(id, 8)] = kills;
  }
  const outcome = payload.outcome === 'cleared' || payload.outcome === 'dead' ? payload.outcome : 'running';
  return { inputs, time: payload.time, kills: payload.kills, guestKills, outcome } as CrewRunTick;
}

export function openCrewRunHost(client: SupabaseClient, crewId: string): CrewRunHost {
  let handlers: Parameters<CrewRunHost['setHandlers']>[0] = {};
  let status: CrewRunStatus = 'connecting';
  const channel = client.channel(crewRunChannel(crewId), { config: { broadcast: { self: false } } });
  const send = (event: string, payload: Record<string, unknown>) => void channel.send({ type: 'broadcast', event, payload });
  channel
    .on('broadcast', { event: 'join' }, ({ payload }) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      handlers.onJoin?.({ requestId: text(p.requestId, 60), userId: text(p.userId, 80), name: text(p.name) || 'Player', characterId: text(p.characterId, 60) });
    })
    .on('broadcast', { event: 'input' }, ({ payload }) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      handlers.onInput?.(text(p.seatId, 8), { moveX: num(p.moveX), moveY: num(p.moveY) });
    })
    .on('broadcast', { event: 'leave' }, ({ payload }) => handlers.onLeave?.(text(((payload ?? {}) as Record<string, unknown>).seatId, 8)))
    .subscribe((next) => { status = statusOf(next); handlers.onStatus?.(status); });
  return {
    setHandlers: (next) => { handlers = next; next.onStatus?.(status); },
    sendJoined: (requestId, seatId, roster, time) => send('joined', { requestId, seatId, roster, time }),
    sendFull: (requestId) => send('full', { requestId }),
    sendRoster: (roster) => send('roster', { roster }),
    sendTick: (tick) => send('tick', { ...tick }),
    sendEnd: (outcome) => send('end', { outcome }),
    close: () => void client.removeChannel(channel),
  };
}

export function openCrewRunGuest(client: SupabaseClient, crewId: string): CrewRunGuest {
  let handlers: Parameters<CrewRunGuest['setHandlers']>[0] = {};
  let status: CrewRunStatus = 'connecting';
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = client.channel(crewRunChannel(crewId), { config: { broadcast: { self: false } } });
  const send = (event: string, payload: Record<string, unknown>) => void channel.send({ type: 'broadcast', event, payload });
  channel
    .on('broadcast', { event: 'joined' }, ({ payload }) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      if (p.requestId !== requestId) return;
      const roster = readRoster(p);
      if (roster && typeof p.seatId === 'string') handlers.onJoined?.(p.seatId.slice(0, 8), roster, typeof p.time === 'number' ? p.time : 0);
    })
    .on('broadcast', { event: 'full' }, ({ payload }) => { if (((payload ?? {}) as Record<string, unknown>).requestId === requestId) handlers.onFull?.(); })
    .on('broadcast', { event: 'roster' }, ({ payload }) => { const roster = readRoster((payload ?? {}) as Record<string, unknown>); if (roster) handlers.onRoster?.(roster); })
    .on('broadcast', { event: 'tick' }, ({ payload }) => { const tick = readTick((payload ?? {}) as Record<string, unknown>); if (tick) handlers.onTick?.(tick); })
    .on('broadcast', { event: 'end' }, ({ payload }) => {
      const outcome = ((payload ?? {}) as Record<string, unknown>).outcome;
      handlers.onEnd?.(outcome === 'dead' ? 'dead' : 'cleared');
    })
    .subscribe((next) => { status = statusOf(next); handlers.onStatus?.(status); });
  return {
    setHandlers: (next) => { handlers = next; next.onStatus?.(status); },
    requestJoin: (info) => send('join', { requestId, ...info }),
    sendInput: (seatId, move) => send('input', { seatId, moveX: move.moveX, moveY: move.moveY }),
    sendLeave: (seatId) => send('leave', { seatId }),
    close: () => void client.removeChannel(channel),
  };
}

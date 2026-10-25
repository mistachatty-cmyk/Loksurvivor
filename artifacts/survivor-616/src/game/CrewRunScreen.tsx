/**
 * Crew run: an open co-op room built on the arena's relay. One crewmate hosts; the others drop in and out at
 * any time, from the Crew overlay or the "your crew is in a run" prompt, and the room keeps going. Everyone
 * runs their own simulation from a shared seed; the host relays the shared clock, kill counts and each
 * player's movement (see `arena/crewRunNet.ts`). Joined players are lightweight helpers: they move and
 * strike nearby enemies but do not level up, and only the host can be knocked out, which ends the run for
 * everyone. Nothing is stored and no rewards are paid, because the numbers are relayed by players' devices.
 * While connecting, the player can walk around the street in `WalkingLoader`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SILENT_FRAME } from '@/game/audio/beatBus';
import { AREAS } from '@/game/data/areas';
import { stepWorld, type RunOutcome, type World } from '@/game/engine/world';
import { buildCrewRunWorld as buildWorld, characterFor, reconcileGuests } from '@/game/arena/crewRunWorld';
import { renderWorld, type Viewport } from '@/game/render/draw';
import { readArenaInputs, type ArenaMove } from '@/game/arena/arenaInput';
import {
  openCrewRunGuest, openCrewRunHost, type CrewRunGuest, type CrewRunHost, type CrewRunRoster, type CrewRunStatus, type CrewRunTick,
} from '@/game/arena/crewRunNet';
import { lokClient } from '@/lib/lokClient';
import { useT } from '@/lib/i18n';
import {
  crewRunLength, expireSeats, heardFrom, seatJoiner, seatLeaves, stickToMove, type HeldSeat, type RunSeat,
} from '@/lib/social/crewRun';
import { EmoteBar } from '@/ui/CrewChat';
import { LoadingGame } from '@/ui/LoadingGame';
import { openCrewOverlay, useSocial } from '@/state/socialStore';
import { getNetConfig } from '@/lib/social/netConfig';
import type { AreaDef, CharacterDef } from '@/game/types';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;
/** The host broadcasts a few times a second (the dial `runTickHz`, 4 by default): held inputs need no more, and the shared message budget is small. */
const INPUT_HEARTBEAT_MS = 2000;
const JOIN_RETRY_MS = 2500;
const JOIN_GIVE_UP_MS = 15000;
const STICK_RADIUS = 54;

export interface CrewRunScreenProps {
  role: 'host' | 'guest';
  crewId: string;
  characterId: string;
  /** Host only. */
  areaId?: string;
  onExit: () => void;
}

type Phase = 'connecting' | 'ready' | 'running' | 'ended' | 'failed';

const still: ArenaMove = { moveX: 0, moveY: 0 };
const quantize = (move: ArenaMove): ArenaMove => ({ moveX: Math.round(move.moveX * 10) / 10, moveY: Math.round(move.moveY * 10) / 10 });
const same = (a: ArenaMove, b: ArenaMove) => a.moveX === b.moveX && a.moveY === b.moveY;
export function CrewRunScreen({ role, crewId, characterId, areaId, onExit }: CrewRunScreenProps) {
  const t = useT();
  const social = useSocial();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const stickRef = useRef<{ id: number; ox: number; oy: number; dx: number; dy: number } | null>(null);
  const [stickView, setStickView] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);
  const worldRef = useRef<World | null>(null);
  const areaRef = useRef<AreaDef | null>(null);
  const hostRoom = useRef<CrewRunHost | null>(null);
  const guestRoom = useRef<CrewRunGuest | null>(null);
  const seatsRef = useRef<HeldSeat[]>([]);
  const inputsRef = useRef<Record<string, ArenaMove>>({});
  const tickRef = useRef<CrewRunTick | null>(null);
  const rosterRef = useRef<CrewRunRoster | null>(null);
  const mySeatRef = useRef<string>(role === 'host' ? 'host' : '');
  const endedByHost = useRef<RunOutcome | null>(null);

  const [phase, setPhase] = useState<Phase>('connecting');
  const [status, setStatus] = useState<CrewRunStatus>('connecting');
  const [failure, setFailure] = useState<'full' | 'closed' | 'area' | null>(null);
  const [board, setBoard] = useState<Array<{ id: string; name: string; kills: number }>>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [notices, setNotices] = useState<Array<{ id: number; text: string }>>([]);
  const noticeId = useRef(0);

  const myName = social.me?.displayName ?? 'Player';
  const myUserId = social.me?.userId ?? '';
  const live = useRef({ myName, myUserId });
  live.current = { myName, myUserId };
  const character = useMemo(() => characterFor(characterId), [characterId]);

  const notify = useCallback((text: string) => {
    noticeId.current += 1;
    const id = noticeId.current;
    setNotices((prev) => [...prev, { id, text }].slice(-3));
    window.setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 3500);
  }, []);

  const rosterOf = useCallback((): CrewRunRoster | null => {
    const base = rosterRef.current;
    if (!base) return null;
    return { areaId: base.areaId, seed: base.seed, seats: [base.seats[0]!, ...seatsRef.current.map(({ lastHeardAt: _heard, ...seat }) => seat)] };
  }, []);

  // Connect: the host opens the room; a guest asks to drop in until the host answers.
  useEffect(() => {
    if (!lokClient) { setFailure('closed'); setPhase('failed'); return; }
    let cancelled = false;
    const timers: number[] = [];

    if (role === 'host') {
      const area = AREAS.find((a) => a.id === areaId);
      if (!area) { setFailure('area'); setPhase('failed'); return; }
      const seed = Math.floor(Math.random() * 1_000_000) + 1;
      rosterRef.current = { areaId: area.id, seed, seats: [{ id: 'host', userId: live.current.myUserId, name: live.current.myName, characterId }] };
      const built = buildWorld(rosterRef.current)!;
      worldRef.current = built.world;
      areaRef.current = built.area;
      const room = openCrewRunHost(lokClient, crewId);
      hostRoom.current = room;
      room.setHandlers({
        onStatus: (next) => { setStatus(next); if (next === 'connected') setPhase((p) => (p === 'connecting' ? 'running' : p)); },
        onJoin: (request) => {
          const world = worldRef.current;
          if (!world || world.outcome !== 'running') return;
          const result = seatJoiner(seatsRef.current, { userId: request.userId, name: request.name, characterId: request.characterId }, Date.now());
          if (result === 'full') { room.sendFull(request.requestId); return; }
          const isNew = !seatsRef.current.some((seat) => seat.id === result.seatId);
          seatsRef.current = result.seats;
          const { joined } = reconcileGuests(world, rosterOf()!.seats);
          const roster = rosterOf()!;
          room.sendJoined(request.requestId, result.seatId, roster, world.time);
          room.sendRoster(roster);
          if (isNew || joined.length > 0) notify(t('crewrun.joined', { name: request.name }));
        },
        onInput: (seatId, move) => {
          if (!seatsRef.current.some((seat) => seat.id === seatId)) return;
          inputsRef.current[seatId] = move;
          seatsRef.current = heardFrom(seatsRef.current, seatId, Date.now());
        },
        onLeave: (seatId) => {
          const seat = seatsRef.current.find((s) => s.id === seatId);
          if (!seat) return;
          seatsRef.current = seatLeaves(seatsRef.current, seatId);
          delete inputsRef.current[seatId];
          if (worldRef.current) reconcileGuests(worldRef.current, rosterOf()!.seats);
          room.sendRoster(rosterOf()!);
          notify(t('crewrun.left', { name: seat.name }));
        },
      });
      timers.push(window.setInterval(() => {
        const { seats, dropped } = expireSeats(seatsRef.current, Date.now());
        if (dropped.length === 0) return;
        seatsRef.current = seats;
        for (const seat of dropped) { delete inputsRef.current[seat.id]; notify(t('crewrun.left', { name: seat.name })); }
        if (worldRef.current) reconcileGuests(worldRef.current, rosterOf()!.seats);
        room.sendRoster(rosterOf()!);
      }, 1000));
      social.setDoing('run', crewId);
      return () => {
        cancelled = true;
        timers.forEach((id) => window.clearInterval(id));
        if (worldRef.current && worldRef.current.outcome === 'running') room.sendEnd('dead');
        room.close();
        hostRoom.current = null;
      };
    }

    const room = openCrewRunGuest(lokClient, crewId);
    guestRoom.current = room;
    const startedAt = Date.now();
    let joined = false;
    const askToJoin = () => room.requestJoin({ userId: live.current.myUserId, name: live.current.myName, characterId });
    room.setHandlers({
      onStatus: (next) => {
        setStatus(next);
        if (next === 'connected' && !joined) {
          askToJoin();
          timers.push(window.setInterval(() => {
            if (joined || cancelled) return;
            if (Date.now() - startedAt > JOIN_GIVE_UP_MS) { setFailure('closed'); setPhase('failed'); return; }
            askToJoin();
          }, JOIN_RETRY_MS));
        }
      },
      onJoined: (seatId, roster, time) => {
        if (joined) return;
        const built = buildWorld(roster);
        if (!built) { setFailure('area'); setPhase('failed'); return; }
        joined = true;
        built.world.time = time;
        worldRef.current = built.world;
        areaRef.current = built.area;
        mySeatRef.current = seatId;
        rosterRef.current = roster;
        setPhase('ready');
      },
      onFull: () => { setFailure('full'); setPhase('failed'); },
      onRoster: (roster) => {
        const world = worldRef.current;
        rosterRef.current = roster;
        if (!world) return;
        const { joined: came, left } = reconcileGuests(world, roster.seats);
        for (const seat of came) if (seat.id !== mySeatRef.current) notify(t('crewrun.joined', { name: seat.name }));
        void left;
      },
      onTick: (tick) => { tickRef.current = tick; },
      onEnd: (outcome) => { endedByHost.current = outcome; },
    });
    social.setDoing('run');
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearInterval(id));
      if (mySeatRef.current) room.sendLeave(mySeatRef.current);
      room.close();
      guestRoom.current = null;
    };
    // The room is opened once for this screen's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, crewId, areaId, characterId]);

  // A crew run keeps the crew's chat channel open for emotes.
  const { hold } = social.bus;
  useEffect(() => hold(), [hold]);

  // Leaving the host screen stops advertising the room.
  useEffect(() => () => { social.setDoing('menu'); }, [social.setDoing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      keysRef.current.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // The run loop.
  const running = phase === 'running';
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const world = worldRef.current;
    const area = areaRef.current;
    if (!canvas || !world || !area) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const cap = crewRunLength(area);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let sizeAt = 0;
    let hudAt = 0;
    let steps = 0;
    let sentAt = 0;
    let lastSent: ArenaMove = still;
    let lastTickInputs = '';
    let lastTickAt = 0;
    const hz = getNetConfig().runTickHz;
    const tickEverySteps = Math.max(1, Math.round(60 / hz));
    const inputMinGapMs = Math.round(1000 / hz);
    let view: Viewport = { width: 1, height: 1, dpr: 1 };

    const resize = (): Viewport => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const bw = Math.max(1, Math.round(width * ratio));
      const bh = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      return { width, height, dpr: bw / width };
    };
    view = resize();

    const myMove = (): ArenaMove => {
      const stick = stickRef.current;
      if (stick) return quantize(stickToMove(stick.dx, stick.dy, STICK_RADIUS));
      return quantize(readArenaInputs(keysRef.current, 1)[0]!);
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = time; return; }
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;
      if (time - sizeAt > 250) { sizeAt = time; view = resize(); }
      const mine = myMove();

      if (role === 'guest' && (time - sentAt > INPUT_HEARTBEAT_MS || (time - sentAt > inputMinGapMs && !same(mine, lastSent)))) {
        sentAt = time; lastSent = mine;
        guestRoom.current?.sendInput(mySeatRef.current, mine);
      }

      if (world.outcome === 'running') {
        if (role === 'guest' && endedByHost.current) world.outcome = endedByHost.current;
        const tick = tickRef.current;
        const hostMove = role === 'host' ? mine : (tick?.inputs.host ?? still);
        const guestInputs = world.guests.map((guest) => (role === 'host' ? inputsRef.current[guest.id] : tick?.inputs[guest.id]) ?? still);
        acc = Math.min(acc + dt, FIXED_STEP * MAX_SUBSTEPS);
        while (acc >= FIXED_STEP) {
          acc -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX: hostMove.moveX, moveY: hostMove.moveY, ultimate: false, audio: SILENT_FRAME, guestInputs });
          if (world.outcome !== 'running') break;
          if (role === 'host' && world.guests.length > 0) {
            steps += 1;
            if (steps >= tickEverySteps) {
              steps = 0;
              const inputs: Record<string, ArenaMove> = { host: hostMove };
              for (const guest of world.guests) inputs[guest.id] = inputsRef.current[guest.id] ?? still;
              // Idle rooms are quiet: send only when someone's movement changed, plus a once-a-second beat for the clock and scores.
              const fingerprint = JSON.stringify(inputs);
              if (fingerprint === lastTickInputs && time - lastTickAt < 1000) continue;
              lastTickInputs = fingerprint;
              lastTickAt = time;
              hostRoom.current?.sendTick({ inputs, time: world.time, kills: world.kills, guestKills: world.guestKills, outcome: world.outcome });
            }
          }
        }
        if (role === 'host' && world.time >= cap && world.outcome === 'running') world.outcome = 'cleared';
        if (world.outcome !== 'running') {
          if (role === 'host') { hostRoom.current?.sendEnd(world.outcome); social.setDoing('menu'); }
          setPhase('ended');
        }
      } else {
        setPhase('ended');
      }

      renderWorld(ctx, world, view);

      if (time - hudAt > 150) {
        hudAt = time;
        const roster = rosterRef.current;
        const heard = role === 'guest' ? tickRef.current : null;
        const seats = roster?.seats ?? [];
        setBoard(seats.map((seat) => ({
          id: seat.id,
          name: seat.name,
          kills: (seat.id === 'host' ? (heard ? heard.kills : world.kills) : (heard ? heard.guestKills[seat.id] : world.guestKills[seat.id])) ?? 0,
        })).sort((a, b) => b.kills - a.kills));
        const clock = heard ? heard.time : world.time;
        setSecondsLeft(Math.max(0, Math.round(cap - clock)));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, role]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || stickRef.current) return;
    stickRef.current = { id: event.pointerId, ox: event.clientX, oy: event.clientY, dx: 0, dy: 0 };
    setStickView({ ox: event.clientX, oy: event.clientY, dx: 0, dy: 0 });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (!stick || stick.id !== event.pointerId) return;
    let dx = event.clientX - stick.ox;
    let dy = event.clientY - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) { dx = (dx / len) * STICK_RADIUS; dy = (dy / len) * STICK_RADIUS; }
    stick.dx = dx; stick.dy = dy;
    setStickView({ ox: stick.ox, oy: stick.oy, dx, dy });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stickRef.current?.id !== event.pointerId) return;
    stickRef.current = null;
    setStickView(null);
  };

  if (phase === 'failed') {
    return (
      <div className="grid h-dvh place-items-center bg-black px-6 text-center font-mono text-white" data-testid="crewrun-failed">
        <div className="max-w-sm space-y-4">
          <h2 className="text-lg font-black uppercase tracking-widest">{t('crewrun.failedTitle')}</h2>
          <p className="text-sm text-white/70">{t(failure === 'full' ? 'crewrun.failedFull' : failure === 'area' ? 'crewrun.failedArea' : 'crewrun.failedClosed')}</p>
          <button type="button" onClick={onExit} className="border border-white/40 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/10" data-testid="button-crewrun-back">{t('crewrun.back')}</button>
        </div>
      </div>
    );
  }

  if (phase === 'connecting' || phase === 'ready') {
    return (
      <LoadingGame
        character={character}
        title={t(role === 'host' ? 'crewrun.openingTitle' : 'crewrun.joiningTitle')}
        status={phase === 'ready' ? t('crewrun.readyStatus') : t(status === 'disconnected' ? 'crewrun.statusOffline' : role === 'host' ? 'crewrun.statusOpening' : 'crewrun.statusKnocking')}
        progress={phase === 'ready' ? 1 : null}
        ready={phase === 'ready'}
        onEnter={() => setPhase('running')}
        onCancel={onExit}
        cancelLabel={t('crewrun.back')}
      />
    );
  }

  const ended = phase === 'ended';
  const outcome = worldRef.current?.outcome ?? 'cleared';
  return (
    <div className="relative h-dvh w-full touch-none select-none overflow-hidden bg-black" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} data-testid="crewrun-screen">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {stickView ? (
        <div className="pointer-events-none fixed" style={{ left: stickView.ox - STICK_RADIUS, top: stickView.oy - STICK_RADIUS, width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}>
          <div className="h-full w-full rounded-full border border-white/30 bg-white/5" />
          <div className="absolute h-8 w-8 rounded-full bg-white/40" style={{ left: STICK_RADIUS - 16 + stickView.dx, top: STICK_RADIUS - 16 + stickView.dy }} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-3 top-[max(0.75rem,var(--safe-top))] min-w-[170px] rounded-md bg-black/65 px-3 py-2 font-mono text-xs text-white" data-testid="crewrun-board">
        <div className="mb-1 flex items-center justify-between text-white/70">
          <span>{t('crewrun.title')}</span>
          <span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
        </div>
        <div className={`mb-1 text-[10px] uppercase ${status === 'connected' ? 'text-emerald-300' : status === 'disconnected' ? 'text-rose-300' : 'text-amber-200'}`}>
          {t(status === 'connected' ? 'crewrun.connected' : status === 'disconnected' ? 'crewrun.statusOffline' : 'crewrun.statusOpening')}
        </div>
        {board.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between gap-3"><span className="truncate">{i + 1}. {row.name}{row.id === mySeatRef.current ? ` (${t('social.you')})` : ''}</span><span>{row.kills}</span></div>
        ))}
      </div>

      <div className="absolute left-14 top-[max(0.75rem,var(--safe-top))] flex items-center gap-2">
        <button type="button" onClick={onExit} onPointerDown={(e) => e.stopPropagation()} className="border border-white/30 bg-black/60 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/85 hover:text-white" data-testid="button-crewrun-leave">{t(role === 'host' ? 'crewrun.close' : 'crewrun.dropOut')}</button>
        <button type="button" onClick={() => openCrewOverlay()} onPointerDown={(e) => e.stopPropagation()} className="border border-emerald-200/35 bg-black/60 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-50" data-testid="button-crewrun-crew">{t('social.button')}</button>
      </div>

      <div className="absolute inset-x-0 top-[max(4.5rem,calc(var(--safe-top)+3.75rem))] flex flex-col items-center gap-1 pointer-events-none" aria-live="polite">
        {notices.map((n) => <p key={n.id} className="rounded bg-black/70 px-3 py-1 font-mono text-xs text-fuchsia-100">{n.text}</p>)}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-3 pb-[max(0.5rem,var(--safe-bottom))]" onPointerDown={(e) => e.stopPropagation()}>
        <EmoteBar compact />
      </div>

      {ended ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 px-6 text-center font-mono text-white" data-testid="crewrun-over">
          <div className="text-xl font-black uppercase tracking-widest">{t(outcome === 'cleared' ? 'crewrun.cleared' : 'crewrun.fell')}</div>
          <div className="space-y-1 text-sm">{board.map((row) => <div key={row.id}>{row.name}: {row.kills}</div>)}</div>
          <p className="max-w-sm text-xs text-white/60">{t('crewrun.unranked')}</p>
          <button type="button" onClick={onExit} className="border border-white/40 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/10" data-testid="button-crewrun-done">{t('crewrun.back')}</button>
        </div>
      ) : null}
    </div>
  );
}

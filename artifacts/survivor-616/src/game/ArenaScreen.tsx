/**
 * LokSurvivorArena: the shared-arena "most kills wins" mode. Sibling to
 * `RunScreen.tsx`, deliberately much leaner -- no meta-progression, music,
 * clip recording, or level-up drafting (guests don't level up at all, see
 * `engine/world.ts`'s `updateGuest`; the host doesn't level up here either,
 * for scoreboard fairness). Modeled on `ui/AttractMode.tsx`'s minimal
 * `createWorld`/`stepWorld`/`renderWorld` loop, with real local input
 * (`arena/arenaInput.ts`) and a live kill-count scoreboard
 * (`arena/scoreboard.ts`) in place of AttractMode's bot and no-UI.
 *
 * Online mode (`net` prop set): see `arena/arenaNet.ts`. The host relays
 * the merged per-tick input vector plus authoritative kill/time/outcome
 * counters over a free Supabase Realtime room; every client -- including
 * the host -- runs its own full local `stepWorld`, so no enemy/actor state
 * ever crosses the wire. A remote guest's scoreboard always reflects the
 * host's broadcast numbers, never its own local simulation's kill count,
 * so "who's winning" never disagrees between screens.
 */
import { useEffect, useRef, useState } from 'react';

import { SILENT_FRAME } from '@/game/audio/beatBus';
import { stepWorld, type World } from '@/game/engine/world';
import { renderWorld, type Viewport } from '@/game/render/draw';
import { type ArenaSeat, createArenaWorld } from '@/game/arena/arenaWorld';
import { readArenaInputs, type ArenaMove } from '@/game/arena/arenaInput';
import { arenaStandings, type ArenaStanding } from '@/game/arena/scoreboard';
import type { ArenaNetRole, ArenaTickMessage } from '@/game/arena/arenaNet';
import { useLokEconomy } from '@/state/lokEconomyStore';
import type { AreaDef } from '@/game/types';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;
const MATCH_DURATION_SEC = 180;
/** Host broadcasts a tick every 3rd fixed step (~20Hz) -- plenty for an input relay, far under Realtime's free-tier message budget. */
const NET_TICK_EVERY_STEPS = 3;
const NET_INPUT_SEND_MS = 50;

export interface ArenaScreenProps {
  area: AreaDef;
  seats: ArenaSeat[];
  net?: ArenaNetRole;
  onExit: () => void;
}

export function ArenaScreen({ area, seats, net, onExit }: ArenaScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [standings, setStandings] = useState<ArenaStanding[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(MATCH_DURATION_SEC);
  const [ended, setEnded] = useState(false);
  const { earn: earnLokTokens } = useLokEconomy();

  // Host: latest input received per remote seat id. Guest: the latest
  // authoritative tick received from the host.
  const remoteInputsRef = useRef<Record<string, ArenaMove>>({});
  const lastTickRef = useRef<ArenaTickMessage | null>(null);

  const mySeatId = net?.kind === 'guest' ? net.room.getSeatId() : 'host';

  useEffect(() => {
    worldRef.current = createArenaWorld(area, seats);
  }, [area, seats]);

  useEffect(() => {
    if (!net) return;
    if (net.kind === 'host') {
      net.room.setHandlers({
        onGuestInput: (msg) => {
          remoteInputsRef.current[msg.seatId] = { moveX: msg.moveX, moveY: msg.moveY };
        },
      });
    } else {
      net.room.setHandlers({
        onTick: (msg) => { lastTickRef.current = msg; },
      });
    }
    return () => net.room.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net?.code]);

  useEffect(() => {
    // Each client only ever earns for *its own* seat winning -- a local
    // shared-device guest (no `lokClient` session of its own) still can't
    // earn, since only the device running this effect with `mySeatId`
    // matching the winner calls out. A remote guest is its own signed-in
    // session on its own device, so this generalizes cleanly from the
    // old hardcoded "host only" check.
    if (ended && standings[0]?.id === mySeatId) {
      earnLokTokens('arena_match_win', { refType: 'arena-match', refId: `${area.id}-${Date.now()}` });
    }
    // Deliberately keyed only to `ended`'s false->true transition, not
    // `standings` (which updates every ~100ms while the match is running).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let sizeCheckedAt = 0;
    let hudAt = 0;
    let netInputSentAt = 0;
    let stepsSinceNetTick = 0;
    let view: Viewport = { width: 1, height: 1, dpr: 1 };

    const resize = (): Viewport => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const backingW = Math.max(1, Math.round(width * ratio));
      const backingH = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      return { width, height, dpr: backingW / width };
    };
    view = resize();

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;

      if (time - sizeCheckedAt > 250) {
        sizeCheckedAt = time;
        view = resize();
      }

      const myLocalInput = readArenaInputs(keysRef.current, net ? 1 : seats.length)[0]!;

      if (net?.kind === 'guest' && time - netInputSentAt > NET_INPUT_SEND_MS) {
        netInputSentAt = time;
        net.room.sendInput(myLocalInput);
      }

      if (world.outcome === 'running' && !ended) {
        let host: ArenaMove;
        let guestInputs: ArenaMove[];

        if (net?.kind === 'guest') {
          // Dumb-client: step with whatever the host last broadcast, not
          // this device's own local input -- the host is the single
          // source of truth for everyone's movement, this screen's own
          // key presses are only ever sent upstream, never applied locally.
          const tick = lastTickRef.current;
          host = tick?.inputs[0] ?? { moveX: 0, moveY: 0 };
          guestInputs = seats.slice(1).map((_, i) => tick?.inputs[i + 1] ?? { moveX: 0, moveY: 0 });
        } else if (net?.kind === 'host') {
          host = myLocalInput;
          guestInputs = seats.slice(1).map((seat) => remoteInputsRef.current[seat.id] ?? { moveX: 0, moveY: 0 });
        } else {
          const inputs = readArenaInputs(keysRef.current, seats.length);
          host = inputs[0]!;
          guestInputs = inputs.slice(1);
        }

        accumulator = Math.min(accumulator + dt, FIXED_STEP * MAX_SUBSTEPS);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, {
            moveX: host.moveX,
            moveY: host.moveY,
            ultimate: false,
            audio: SILENT_FRAME,
            guestInputs,
          });
          if (world.outcome !== 'running') break;

          if (net?.kind === 'host') {
            stepsSinceNetTick += 1;
            if (stepsSinceNetTick >= NET_TICK_EVERY_STEPS) {
              stepsSinceNetTick = 0;
              net.room.sendTick({
                inputs: [host, ...guestInputs],
                time: world.time,
                kills: world.kills,
                guestKills: world.guestKills,
                outcome: world.outcome,
              });
            }
          }
        }

        if (world.time >= MATCH_DURATION_SEC) {
          world.outcome = 'cleared';
        }
      }

      // A guest's own local world can diverge slightly from the host's (see
      // the module comment) -- never let that local divergence end the
      // match early/late on this screen. Only the host's broadcast outcome
      // decides "over" for a guest; only this screen's own simulation
      // decides it for the host (and for local-only matches).
      const matchOver = net?.kind === 'guest'
        ? lastTickRef.current !== null && lastTickRef.current.outcome !== 'running'
        : world.outcome !== 'running';
      if (matchOver) setEnded(true);

      renderWorld(ctx, world, view);

      if (time - hudAt > 100) {
        hudAt = time;
        if (net?.kind === 'guest' && lastTickRef.current) {
          const tick = lastTickRef.current;
          const rows: ArenaStanding[] = [
            { id: 'host', name: seats[0]!.character.name, kills: tick.kills, isHost: true },
            ...seats.slice(1).map((seat) => ({
              id: seat.id,
              name: seat.character.name,
              kills: tick.guestKills[seat.id] ?? 0,
              isHost: false,
            })),
          ].sort((a, b) => b.kills - a.kills);
          setStandings(rows);
          setSecondsLeft(Math.max(0, Math.round(MATCH_DURATION_SEC - tick.time)));
        } else {
          setStandings(arenaStandings(world, seats[0]!.character.name));
          setSecondsLeft(Math.max(0, Math.round(MATCH_DURATION_SEC - world.time)));
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, ended, net?.code]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute top-3 right-3 rounded-md bg-black/60 px-3 py-2 font-mono text-xs text-white min-w-[180px]">
        <div className="mb-1 flex items-center justify-between text-white/70">
          <span>LokSurvivorArena{net ? ` · ${net.code}` : ''}</span>
          <span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
        </div>
        {standings.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <span>{i + 1}. {row.name}{row.id === mySeatId ? ' (you)' : ''}</span>
            <span>{row.kills}</span>
          </div>
        ))}
      </div>
      {ended && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white font-mono">
          <div className="text-xl">Match over</div>
          <div>
            {standings[0] ? `${standings[0].name} wins with ${standings[0].kills} kills` : 'No winner'}
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-white/40 px-4 py-2 hover:bg-white/10"
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
}

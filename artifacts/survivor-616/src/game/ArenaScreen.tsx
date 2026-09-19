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
 * Concept-skeleton scope: local multiplayer only. Networking is a later
 * phase -- see `.agents/memory/loksurvivor-arena.md` -- and slots in here by
 * filling `guestInputs` from remote messages instead of `readArenaInputs`,
 * with no other change to this loop.
 */
import { useEffect, useRef, useState } from 'react';

import { SILENT_FRAME } from '@/game/audio/beatBus';
import { stepWorld, type World } from '@/game/engine/world';
import { renderWorld, type Viewport } from '@/game/render/draw';
import { type ArenaSeat, createArenaWorld } from '@/game/arena/arenaWorld';
import { readArenaInputs } from '@/game/arena/arenaInput';
import { arenaStandings, type ArenaStanding } from '@/game/arena/scoreboard';
import type { AreaDef } from '@/game/types';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;
const MATCH_DURATION_SEC = 180;

export interface ArenaScreenProps {
  area: AreaDef;
  seats: ArenaSeat[];
  onExit: () => void;
}

export function ArenaScreen({ area, seats, onExit }: ArenaScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [standings, setStandings] = useState<ArenaStanding[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(MATCH_DURATION_SEC);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    worldRef.current = createArenaWorld(area, seats);
  }, [area, seats]);

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

      if (world.outcome === 'running' && !ended) {
        const inputs = readArenaInputs(keysRef.current, seats.length);
        const host = inputs[0]!;
        const guestInputs = inputs.slice(1);

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
        }

        if (world.time >= MATCH_DURATION_SEC) {
          world.outcome = 'cleared';
        }
      }

      if (world.outcome !== 'running') setEnded(true);

      renderWorld(ctx, world, view);

      if (time - hudAt > 100) {
        hudAt = time;
        setStandings(arenaStandings(world, seats[0]!.character.name));
        setSecondsLeft(Math.max(0, Math.round(MATCH_DURATION_SEC - world.time)));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seats, ended]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute top-3 right-3 rounded-md bg-black/60 px-3 py-2 font-mono text-xs text-white min-w-[180px]">
        <div className="mb-1 flex items-center justify-between text-white/70">
          <span>LokSurvivorArena</span>
          <span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
        </div>
        {standings.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <span>{i + 1}. {row.name}{row.isHost ? ' (you)' : ''}</span>
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

/**
 * A single run: canvas simulation, HUD, touch controls, level-up draft,
 * pause, reel overlay, and the hand-off back to the meta layer when it ends.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getArea } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import {
  applyUpgrade,
  buildResult,
  createWorld,
  hudSnapshot,
  rollUpgradeChoices,
  stepWorld,
  type World,
} from '@/game/engine/world';
import { REEL_FACES, prizeToFaceIndex } from '@/game/data/prizes';
import { renderWorld } from '@/game/render/draw';
import { effectiveStats, useMeta } from '@/game/state/metaStore';
import type { HudSnapshot, LootPrizeDef, RunPhase, RunResult, UpgradeDef } from '@/game/types';
import { Minimap } from '@/ui/Minimap';

export interface RunScreenProps {
  areaId: string;
  characterId: string;
  onAbort: () => void;
  onFinish: (result: RunResult) => void;
}

interface StickState {
  active: boolean;
  pointerId: number | null;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
}

type ReelPhase = 'spinning' | 'landed';

interface ReelState {
  prize: LootPrizeDef;
  phase: ReelPhase;
  faceIndex: number;
}

const STICK_RADIUS = 54;
/** Simulation timestep. */
const FIXED_STEP = 1 / 60;
/** Most catch-up steps allowed in one frame before time is dropped. */
const MAX_SUBSTEPS = 6;

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RunScreen({ areaId, characterId, onAbort, onFinish }: RunScreenProps) {
  const { meta } = useMeta();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const phaseRef = useRef<RunPhase>('countdown');
  const finishedRef = useRef(false);
  const keysRef = useRef(new Set<string>());
  const ultRequestRef = useRef(false);
  const stickRef = useRef<StickState>({
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    dx: 0,
    dy: 0,
  });

  const [phase, setPhase] = useState<RunPhase>('countdown');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [choices, setChoices] = useState<UpgradeDef[]>([]);
  const [stickVisual, setStickVisual] = useState<StickState>(stickRef.current);
  const [dungeonTransition, setDungeonTransition] = useState<'enter' | 'exit' | null>(null);
  const [reel, setReel] = useState<ReelState | null>(null);
  const reelTimerRef = useRef<number | null>(null);

  const area = getArea(areaId);
  const character = getCharacter(characterId);

  const setPhaseBoth = useCallback((next: RunPhase) => {
    // Once a run is over it stays over -- nothing may steal the hand-off.
    if (phaseRef.current === 'over') return;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Build the world once per mount.
  if (worldRef.current === null) {
    worldRef.current = createWorld(area, character, effectiveStats(character, meta));
  }

  /* -------------------------------------------------------------- */
  /* Input                                                           */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
      }
      keysRef.current.add(key);
      if (key === ' ') ultRequestRef.current = true;
      if (key === 'escape' || key === 'p') {
        if (phaseRef.current === 'playing') setPhaseBoth('paused');
        else if (phaseRef.current === 'paused') setPhaseBoth('playing');
      }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const pauseWhenHidden = () => {
      keysRef.current.clear();
      if (phaseRef.current === 'playing') setPhaseBoth('paused');
    };
    const isTouchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    const blur = () => {
      // Mobile browsers can emit window.blur while handling a touch gesture
      // (for example when the browser chrome or an assistive overlay moves).
      // Treating that as an app switch makes the game pause during normal
      // joystick input. Visibility changes still pause when the player truly
      // leaves the game.
      if (!isTouchDevice) pauseWhenHidden();
    };
    const visibilityChange = () => {
      if (document.visibilityState === 'hidden') pauseWhenHidden();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [setPhaseBoth]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'playing') return;
    if (stickRef.current.active) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    const next: StickState = {
      active: true,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      dx: 0,
      dy: 0,
    };
    stickRef.current = next;
    setStickVisual(next);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (!stick.active || stick.pointerId !== event.pointerId) return;
    let dx = event.clientX - stick.originX;
    let dy = event.clientY - stick.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    const next = { ...stick, dx, dy };
    stickRef.current = next;
    setStickVisual(next);
  }, []);

  const endPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (stick.pointerId !== event.pointerId) return;
    const next: StickState = { active: false, pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0 };
    stickRef.current = next;
    setStickVisual(next);
  }, []);

  /* -------------------------------------------------------------- */
  /* Loop                                                            */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let countdownLeft = 1500;
    let sizeCheckedAt = 0;
    let accumulator = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      // Backing store must be whole pixels, so derive the scale from it --
      // comparing against a fractional product never matches.
      const backingW = Math.max(1, Math.round(width * ratio));
      const backingH = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      return { width, height, dpr: backingW / width };
    };

    let view = resize();

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;

      if (time - sizeCheckedAt > 250) {
        sizeCheckedAt = time;
        view = resize();
      }

      if (phaseRef.current === 'countdown') {
        countdownLeft -= dt * 1000;
        if (countdownLeft <= 0) setPhaseBoth('playing');
      } else if (phaseRef.current === 'playing') {
        const keys = keysRef.current;
        let moveX = 0;
        let moveY = 0;
        if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
        if (keys.has('d') || keys.has('arrowright')) moveX += 1;
        if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
        if (keys.has('s') || keys.has('arrowdown')) moveY += 1;

        const stick = stickRef.current;
        if (stick.active && (stick.dx !== 0 || stick.dy !== 0)) {
          moveX = stick.dx / STICK_RADIUS;
          moveY = stick.dy / STICK_RADIUS;
        }

        let ultimate = ultRequestRef.current;
        ultRequestRef.current = false;

        // Fixed-step catch-up: a dropped frame must not slow the run down,
        // but a long stall must not stampede the simulation either.
        accumulator = Math.min(accumulator + dt, FIXED_STEP * MAX_SUBSTEPS);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX, moveY, ultimate });
          ultimate = false;
          if (world.pendingLevelUps > 0 || world.outcome !== 'running') break;
        }

        // Detect dungeon room transitions and briefly flash the screen.
        if (world.endless?.pendingTransition) {
          setDungeonTransition(world.endless.pendingTransition);
          world.endless.pendingTransition = null;
        }

        // Pop a queued loot-box prize and open the reel overlay.
        // Use the dedicated 'reel' phase so Escape/P cannot toggle back to 'playing'.
        if (world.pendingReel.length > 0) {
          const prize = world.pendingReel.shift()!;
          setReel({ prize, phase: 'spinning', faceIndex: prizeToFaceIndex(prize) });
          setPhaseBoth('reel');
        }

        if (world.pendingLevelUps > 0) {
          setChoices(rollUpgradeChoices(world));
          setPhaseBoth('levelup');
        } else if (world.outcome !== 'running') {
          setPhaseBoth('over');
        }
      } else if (phaseRef.current === 'over' && !finishedRef.current) {
        // Let the death or clear beat land before leaving.
        world.now += dt * 1000;
        if (world.outcome === 'dead') {
          world.player.animStartedAt = Math.min(world.player.animStartedAt, world.now);
        }
      }

      renderWorld(ctx, world, view);

      if (time - hudAt > 60) {
        hudAt = time;
        setHud(hudSnapshot(world));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPhaseBoth]);

  // Hand the result back once the closing beat has played.
  useEffect(() => {
    if (phase !== 'over' || finishedRef.current) return;
    const world = worldRef.current;
    if (!world) return;
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinish(buildResult(world));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [phase, onFinish]);

  const pickUpgrade = useCallback(
    (upgrade: UpgradeDef) => {
      const world = worldRef.current;
      if (!world) return;
      applyUpgrade(world, upgrade);
      if (world.pendingLevelUps > 0) {
        setChoices(rollUpgradeChoices(world));
      } else {
        setChoices([]);
        setPhaseBoth(world.outcome === 'running' ? 'playing' : 'over');
      }
    },
    [setPhaseBoth],
  );

  const triggerUltimate = useCallback(() => {
    ultRequestRef.current = true;
  }, []);

  /** Dismiss the reel overlay and resume the run. */
  const dismissReel = useCallback(() => {
    if (reelTimerRef.current !== null) {
      window.clearTimeout(reelTimerRef.current);
      reelTimerRef.current = null;
    }
    setReel(null);
    setPhaseBoth('playing');
  }, [setPhaseBoth]);

  // Auto-land the reel after a short spin, then auto-dismiss.
  useEffect(() => {
    if (!reel) return;
    if (reel.phase === 'spinning') {
      const t = window.setTimeout(() => {
        setReel((prev) => prev ? { ...prev, phase: 'landed' } : null);
        // Auto-dismiss 2s after landing.
        reelTimerRef.current = window.setTimeout(() => {
          setReel(null);
          setPhaseBoth('playing');
        }, 2200);
      }, 1400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [reel?.phase, setPhaseBoth]);

  /** End the run successfully ("head home"). Only available in endless mode. */
  const headHome = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.outcome !== 'running') return;
    world.outcome = 'cleared';
    setPhaseBoth('over');
  }, [setPhaseBoth]);

  // Auto-clear the dungeon transition flash after a short beat.
  useEffect(() => {
    if (!dungeonTransition) return;
    const t = window.setTimeout(() => setDungeonTransition(null), 700);
    return () => window.clearTimeout(t);
  }, [dungeonTransition]);

  const hpPct = hud ? (hud.hp / Math.max(1, hud.maxHp)) * 100 : 100;
  const xpPct = hud ? (hud.xp / Math.max(1, hud.xpToNext)) * 100 : 0;
  const timeLeft = hud && !area.endless ? Math.max(0, hud.durationSec - hud.elapsedSec) : 0;
  const blocksWalked = hud?.endless?.blocksWalked ?? 0;
  const dungeonDepth = hud?.endless?.dungeonDepth ?? 0;
  const inDungeon = hud?.endless?.inDungeon ?? false;
  const dungeonEraName = hud?.endless?.dungeonEraName ?? '';

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black select-none" data-testid="screen-run">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Touch surface: dragging anywhere steers. */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        data-testid="surface-controls"
      />

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 space-y-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-full overflow-hidden rounded-sm border border-black/60 bg-black/60">
              <div
                className="h-full bg-[#ff4d5e] transition-[width] duration-150"
                style={{ width: `${hpPct}%` }}
                data-testid="bar-health"
              />
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm border border-black/60 bg-black/60">
              <div
                className="h-full bg-[#6ee7ff] transition-[width] duration-150"
                style={{ width: `${xpPct}%` }}
                data-testid="bar-xp"
              />
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-white/80">
              <span data-testid="text-level">Lv {hud?.level ?? 1}</span>
              <span data-testid="text-kills">{hud?.kills ?? 0} down</span>
              <span>{area.name}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="rounded-sm border border-white/20 bg-black/70 px-2.5 py-1 font-mono text-lg font-bold text-white tabular-nums" data-testid="text-timer">
              {area.endless ? `${blocksWalked} blk` : formatClock(timeLeft)}
            </div>
            {area.endless && dungeonDepth > 0 && (
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary/80 bg-black/60 px-2 py-0.5 border border-primary/20">
                {inDungeon ? `${dungeonEraName} · room ${hud?.endless?.dungeonRoom ?? 1}/3` : `Depth ${dungeonDepth}`}
              </div>
            )}
            {phase === 'playing' || phase === 'paused' ? (
              <button
                type="button"
                onClick={() => setPhaseBoth(phase === 'playing' ? 'paused' : 'playing')}
                className="pointer-events-auto rounded-sm border border-white/20 bg-black/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white/80"
                data-testid="button-pause"
              >
                {phase === 'paused' ? 'Resume' : 'Pause'}
              </button>
            ) : null}
          </div>
        </div>

        {hud?.rescueAvailable ? (
          <div className="mx-auto w-fit rounded-sm border border-[#ffe08a]/40 bg-black/70 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[#ffe08a]" data-testid="text-rescue">
            Someone is caged — stand with them {hud.rescueProgressPct > 0 ? `(${hud.rescueProgressPct}%)` : ''}
          </div>
        ) : null}

        {hud?.loadout ? (
          <div className="flex gap-1.5 overflow-hidden" data-testid="row-loadout">
            {hud.loadout.weapons.map((weapon) => (
              <div key={weapon.id} title={weapon.name} className="flex h-8 min-w-8 items-center justify-center border border-white/25 bg-black/75 px-1.5 font-mono text-[10px] font-bold text-white" style={{ borderColor: weapon.color ?? 'rgba(255,255,255,.25)' }}>
                {weapon.name.split(' ').map((part) => part[0]).join('').slice(0, 3)}<sup className="ml-0.5 text-primary">{weapon.level}</sup>
              </div>
            ))}
            {hud.loadout.passives.map((passive) => (
              <div key={passive.id} title={passive.name} className="flex h-8 min-w-8 items-center justify-center border border-primary/35 bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
                {passive.name.split(' ').map((part) => part[0]).join('').slice(0, 3)}<sup className="ml-0.5">{passive.stacks}</sup>
              </div>
            ))}
          </div>
        ) : null}

        {hud?.activeEffects && hud.activeEffects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="row-status-effects">
            {hud.activeEffects.map((effect) => (
              <div
                key={effect.id}
                title={`${effect.name}: affecting ${effect.count} enemies`}
                className="flex items-center gap-1 border bg-black/75 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide"
                style={{ borderColor: `${effect.color}99`, color: effect.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: effect.color, boxShadow: `0 0 7px ${effect.color}` }} />
                {effect.name} <span className="opacity-70">×{effect.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {hud?.alerts.slice(-1).map((alert) => (
          <div key={alert} className="mx-auto w-fit font-mono text-sm uppercase tracking-[0.25em] text-white/90 drop-shadow">
            {alert}
          </div>
        ))}

        {/* Objective strip */}
        {hud && hud.objectives.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="row-objectives">
            {hud.objectives.filter((o) => !o.completed).map((obj) => {
              const pct = Math.min(100, Math.round((obj.progress / Math.max(1, obj.target)) * 100));
              return (
                <div key={obj.label} className="flex items-center gap-1.5 rounded-sm border border-amber-800/40 bg-black/70 px-2 py-0.5">
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-amber-300/80 truncate max-w-[110px]">{obj.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {area.endless && hud?.endless ? <Minimap map={hud.endless} /> : null}

      {/* Ultimate */}
      <button
        type="button"
        onClick={triggerUltimate}
        disabled={(hud?.ultimateReadyPct ?? 0) < 100}
        className="absolute bottom-8 right-6 h-20 w-20 rounded-full border-2 border-white/25 bg-black/70 font-mono text-[10px] uppercase leading-tight tracking-widest text-white disabled:opacity-45"
        style={{
          background:
            hud && hud.ultimateReadyPct >= 100
              ? `radial-gradient(circle, ${character.palette.accent}55, rgba(0,0,0,0.75))`
              : `conic-gradient(${character.palette.accent}88 ${(hud?.ultimateReadyPct ?? 0) * 3.6}deg, rgba(0,0,0,0.75) 0deg)`,
        }}
        data-testid="button-ultimate"
      >
        {hud?.ultimateActive ? 'Active' : hud && hud.ultimateReadyPct >= 100 ? character.ultimate.name : `${Math.floor(hud?.ultimateReadyPct ?? 0)}%`}
      </button>

      {/* Virtual stick */}
      {stickVisual.active ? (
        <div
          className="pointer-events-none absolute rounded-full border border-white/25"
          style={{
            width: STICK_RADIUS * 2,
            height: STICK_RADIUS * 2,
            left: stickVisual.originX - STICK_RADIUS,
            top: stickVisual.originY - STICK_RADIUS,
          }}
        >
          <div
            className="absolute rounded-full bg-white/30"
            style={{
              width: 44,
              height: 44,
              left: STICK_RADIUS - 22 + stickVisual.dx,
              top: STICK_RADIUS - 22 + stickVisual.dy,
            }}
          />
        </div>
      ) : null}

      {/* Countdown */}
      {phase === 'countdown' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/60">{area.district}</p>
          <h2 className="mt-2 text-4xl font-black uppercase text-white">{area.name}</h2>
          <p className="mt-3 max-w-xs px-6 font-mono text-xs text-white/60">
            {area.endless
              ? 'Walk. Find the stairs down. Head home when you\'re done.'
              : `Survive ${Math.round(area.durationSec)} seconds. Drag anywhere to move.`}
          </p>
        </div>
      ) : null}

      {/* Level up */}
      {phase === 'levelup' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-5" data-testid="overlay-levelup">
          <div className="w-full max-w-md space-y-3">
            <p className="text-center font-mono text-xs uppercase tracking-[0.4em] text-white/60">Level {hud?.level}</p>
            <h2 className="text-center text-2xl font-black uppercase text-white">Pick your edge</h2>
            <div className="space-y-2">
              {choices.map((upgrade) => (
                <button
                  key={upgrade.id}
                  type="button"
                  onClick={() => pickUpgrade(upgrade)}
                  className="w-full rounded-sm border border-white/20 bg-white/5 p-4 text-left transition hover:border-white/60 hover:bg-white/10 active:scale-[0.99]"
                  data-testid={`button-upgrade-${upgrade.id}`}
                >
                  <p className="font-bold uppercase tracking-wide text-white">{upgrade.name}</p>
                  <p className="mt-1 font-mono text-xs text-white/70">{upgrade.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Pause */}
      {phase === 'paused' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6" data-testid="overlay-paused">
          <div className="w-full max-w-xs space-y-3 text-center">
            <h2 className="text-2xl font-black uppercase text-white">Paused</h2>
            <p className="font-mono text-xs text-white/60">
              WASD or arrows to move. Space for {character.ultimate.name}.
            </p>
            <button
              type="button"
              onClick={() => setPhaseBoth('playing')}
              className="w-full rounded-sm border border-white/25 bg-white/10 px-4 py-3 font-bold uppercase tracking-widest text-white"
              data-testid="button-resume"
            >
              Resume
            </button>
            {area.endless && (
              <button
                type="button"
                onClick={headHome}
                className="w-full rounded-sm border border-primary/50 bg-primary/10 px-4 py-3 font-bold uppercase tracking-widest text-primary"
                data-testid="button-head-home"
              >
                Head home
              </button>
            )}
            <button
              type="button"
              onClick={onAbort}
              className="w-full rounded-sm border border-white/15 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white/70"
              data-testid="button-abandon"
            >
              Abandon run
            </button>
          </div>
        </div>
      ) : null}

      {/* Loot box reel overlay */}
      {reel ? (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/92"
          data-testid="overlay-reel"
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">Blue Box</p>
          <h2 className="mb-6 text-2xl font-black uppercase tracking-widest text-blue-300">
            {reel.phase === 'spinning' ? 'Spinning...' : 'You got'}
          </h2>

          {/* Reel strip — 3 faces scroll, then land */}
          <div className="mb-6 flex gap-3">
            {[0, 1, 2].map((col) => {
              const landed = reel.phase === 'landed';
              const face = landed ? REEL_FACES[reel.faceIndex] : REEL_FACES[(reel.faceIndex + col + 1) % REEL_FACES.length];
              return (
                <div
                  key={col}
                  className="flex h-24 w-20 flex-col items-center justify-center border-2 bg-black/80 font-black text-4xl transition-all duration-500"
                  style={{
                    borderColor: landed ? (face?.color ?? '#3b82f6') : '#334155',
                    color: landed ? (face?.color ?? '#3b82f6') : '#94a3b8',
                    boxShadow: landed ? `0 0 24px ${face?.color ?? '#3b82f6'}66` : 'none',
                  }}
                >
                  {landed ? face?.symbol : REEL_FACES[(Math.floor(Date.now() / 120 + col) % REEL_FACES.length)]?.symbol ?? '?'}
                  {landed && (
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-widest opacity-70">
                      {face?.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {reel.phase === 'landed' ? (
            <div className="mb-6 text-center">
              <p
                className="text-3xl font-black uppercase tracking-wide"
                style={{ color: REEL_FACES[reel.faceIndex]?.color ?? '#3b82f6' }}
              >
                {reel.prize.label}
              </p>
              <p className="mt-1 font-mono text-xs text-white/40">already applied — you keep it</p>
            </div>
          ) : (
            <div className="mb-6 h-12" />
          )}

          <button
            type="button"
            onClick={dismissReel}
            className="border border-white/20 bg-white/5 px-8 py-3 font-mono text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
            data-testid="button-reel-skip"
          >
            {reel.phase === 'landed' ? 'Continue' : 'Skip'}
          </button>
        </div>
      ) : null}

      {/* Dungeon transition flash */}
      {dungeonTransition ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/80">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/70">
            {dungeonTransition === 'enter' ? 'Going down...' : 'Back on the block'}
          </p>
        </div>
      ) : null}

      {/* Outcome */}
      {phase === 'over' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
          <h2 className="text-4xl font-black uppercase tracking-widest text-white drop-shadow" data-testid="text-outcome">
            {worldRef.current?.outcome === 'cleared' ? 'Block cleared' : 'Down'}
          </h2>
        </div>
      ) : null}
    </div>
  );
}

export default RunScreen;

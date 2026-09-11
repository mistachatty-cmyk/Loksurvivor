/**
 * Attract mode: a bot-piloted run of the real simulation, played behind the
 * intro screen while nobody's touching the controls yet.
 *
 * This intentionally reuses the exact engine a real run uses --
 * `createWorld` / `stepWorld` / `renderWorld` from `game/engine/world` and
 * `game/render/draw` -- rather than a separate fake renderer. That keeps it
 * truthful to what the game actually looks like today and means it can
 * never drift out of sync with balance, content, or visual changes; it also
 * means every character, weapon, and area the roster ships is automatically
 * eligible for a scene with zero extra authoring.
 *
 * Scenes rotate on their own: pick a random character + random area, let a
 * lightweight steering bot play it until it dies or clears, then start a
 * new one. Level-ups are resolved immediately with a random upgrade (same
 * pattern as the `random-live` presentation option in `RunScreen`) so the
 * run never stalls waiting on input that will never come.
 *
 * Zone: basement/front-door presentation layer, not the protected baseline.
 * It shares the world/render contracts read-only and never touches saved
 * progression, meta state, or account data -- turning it off, or deleting
 * this file, changes nothing else about the game.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

import { SILENT_FRAME } from '@/game/audio/beatBus';
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import {
  applyUpgrade,
  createWorld,
  rollUpgradeChoices,
  stepWorld,
  type EnemyActor,
  type Pickup,
  type World,
} from '@/game/engine/world';
import { renderWorld, type Viewport } from '@/game/render/draw';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;
const STORAGE_KEY = 'survivor616.attractMode';
const SCENE_RESTART_DELAY_MS = 2200;
const ULTIMATE_ATTEMPT_INTERVAL_MS = 3000;
const KITE_RADIUS = 100;
const ENGAGE_RADIUS = 340;
const EDGE_MARGIN = 80;

interface BotState {
  wanderAngle: number;
  nextUltimateAt: number;
}

/** Uniformly random scene, nudged away from repeating the immediately previous pick. */
function pickScene(previousCharacterId?: string, previousAreaId?: string) {
  const characterPool = CHARACTERS.length > 1 ? CHARACTERS.filter((c) => c.id !== previousCharacterId) : CHARACTERS;
  const areaPool = AREAS.length > 1 ? AREAS.filter((a) => a.id !== previousAreaId) : AREAS;
  const character = characterPool[Math.floor(Math.random() * characterPool.length)];
  const area = areaPool[Math.floor(Math.random() * areaPool.length)];
  return { character, area };
}

function nearestOf<T extends { x: number; y: number }>(
  items: T[],
  fromX: number,
  fromY: number,
): { item: T; distSq: number } | null {
  let best: { item: T; distSq: number } | null = null;
  for (const item of items) {
    const dx = item.x - fromX;
    const dy = item.y - fromY;
    const distSq = dx * dx + dy * dy;
    if (!best || distSq < best.distSq) best = { item, distSq };
  }
  return best;
}

/**
 * Chase the nearest living enemy at a readable mid-range, back off and
 * strafe when something gets too close, drift toward loose XP when the
 * screen is briefly clear, and wander with smooth noise otherwise. Movement
 * is the only thing this bot drives -- attacks fire on their own cooldowns
 * exactly like a real run, so this stays a steering problem, not a combat AI.
 */
function computeBotMove(world: World, bot: BotState, dt: number): { moveX: number; moveY: number } {
  const player = world.player;
  const liveEnemies = world.enemies.filter(
    (enemy: EnemyActor) => !enemy.dying && world.now >= enemy.invisibleUntil,
  );
  const nearestEnemy = nearestOf(liveEnemies, player.x, player.y);

  let dirX = 0;
  let dirY = 0;

  if (nearestEnemy) {
    const dist = Math.sqrt(nearestEnemy.distSq) || 1;
    const dx = (nearestEnemy.item.x - player.x) / dist;
    const dy = (nearestEnemy.item.y - player.y) / dist;
    if (dist < KITE_RADIUS) {
      dirX = -dx + dy * 0.6;
      dirY = -dy - dx * 0.6;
    } else if (dist > ENGAGE_RADIUS) {
      dirX = dx;
      dirY = dy;
    } else {
      dirX = dy;
      dirY = -dx;
    }
  } else {
    const nearestPickup = nearestOf(world.pickups as Pickup[], player.x, player.y);
    if (nearestPickup) {
      const dist = Math.sqrt(nearestPickup.distSq) || 1;
      dirX = (nearestPickup.item.x - player.x) / dist;
      dirY = (nearestPickup.item.y - player.y) / dist;
    } else {
      bot.wanderAngle += (Math.random() - 0.5) * dt * 2.4;
      dirX = Math.cos(bot.wanderAngle);
      dirY = Math.sin(bot.wanderAngle);
    }
  }

  const bounds = world.bounds;
  if (Number.isFinite(bounds.w) && Number.isFinite(bounds.h)) {
    if (player.x > bounds.w - EDGE_MARGIN) dirX = Math.min(dirX, 0);
    if (player.x < -bounds.w + EDGE_MARGIN) dirX = Math.max(dirX, 0);
    if (player.y > bounds.h - EDGE_MARGIN) dirY = Math.min(dirY, 0);
    if (player.y < -bounds.h + EDGE_MARGIN) dirY = Math.max(dirY, 0);
  }

  const len = Math.hypot(dirX, dirY) || 1;
  return { moveX: dirX / len, moveY: dirY / len };
}

export interface AttractModeProps {
  className?: string;
}

/** Full-bleed background layer: mount behind intro/menu copy, e.g. as the first child of a `relative` container. */
export function AttractMode({ className }: AttractModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const botRef = useRef<BotState>({ wanderAngle: Math.random() * Math.PI * 2, nextUltimateAt: 0 });
  const sceneRef = useRef<{ characterId?: string; areaId?: string }>({});

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  });

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  }, [enabled]);

  useEffect(() => {
    if (!enabled || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let cancelled = false;
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let sizeCheckedAt = 0;
    let restartAt = 0;
    let view: Viewport = { width: 1, height: 1, dpr: 1 };

    const resize = (): Viewport => {
      // Attract mode never needs to be pin-sharp -- capping dpr lower than a
      // real run keeps a decorative background cheap on phones.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
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

    const startScene = () => {
      const { character, area } = pickScene(sceneRef.current.characterId, sceneRef.current.areaId);
      sceneRef.current = { characterId: character.id, areaId: area.id };
      worldRef.current = createWorld(area, character, character.stats, Math.floor(Math.random() * 1_000_000));
      botRef.current = { wanderAngle: Math.random() * Math.PI * 2, nextUltimateAt: 0 };
    };

    startScene();
    view = resize();

    const frame = (time: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;

      if (time - sizeCheckedAt > 500) {
        sizeCheckedAt = time;
        view = resize();
      }

      const world = worldRef.current;
      if (!world) return;

      if (world.outcome !== 'running') {
        // Let the death/clear beat land on screen for a moment, same as a
        // real run does, before cutting to the next scene.
        if (!restartAt) restartAt = time + SCENE_RESTART_DELAY_MS;
        if (time >= restartAt) {
          restartAt = 0;
          startScene();
        }
      } else {
        const { moveX, moveY } = computeBotMove(world, botRef.current, dt);
        let ultimate = false;
        if (time >= botRef.current.nextUltimateAt) {
          ultimate = true;
          botRef.current.nextUltimateAt = time + ULTIMATE_ATTEMPT_INTERVAL_MS;
        }

        accumulator = Math.min(accumulator + dt, FIXED_STEP * MAX_SUBSTEPS);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX, moveY, ultimate, audio: SILENT_FRAME });
          ultimate = false;
          if (world.outcome !== 'running') break;
          if (world.pendingLevelUps > 0) {
            const choices = rollUpgradeChoices(world);
            const pick = choices[Math.floor(world.rng() * choices.length)] ?? choices[0];
            if (pick) applyUpgrade(world, pick);
          }
        }
      }

      renderWorld(ctx, world, view);
    };

    raf = requestAnimationFrame(frame);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, reducedMotion]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ''}`}>
      <AnimatePresence>
        {enabled && !reducedMotion && (
          <motion.canvas
            key="attract-canvas"
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full"
            data-testid="attract-mode-canvas"
          />
        )}
      </AnimatePresence>

      {/* Dim + soft blur so the sim reads as atmosphere and never competes with copy above it. */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] pointer-events-none" />

      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        aria-pressed={enabled}
        aria-label={enabled ? 'Turn off background gameplay' : 'Turn on background gameplay'}
        data-testid="button-attract-mode-toggle"
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 hover:text-white/90 hover:border-white/30 transition-colors"
      >
        {enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        {enabled ? 'Live feed' : 'Feed off'}
      </button>
    </div>
  );
}

export default AttractMode;

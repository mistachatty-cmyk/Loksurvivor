/**
 * Coach cards for the first-match tutorial (steps are authored in `game/data/tutorial.ts`).
 * It only watches the world a few times a second and shows one card at a time; it never pauses, never
 * blocks the controls (only its own Skip button takes taps) and costs nothing when the tutorial is off.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpCircle, Check, Flag, Gem, Move, PawPrint, Swords, Zap, type LucideIcon } from 'lucide-react';

import {
  nextApplicableStep,
  TUTORIAL_DONE_FLASH_MS,
  TUTORIAL_MIN_SHOW_MS,
  TUTORIAL_STEPS,
  type TutorialSnapshot,
  type TutorialStepId,
} from '@/game/data/tutorial';
import type { World } from '@/game/engine/world';
import { useT, type MessageKey } from '@/lib/i18n';

const ICONS: Record<TutorialStepId, LucideIcon> = {
  move: Move,
  fight: Swords,
  gems: Gem,
  pet: PawPrint,
  dash: Zap,
  level: ArrowUpCircle,
  survive: Flag,
};

const TICK_MS = 200;

function snapshotOf(world: World, start: { x: number; y: number }): TutorialSnapshot {
  return {
    distance: Math.hypot(world.player.x - start.x, world.player.y - start.y),
    kills: world.kills,
    level: world.level,
    xp: world.xp,
    dashed: world.player.dashStartedAt > 0,
    hasDash: world.dashSkill != null,
    hasPet: world.lokPets.length > 0,
  };
}

export function RunTutorial({ worldRef, onDone }: { worldRef: MutableRefObject<World | null>; onDone: () => void }) {
  const t = useT();
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const [index, setIndex] = useState<number | null>(null);
  const [finishedStep, setFinishedStep] = useState(false);
  const stateRef = useRef({ index: -1, shownAt: 0, doneAt: 0, start: null as { x: number; y: number } | null });

  useEffect(() => {
    const state = stateRef.current;
    const timer = window.setInterval(() => {
      const world = worldRef.current;
      if (!world || document.hidden) return;
      if (!state.start) state.start = { x: world.player.x, y: world.player.y };
      const snapshot = snapshotOf(world, state.start);
      if (state.index < 0) {
        state.index = nextApplicableStep(0, snapshot);
        state.shownAt = world.now;
        setIndex(state.index);
        return;
      }
      const step = TUTORIAL_STEPS[state.index];
      if (!step) return;
      const shown = world.now - state.shownAt;
      if (state.doneAt === 0) {
        if (shown >= TUTORIAL_MIN_SHOW_MS && step.done(snapshot, shown)) {
          state.doneAt = world.now;
          setFinishedStep(true);
        }
        return;
      }
      if (world.now - state.doneAt >= TUTORIAL_DONE_FLASH_MS) {
        state.index = nextApplicableStep(state.index + 1, snapshot);
        state.shownAt = world.now;
        state.doneAt = 0;
        setFinishedStep(false);
        if (state.index >= TUTORIAL_STEPS.length) {
          window.clearInterval(timer);
          setIndex(null);
          onDone();
        } else {
          setIndex(state.index);
        }
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [worldRef, onDone]);

  const step = index === null ? null : TUTORIAL_STEPS[index];
  if (!step) return null;
  const Icon = ICONS[step.id];
  const suffix = step.controlSpecific ? (coarse ? '.touch' : '.desktop') : '';
  const stepNumber = TUTORIAL_STEPS.slice(0, index ?? 0).length + 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top,0px)+6.4rem)] z-[60] flex justify-center px-3" data-testid="run-tutorial">
      <AnimatePresence mode="wait">
        <motion.section
          key={step.id}
          initial={{ opacity: 0, y: -14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className={`w-full max-w-sm border bg-slate-950/92 p-3 shadow-[0_8px_30px_rgba(0,0,0,.55)] backdrop-blur ${finishedStep ? 'border-emerald-300/70' : 'border-cyan-200/45'}`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center border ${finishedStep ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-200' : 'border-cyan-200/40 bg-cyan-400/10 text-cyan-100'}`}>
              {finishedStep ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-200/80">
                {t('tutorial.kicker', { n: String(stepNumber), total: String(TUTORIAL_STEPS.length) })}
              </p>
              <h2 className="mt-0.5 text-sm font-black uppercase tracking-wide text-white">{t(`tutorial.${step.id}.title` as MessageKey)}</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/75">{t(`tutorial.${step.id}.body${suffix}` as MessageKey)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex gap-1" aria-hidden="true">
              {TUTORIAL_STEPS.map((candidate, i) => (
                <span key={candidate.id} className={`h-1 w-4 ${i < (index ?? 0) ? 'bg-emerald-300' : i === index ? 'bg-cyan-200' : 'bg-white/20'}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={onDone}
              className="pointer-events-auto min-h-9 px-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white"
              data-testid="button-tutorial-skip"
            >
              {t('tutorial.skip')}
            </button>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

export default RunTutorial;

/**
 * The first-match tutorial on Monroe Strip. Authored as data: each step says when it applies, what it
 * watches for, and (in en.json under `tutorial.<id>.*`) what it says. The run screen only reads the
 * simulation and shows these cards; it never changes how the fight plays.
 */
export type TutorialStepId = 'move' | 'fight' | 'gems' | 'pet' | 'dash' | 'level' | 'survive';

export interface TutorialSnapshot {
  /** Straight-line distance walked away from the start, in world px. */
  distance: number;
  kills: number;
  level: number;
  xp: number;
  dashed: boolean;
  hasDash: boolean;
  hasPet: boolean;
}

export interface TutorialStep {
  id: TutorialStepId;
  /** The step is skipped when this is false (no dash on this character, no companion, ...). */
  applies: (snapshot: TutorialSnapshot) => boolean;
  /** True once the player has done the thing; `shownMs` is how long the card has been up. */
  done: (snapshot: TutorialSnapshot, shownMs: number) => boolean;
  /** Controls differ between touch and keyboard for these. */
  controlSpecific?: boolean;
}

/** A card always stays up at least this long, so it can be read even if the player already did the thing. */
export const TUTORIAL_MIN_SHOW_MS = 2200;
/** Pause on a finished card before the next one, so the player sees the step land. */
export const TUTORIAL_DONE_FLASH_MS = 800;

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'move', controlSpecific: true, applies: () => true, done: (s) => s.distance >= 140 },
  { id: 'fight', applies: () => true, done: (s) => s.kills >= 3 },
  { id: 'gems', applies: () => true, done: (s) => s.level > 1 || s.xp > 0 },
  { id: 'pet', applies: (s) => s.hasPet, done: (_s, shownMs) => shownMs >= 6500 },
  { id: 'dash', controlSpecific: true, applies: (s) => s.hasDash, done: (s) => s.dashed },
  { id: 'level', applies: () => true, done: (s, shownMs) => s.level > 1 && shownMs >= 4000 },
  { id: 'survive', applies: () => true, done: (_s, shownMs) => shownMs >= 9000 },
];

/** Index of the first step at or after `from` that applies to this run; `TUTORIAL_STEPS.length` when none are left. */
export function nextApplicableStep(from: number, snapshot: TutorialSnapshot): number {
  let index = from;
  while (index < TUTORIAL_STEPS.length && !TUTORIAL_STEPS[index]!.applies(snapshot)) index += 1;
  return index;
}

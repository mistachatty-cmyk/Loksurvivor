// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Limited time events: a ladder of steps with locks, judged on SERVER time.
 *
 * Every function takes `serverNow` (epoch ms from the server). Never pass the
 * device clock, or a player could change their phone time to stretch an event.
 * Events are data (see EventDef), so a new event needs no app update.
 *
 * Framework-free and dependency-free, like the rest of the SDK.
 */

export interface EventStep { id: string; target: number; reward: number; text: string }

export interface EventDef {
  id: string;
  startsAt: number;
  endsAt: number;
  steps: EventStep[];
  /** How long after the end a player may still claim steps they had already completed. Default 24 hours. */
  claimGraceMs?: number;
}

export interface EventProgress {
  /** Index of the step currently open (steps before it are claimed). */
  step: number;
  /** Progress inside the open step. */
  progress: number;
}

export type EventStatus = "upcoming" | "live" | "ended";

export const newEventProgress = (): EventProgress => ({ step: 0, progress: 0 });

export function eventStatus(e: EventDef, serverNow: number): EventStatus {
  return serverNow < e.startsAt ? "upcoming" : serverNow < e.endsAt ? "live" : "ended";
}

/** Milliseconds left in the event (0 once ended). */
export const eventTimeLeft = (e: EventDef, serverNow: number): number => Math.max(0, e.endsAt - serverNow);

/** State of each step for display: claimed steps, the open step, and locked steps. */
export function stepStates(e: EventDef, p: EventProgress): Array<"claimed" | "open" | "locked"> {
  return e.steps.map((_, i) => (i < p.step ? "claimed" : i === p.step ? "open" : "locked"));
}

/** Add progress to the open step while the event is live. Progress stops at the target. */
export function addEventProgress(e: EventDef, p: EventProgress, amount: number, serverNow: number): EventProgress {
  if (eventStatus(e, serverNow) !== "live" || p.step >= e.steps.length) return p;
  return { ...p, progress: Math.min(e.steps[p.step].target, Math.max(0, p.progress + amount)) };
}

/**
 * Claim the open step if it is complete. Allowed while live, and for a grace
 * period after the end so a finished step is never lost to the clock.
 * Returns null if not allowed. Opens the next step with zero progress.
 */
export function claimStep(e: EventDef, p: EventProgress, serverNow: number): { progress: EventProgress; reward: number } | null {
  if (p.step >= e.steps.length || eventStatus(e, serverNow) === "upcoming") return null;
  if (serverNow >= e.endsAt + (e.claimGraceMs ?? 86400000)) return null;
  const step = e.steps[p.step];
  if (p.progress < step.target) return null;
  return { progress: { step: p.step + 1, progress: 0 }, reward: step.reward };
}

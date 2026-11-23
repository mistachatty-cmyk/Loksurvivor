// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok onboarding: a small, framework-free registry of "steps" every platform
 * plugs its own screens into. The standard is docs/LOK_ONBOARDING_STANDARD.md.
 *
 * Idea: a game declares an ordered list of steps (welcome, first play, pick a
 * look, account invitation, tutorial, ...). This file only answers two
 * questions, with no UI and no storage of its own:
 *   - which step is next for this player? (`nextOnboardingStep`)
 *   - how do I record that a step was done or skipped? (`markOnboardingStep`)
 * The game keeps the returned `OnboardingState` in its own save and, for
 * signed-in players, in the shared save slice named `onboarding`.
 *
 * Adding a feature announcement later = adding one more step (kind "feature").
 * Nothing else changes.
 */

/** Where a step sits in the journey. Order of kinds is the order players meet them. */
export type OnboardingKind =
  | "notice" //   photosensitivity, honest label (S9), legal links: always first, once
  | "welcome" //  story hook, who you are, what this place is
  | "first-play" // a real first moment of play, before any account question
  | "choice" //   pick a side / starter / look
  | "account" //  guest-first invitation to make or link a Lok account
  | "tutorial" //  optional, skippable, resumable guided practice
  | "feature"; // anything added later: a one-time introduction of a new feature

const KIND_ORDER: OnboardingKind[] = ["notice", "welcome", "first-play", "choice", "account", "tutorial", "feature"];

export type OnboardingStepDef = {
  /** Stable id, kebab-case, unique per platform, e.g. "starter-pet". Never reuse an id. */
  id: string;
  kind: OnboardingKind;
  /** Bump when the step's content changes enough that players should see it again. */
  version: number;
  /** Steps that must be finished (done or skipped) before this one can show. */
  after?: string[];
  /** False means the player may never skip it (notices only). Default true. */
  skippable?: boolean;
  /** Lower comes first among steps of the same kind. Default 0. */
  priority?: number;
  /** Games decide with their own state, e.g. "already has an account" or "second run or later". */
  when?: (ctx: OnboardingStepContext) => boolean;
};

export type OnboardingStepContext = {
  /** Signed in to a Lok account right now. */
  signedIn: boolean;
  /** Number of runs / matches / sessions finished on this device. */
  sessions: number;
  /** A modal or full-screen step is allowed right now (not mid-fight, not on a loading screen). */
  canInterrupt: boolean;
  /** Games may add their own flags; steps read them in `when`. */
  [flag: string]: unknown;
};

export type OnboardingRecord = {
  version: number;
  how: "done" | "skipped";
  /** Epoch milliseconds. */
  at: number;
};

export type OnboardingState = {
  schema: 1;
  steps: Record<string, OnboardingRecord>;
};

export const EMPTY_ONBOARDING_STATE: OnboardingState = { schema: 1, steps: {} };

function isFinished(state: OnboardingState, def: OnboardingStepDef): boolean {
  const record = state.steps[def.id];
  return !!record && record.version >= def.version;
}

/** Defensive read of a saved value (localStorage / cloud slice). Bad data becomes an empty state. */
export function normalizeOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") return { schema: 1, steps: {} };
  const steps = (raw as { steps?: unknown }).steps;
  if (!steps || typeof steps !== "object") return { schema: 1, steps: {} };
  const out: Record<string, OnboardingRecord> = {};
  for (const [id, value] of Object.entries(steps as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<OnboardingRecord>;
    if (typeof v.version !== "number" || !Number.isFinite(v.version)) continue;
    if (v.how !== "done" && v.how !== "skipped") continue;
    out[id] = { version: v.version, how: v.how, at: typeof v.at === "number" && Number.isFinite(v.at) ? v.at : 0 };
  }
  return { schema: 1, steps: out };
}

/**
 * Merge two states (this device + the account's cloud copy) so a new device
 * does not teach the same thing twice. For each step the higher version wins,
 * and on a tie the later timestamp wins.
 */
export function mergeOnboardingStates(a: OnboardingState, b: OnboardingState): OnboardingState {
  const steps: Record<string, OnboardingRecord> = { ...a.steps };
  for (const [id, rb] of Object.entries(b.steps)) {
    const ra = steps[id];
    if (!ra || rb.version > ra.version || (rb.version === ra.version && rb.at > ra.at)) steps[id] = rb;
  }
  return { schema: 1, steps };
}

export function markOnboardingStep(
  state: OnboardingState,
  def: Pick<OnboardingStepDef, "id" | "version">,
  how: "done" | "skipped",
  now: number,
): OnboardingState {
  return { schema: 1, steps: { ...state.steps, [def.id]: { version: def.version, how, at: now } } };
}

/** Throws on a mistake in a platform's step list (duplicate ids, unknown `after`, cycles). Call it in a unit test. */
export function validateOnboardingSteps(defs: OnboardingStepDef[]): void {
  const ids = new Set<string>();
  for (const def of defs) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(def.id)) throw new Error(`onboarding step id "${def.id}" must be kebab-case`);
    if (ids.has(def.id)) throw new Error(`duplicate onboarding step id "${def.id}"`);
    ids.add(def.id);
    if (def.kind === "notice" && def.skippable === true) throw new Error(`notice "${def.id}" cannot be skippable`);
  }
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const def of defs) {
    for (const dep of def.after ?? []) if (!byId.has(dep)) throw new Error(`step "${def.id}" comes after unknown step "${dep}"`);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(`onboarding steps form a loop at "${id}"`);
    visiting.add(id);
    for (const dep of byId.get(id)?.after ?? []) visit(dep);
    visiting.delete(id);
    done.add(id);
  };
  for (const def of defs) visit(def.id);
}

/**
 * The one step to show now, or null. Rules:
 *  - never when the game cannot be interrupted;
 *  - skips finished steps (same or newer version recorded);
 *  - a step waits for everything in `after`;
 *  - `when` can hold a step back (e.g. the account invitation only after the first reward);
 *  - at most ONE step at a time, ordered by kind, then priority, then list order, so a new
 *    "feature" step can never jump ahead of the welcome or the account invitation.
 */
export function nextOnboardingStep(
  defs: OnboardingStepDef[],
  state: OnboardingState,
  ctx: OnboardingStepContext,
): OnboardingStepDef | null {
  if (!ctx.canInterrupt) return null;
  const byId = new Map(defs.map((d) => [d.id, d]));
  const eligible = defs
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => !isFinished(state, def))
    .filter(({ def }) => (def.after ?? []).every((id) => { const dep = byId.get(id); return !dep || isFinished(state, dep); }))
    .filter(({ def }) => (def.when ? def.when(ctx) : true));
  eligible.sort((x, y) => {
    const k = KIND_ORDER.indexOf(x.def.kind) - KIND_ORDER.indexOf(y.def.kind);
    if (k !== 0) return k;
    const p = (x.def.priority ?? 0) - (y.def.priority ?? 0);
    return p !== 0 ? p : x.index - y.index;
  });
  return eligible[0]?.def ?? null;
}

/** Steps still waiting, for a "what's next" checklist chip on the home screen. */
export function pendingOnboardingSteps(defs: OnboardingStepDef[], state: OnboardingState): OnboardingStepDef[] {
  return defs.filter((def) => !isFinished(state, def));
}

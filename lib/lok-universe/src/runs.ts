// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Runs: seeded weekly runs, opt-in input recording, and score checking.
 *
 * Idea (docs/LOK_RETENTION_BUILD_PLAN.md section 4): if a game is deterministic
 * from a seed, the list of player inputs is enough to replay the run, draw a
 * ghost, and prove the score. A game ships its rules once as a `RunRules`
 * object; the game uses it to play and the server uses the same code to check.
 *
 * Recording is opt-in by construction: `createRecorder` returns null unless the
 * player turned recording on, so a game cannot record by accident.
 * Only inputs and their timing are kept. No screen, camera, microphone or chat.
 *
 * Framework-free and dependency-free, like the rest of the SDK.
 */

/** One player input. `t` is milliseconds since the run started. Games add their own fields (x, y, key...). */
export interface RunInput { t: number; [field: string]: number | string | boolean | undefined }

export interface RunTrace {
  v: 1;
  game: string;
  /** Game rules version. A trace only verifies against the same version. */
  version: string;
  seed: number;
  durationMs: number;
  inputs: RunInput[];
}

/** The game's deterministic rules. Must use only `seed` for randomness and must not read the clock. */
export interface RunRules<S> {
  init(seed: number): S;
  apply(state: S, input: RunInput): S;
  score(state: S): number;
  /** Upper limit on inputs in one run (default 5000). */
  maxInputs?: number;
}

export type VerifyReason = "bad_trace" | "too_many_inputs" | "bad_time" | "score_mismatch";
export interface VerifyResult { ok: boolean; score: number; reason?: VerifyReason }

/** Small seeded random generator (mulberry32). Same seed gives the same sequence on every device. */
export function seededRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO week id such as "2026-W48" for a time in ms (UTC). */
export function isoWeekId(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / 86400000 / 7) + 1;
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Deterministic seed for a game in a given week. Real seeds should still be published by the server; this is for local and test use. */
export function weekSeed(ms: number, gameKey: string): number {
  const id = `${gameKey}:${isoWeekId(ms)}`;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Recorder {
  /** Add an input at time `now` (ms, same clock as `start`). */
  push(input: Omit<RunInput, "t">, now: number): void;
  /** End the run and return the trace. */
  finish(): RunTrace;
}

/**
 * Create a recorder, or null when the player has not opted in.
 * `start` is the clock value when the run began.
 */
export function createRecorder(opts: { enabled: boolean; game: string; version: string; seed: number; start: number; durationMs: number }): Recorder | null {
  if (!opts.enabled) return null;
  const inputs: RunInput[] = [];
  return {
    push(input, now) { inputs.push({ ...input, t: Math.max(0, Math.round(now - opts.start)) } as RunInput); },
    finish() { return { v: 1, game: opts.game, version: opts.version, seed: opts.seed, durationMs: opts.durationMs, inputs: inputs.slice() }; },
  };
}

/** Replay a trace through the rules and return the final state. Inputs are applied in time order. */
export function replayTrace<S>(rules: RunRules<S>, trace: RunTrace): S {
  let s = rules.init(trace.seed);
  for (const i of trace.inputs.slice().sort((a, b) => a.t - b.t)) s = rules.apply(s, i);
  return s;
}

/** Check a trace against the rules and a claimed score. This is what the server runs. */
export function verifyTrace<S>(rules: RunRules<S>, trace: RunTrace, claimedScore: number, expected?: { game?: string; version?: string; seed?: number }): VerifyResult {
  if (!trace || trace.v !== 1 || !Array.isArray(trace.inputs) || !Number.isFinite(trace.durationMs) || !Number.isFinite(trace.seed)) return { ok: false, score: 0, reason: "bad_trace" };
  if (expected && ((expected.game !== undefined && expected.game !== trace.game) || (expected.version !== undefined && expected.version !== trace.version) || (expected.seed !== undefined && expected.seed !== trace.seed))) return { ok: false, score: 0, reason: "bad_trace" };
  if (trace.inputs.length > (rules.maxInputs ?? 5000)) return { ok: false, score: 0, reason: "too_many_inputs" };
  if (trace.inputs.some(i => !Number.isFinite(i.t) || i.t < 0 || i.t > trace.durationMs)) return { ok: false, score: 0, reason: "bad_time" };
  const score = rules.score(replayTrace(rules, trace));
  return score === claimedScore ? { ok: true, score } : { ok: false, score, reason: "score_mismatch" };
}

/** Parse a stored or uploaded trace. Returns null if it is not a valid trace shape. */
export function parseTrace(text: string): RunTrace | null {
  try {
    const t = JSON.parse(text);
    if (t && t.v === 1 && typeof t.game === "string" && typeof t.version === "string" && Number.isFinite(t.seed) && Number.isFinite(t.durationMs) && Array.isArray(t.inputs)) return t as RunTrace;
  } catch { /* fall through */ }
  return null;
}

export interface BoardRow { account: string; score: number; submittedAt: number; verified: boolean; publicReplay?: boolean }
export interface RankedRow extends BoardRow { rank: number }

/** Best verified row per account, highest score first, ties go to the earlier submission. Unverified rows are left out. */
export function rankBoard(rows: BoardRow[]): RankedRow[] {
  const best = new Map<string, BoardRow>();
  for (const r of rows) {
    if (!r.verified) continue;
    const cur = best.get(r.account);
    if (!cur || r.score > cur.score || (r.score === cur.score && r.submittedAt < cur.submittedAt)) best.set(r.account, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt).map((r, i) => ({ ...r, rank: i + 1 }));
}

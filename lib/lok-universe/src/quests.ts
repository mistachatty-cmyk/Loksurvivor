// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Quests: daily and weekly goals with progress, claim, free reroll and reset times.
 *
 * The server grants rewards; this file is the shared shape and the rules, so the
 * client can show progress and the server can enforce them with the same code.
 * Quests store a glyph KEY (Lok Facet art) and a deep link target, never an
 * emoji or symbol character (docs/LOK_DESIGN_STANDARD.md).
 *
 * Framework-free and dependency-free, like the rest of the SDK.
 */

export type QuestKind = "daily" | "weekly";

export interface Quest {
  id: string;
  kind: QuestKind;
  /** One plain sentence with a number in it. */
  text: string;
  target: number;
  reward: number;
  /** Lok Facet glyph key. */
  glyph: string;
  /** Where "Go to" takes the player (a screen or mode id the game understands). */
  goTo: string;
}

export interface QuestState {
  progress: number;
  /** Epoch ms when the reward was claimed, or null. */
  claimedAt: number | null;
  rerolled: boolean;
}

/** A moment in a quest worth telling the player about while they play. */
export type QuestMoment = "start" | "half" | "done";

export const newQuestState = (): QuestState => ({ progress: 0, claimedAt: null, rerolled: false });
export const isQuestComplete = (q: Quest, s: QuestState): boolean => s.progress >= q.target;
export const canClaimQuest = (q: Quest, s: QuestState): boolean => isQuestComplete(q, s) && s.claimedAt === null;

/** Add progress (never above the target, never below zero). Returns the new state and the moments crossed, for the in-play strip. */
export function addProgress(q: Quest, s: QuestState, amount: number): { state: QuestState; moments: QuestMoment[] } {
  const prev = s.progress;
  const next = Math.min(q.target, Math.max(0, prev + amount));
  const moments: QuestMoment[] = [];
  if (prev === 0 && next > 0) moments.push("start");
  if (prev < q.target / 2 && next >= q.target / 2) moments.push("half");
  if (prev < q.target && next >= q.target) moments.push("done");
  return { state: { ...s, progress: next }, moments };
}

/** Claim a completed quest. Claiming twice returns null, so a double tap cannot pay twice. */
export function claimQuest(q: Quest, s: QuestState, now: number): { state: QuestState; reward: number } | null {
  if (!canClaimQuest(q, s)) return null;
  return { state: { ...s, claimedAt: now }, reward: q.reward };
}

/** Swap an unclaimed quest for another from the pool. One free reroll per quest slot per reset. Returns null if not allowed. */
export function rerollQuest(q: Quest, s: QuestState, pool: Quest[], pick: number): { quest: Quest; state: QuestState } | null {
  if (s.rerolled || s.claimedAt !== null) return null;
  const options = pool.filter(p => p.id !== q.id && p.kind === q.kind);
  if (!options.length) return null;
  return { quest: options[Math.abs(pick) % options.length], state: { progress: 0, claimedAt: null, rerolled: true } };
}

/** Next reset time (UTC): daily at 00:00, weekly on Monday 00:00. Always in the future. */
export function nextQuestReset(kind: QuestKind, now: number): number {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (kind === "daily") return midnight + 86400000;
  const daysToMonday = ((8 - d.getUTCDay()) % 7) || 7;
  return midnight + daysToMonday * 86400000;
}

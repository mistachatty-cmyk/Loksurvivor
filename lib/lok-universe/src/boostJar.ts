// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * The Boost Jar. Every Lok game fills one shared jar as the player plays. In the Lok Shop the owl shows the jar;
 * the player taps it to activate at whatever level it has reached. Activation pays:
 *   1. a one-time payout of the jar percentage of what they earned in the last 24 hours, then
 *   2. an earn boost of the same percentage for a window (60 to 120 minutes, longer for a fuller jar).
 * Pure and storage free; the server must apply the real payout and boost (this previews and drives the screen).
 * Builds on activity.ts: each game's daily ladder bonus stacks across games, up to JAR_CAP.
 * See docs/LOK_PARITY_AND_ECONOMY_PLAN.md section 7.
 */
import { ACTIVITY_LADDERS, activityState, type ActivityLadder } from "./activity";

/** Most the jar can hold, added across every game. */
export const JAR_CAP = 0.5;
export const BOOST_MIN_MINUTES = 60;
export const BOOST_MAX_MINUTES = 120;
/** After activating, the jar cannot be activated again for this long (counts keep building meanwhile). */
export const JAR_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const PAYOUT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The retro payout can never exceed this many base tokens, whatever the ledger says. Server owns the real cap. */
export const PAYOUT_MAX = 50000;

export interface JarSave {
  /** Local day (YYYY-MM-DD) the baseline belongs to. */
  day: string;
  /** Counts already used by an earlier activation today, per game. */
  baseline: Record<string, number>;
  lastActivatedAt?: number;
  boost?: { pct: number; startsAt: number; endsAt: number };
}
export const newJarSave = (day: string): JarSave => ({ day, baseline: {} });

export interface JarGame { game: string; unit: string; count: number; bonus: number; next: { at: number; remaining: number; bonus: number } | null }
export interface JarState {
  /** Total percentage the jar holds right now (0.12 = 12%). */
  fill: number;
  /** 0 to 1, the liquid level for the picture. */
  level: number;
  games: JarGame[];
  /** Minutes the boost would last if activated now. */
  boostMinutes: number;
}

const roundPct = (x: number) => Math.round(x * 1000) / 1000;

/** Roll to a new day: baselines and counts both reset. A running boost carries over. */
export function rollJar(j: JarSave | undefined | null, day: string): JarSave {
  if (!j) return newJarSave(day);
  return j.day === day ? { ...j, baseline: { ...j.baseline } } : { day, baseline: {}, lastActivatedAt: j.lastActivatedAt, boost: j.boost };
}

/** What the jar holds. `counts` are today's finished matches or runs per game key, from each game's own save. */
export function jarState(j: JarSave | undefined | null, counts: Record<string, number>, day: string, ladders: Record<string, ActivityLadder> = ACTIVITY_LADDERS): JarState {
  const r = rollJar(j, day);
  const games: JarGame[] = [];
  let fill = 0;
  for (const game of Object.keys(ladders)) {
    const used = r.baseline[game] ?? 0;
    const count = Math.max(0, Math.floor(counts[game] ?? 0) - used);
    const a = activityState(ladders[game], count);
    games.push({ game, unit: ladders[game].unit, count, bonus: a.bonus, next: a.next && { at: a.next.at, remaining: a.next.remaining, bonus: a.next.bonus } });
    fill += a.bonus;
  }
  fill = roundPct(Math.min(JAR_CAP, fill));
  // The jar looks full when every game is at its top step (or at the cap, whichever is lower).
  const reach = Math.min(JAR_CAP, Object.values(ladders).reduce((t, l) => t + (activityState(l, 1e9).bonus), 0));
  const level = reach > 0 ? Math.min(1, fill / reach) : 0;
  return { fill, level, games, boostMinutes: BOOST_MIN_MINUTES + Math.round(level * (BOOST_MAX_MINUTES - BOOST_MIN_MINUTES)) };
}

export interface LedgerEntry { at: number; amount: number }
/** Base tokens earned inside the payout window. Spending is not subtracted, and only positive earns count. */
export function earnedInWindow(entries: LedgerEntry[], now: number, windowMs = PAYOUT_WINDOW_MS): number {
  let t = 0;
  for (const e of entries) if (e.amount > 0 && Number.isFinite(e.amount) && e.at <= now && now - e.at <= windowMs) t += e.amount;
  return Math.floor(t);
}

export type ActivateResult =
  | { ok: true; save: JarSave; payout: number; pct: number; boostEndsAt: number; minutes: number }
  | { ok: false; reason: "empty" | "cooldown" | "boost-running"; retryAt?: number };

export function activateJar(j: JarSave | undefined | null, counts: Record<string, number>, earnedLast24h: number, now: number, day: string, ladders: Record<string, ActivityLadder> = ACTIVITY_LADDERS): ActivateResult {
  const r = rollJar(j, day);
  if (r.boost && now < r.boost.endsAt) return { ok: false, reason: "boost-running", retryAt: r.boost.endsAt };
  if (r.lastActivatedAt !== undefined && now - r.lastActivatedAt < JAR_COOLDOWN_MS) return { ok: false, reason: "cooldown", retryAt: r.lastActivatedAt + JAR_COOLDOWN_MS };
  const s = jarState(r, counts, day, ladders);
  if (s.fill <= 0) return { ok: false, reason: "empty" };
  const payout = Math.min(PAYOUT_MAX, Math.floor(Math.max(0, earnedLast24h) * s.fill));
  const baseline = { ...r.baseline };
  for (const g of s.games) baseline[g.game] = (baseline[g.game] ?? 0) + g.count;
  const endsAt = now + s.boostMinutes * 60000;
  return { ok: true, payout, pct: s.fill, minutes: s.boostMinutes, boostEndsAt: endsAt, save: { day, baseline, lastActivatedAt: now, boost: { pct: s.fill, startsAt: now, endsAt } } };
}

/** The boost percentage to add to earns right now (0 when none is running). */
export function liveBoost(j: JarSave | undefined | null, now: number): number {
  return j?.boost && now >= j.boost.startsAt && now < j.boost.endsAt ? j.boost.pct : 0;
}
export function boostMsLeft(j: JarSave | undefined | null, now: number): number {
  return j?.boost && now < j.boost.endsAt ? Math.max(0, j.boost.endsAt - now) : 0;
}

/** True once, right after a boost ends. The caller marks it shown (store `ackEndsAt`) so it never repeats. */
export function boostJustEnded(j: JarSave | undefined | null, now: number, ackEndsAt?: number): boolean {
  return !!j?.boost && now >= j.boost.endsAt && ackEndsAt !== j.boost.endsAt;
}

export interface EndPrompt { title: string; body: string; promo: { id: "lok-gate-app"; title: string; line: string; status: "coming-soon" } }
/** The end-of-boost screen: a kind suggestion to rest, plus one honest line about the upcoming phone app. No urgency, no guilt. */
export function endOfBoostPrompt(minutesPlayed: number): EndPrompt {
  const long = minutesPlayed >= 90;
  return {
    title: long ? "Good session. Time for a break." : "Boost finished.",
    body: long ? "You have played a lot today. Stand up, drink some water, rest your eyes. Your jar will be here later." : "Your jar is empty and your tokens are safe. This is a good place to stop for a while.",
    promo: { id: "lok-gate-app", title: "Coming soon: the Lok phone gate", line: "A small app that adds a pause before you open a distracting app, and asks for your own passcode to continue. Built to give you a little friction, not to nag.", status: "coming-soon" },
  };
}

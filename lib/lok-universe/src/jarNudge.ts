// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Jar nudges: the calm notice that tells a player their Boost Jar has reached a milestone, so they can collect now
 * or keep playing and let it build. Pure and storage free: the game keeps the small JarNudgeMemory in its save and
 * shows the returned nudge as a quiet chip or toast (never a modal, never a push notification).
 *
 * Not-abusive rules, enforced here so every game behaves the same:
 *  - only at a natural pause (the game passes atPause), never mid run or mid match
 *  - one nudge per milestone, ever (a level is only announced when it is higher than the last one announced today)
 *  - at most MAX_PER_DAY nudges a day and at least MIN_GAP_MS between them
 *  - no countdown pressure, no loss language; the copy always says waiting is fine
 * See docs/LOK_PARITY_AND_ECONOMY_PLAN.md section 7 and the anti-abuse guardrails.
 */
export const NUDGE_MAX_PER_DAY = 3;
export const NUDGE_MIN_GAP_MS = 20 * 60 * 1000;

export interface JarNudgeMemory {
  /** Local day (YYYY-MM-DD) these counters belong to. */
  day: string;
  /** Highest fill (0.1 = 10%) already announced today. */
  announcedFill: number;
  sentToday: number;
  lastSentAt?: number;
  /** endsAt of the boost we already told them about. */
  boostToldFor?: number;
  /** Cooldown end we already told them about. */
  readyToldFor?: number;
}
export const newNudgeMemory = (day: string): JarNudgeMemory => ({ day, announcedFill: 0, sentToday: 0 });

/** What the game knows about the jar right now (all of it comes from the server state or jarState). */
export interface JarNudgeInput {
  fill: number;
  /** True when the cap is reached, so waiting adds nothing more. */
  full: boolean;
  /** Payout and minutes if activated now. */
  payout: number;
  boostMinutes: number;
  /** Activation allowed now (not cooling down, not boosting, not empty). */
  canActivate: boolean;
  /** When the current cooldown ends, if one is running. */
  cooldownEndsAt?: number;
  /** A boost is running now. */
  boost?: { pct: number; endsAt: number };
  /** Percent the next step would add and how many plays away it is, if any. */
  nextStep?: { remaining: number; unit: string; bonus: number };
}

export type NudgeKind = "milestone" | "full" | "ready" | "boosting";
export interface Nudge {
  kind: NudgeKind;
  title: string;
  body: string;
  /** Two choices, both fine: go collect, or keep going. */
  primary: { id: "open-shop"; label: string };
  secondary: { id: "keep-playing"; label: string };
}
export interface NudgeResult { nudge: Nudge | null; memory: JarNudgeMemory }

const pct = (n: number) => `${Math.round(n * 100)}%`;
const actions = (primary: string) => ({ primary: { id: "open-shop" as const, label: primary }, secondary: { id: "keep-playing" as const, label: "Keep playing" } });

/** Decide whether to show a nudge now. Call at natural pauses (run summary, match result, returning to a menu). */
export function jarNudge(mem: JarNudgeMemory | undefined | null, jar: JarNudgeInput, now: number, day: string, atPause: boolean): NudgeResult {
  const m: JarNudgeMemory = mem && mem.day === day ? { ...mem } : newNudgeMemory(day);
  // Boost tracking is per boost, not per day, so keep it across the day roll.
  if (mem && mem.day !== day) { m.boostToldFor = mem.boostToldFor; m.readyToldFor = mem.readyToldFor; }
  const none: NudgeResult = { nudge: null, memory: m };
  if (!atPause) return none;
  if (m.sentToday >= NUDGE_MAX_PER_DAY) return none;
  if (m.lastSentAt !== undefined && now - m.lastSentAt < NUDGE_MIN_GAP_MS) return none;

  const sent = (nudge: Nudge): NudgeResult => ({ nudge, memory: { ...m, sentToday: m.sentToday + 1, lastSentAt: now } });

  // 1. Already boosting: say so once per boost, no action needed.
  if (jar.boost && jar.boost.endsAt > now) {
    if (m.boostToldFor === jar.boost.endsAt) return none;
    m.boostToldFor = jar.boost.endsAt;
    const mins = Math.max(1, Math.round((jar.boost.endsAt - now) / 60000));
    return sent({ kind: "boosting", title: "Your boost is running", body: `You are earning ${pct(jar.boost.pct)} more for about ${mins} more minutes. Nothing to do, just play.`, ...actions("See the jar") });
  }

  // 2. Cooldown finished and the jar has something in it: tell them once.
  if (jar.canActivate && jar.cooldownEndsAt !== undefined && jar.cooldownEndsAt <= now && m.readyToldFor !== jar.cooldownEndsAt && jar.fill > 0) {
    m.readyToldFor = jar.cooldownEndsAt;
    m.announcedFill = Math.max(m.announcedFill, jar.fill);
    return sent({ kind: "ready", title: "Your jar is ready again", body: `It holds ${pct(jar.fill)}. Collect about ${jar.payout} tokens plus a ${jar.boostMinutes} minute boost, or let it build first. Both are fine.`, ...actions("Open Lok Shop") });
  }

  if (!jar.canActivate || jar.fill <= 0) return none;

  // 3. Full: waiting adds nothing, so say that plainly.
  if (jar.full && m.announcedFill < jar.fill) {
    m.announcedFill = jar.fill;
    return sent({ kind: "full", title: "Your jar is full", body: `It holds ${pct(jar.fill)}, the most it can. Collecting now gets about ${jar.payout} tokens and a ${jar.boostMinutes} minute boost. Waiting will not add more.`, ...actions("Collect in Lok Shop") });
  }

  // 4. A new, higher milestone than any announced today.
  if (jar.fill > m.announcedFill + 1e-9) {
    m.announcedFill = jar.fill;
    const more = jar.nextStep ? ` ${jar.nextStep.remaining} more ${jar.nextStep.unit} would lift it to ${pct(jar.fill + jar.nextStep.bonus)}.` : "";
    return sent({ kind: "milestone", title: `Your jar reached ${pct(jar.fill)}`, body: `Collect now for about ${jar.payout} tokens and a ${jar.boostMinutes} minute boost, or keep playing and let it build.${more}`, ...actions("Open Lok Shop") });
  }
  return none;
}

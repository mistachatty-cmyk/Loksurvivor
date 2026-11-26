// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Activity bonus: the more a player plays in a day, the more their LokToken earn rate rises.
 * Each game sets its own ladder (matches for Queens N Kings, runs for 616 Survivor).
 * Pure and storage free. The bonus is an ADD-class term in the economy stack, (1 + A_item + A_rank + A_activity),
 * so the 6.0x cap and the "highest tier multiplier wins" rule still hold. The server applies the real value;
 * this only previews it and shows the next step. See docs/LOK_PARITY_AND_ECONOMY_PLAN.md section 7.
 */
export interface ActivityStep { /** Count needed today to reach this step. */ at: number; /** Added to the multiplier, 0.05 means +5%. */ bonus: number }
export interface ActivityLadder { /** Short noun shown to the player, for example "matches". */ unit: string; steps: ActivityStep[] }
export interface ActivityState {
  count: number;
  /** Bonus earned so far (0 when no step is reached). */
  bonus: number;
  /** Steps reached, 0 to steps.length. */
  reached: number;
  /** The next step, or null at the top. */
  next: { at: number; bonus: number; remaining: number } | null;
}

/** Largest bonus any ladder may give. Keeps one game from out-earning the pass tiers. */
export const ACTIVITY_BONUS_CAP = 0.25;

/** Ladders must rise in `at` and in `bonus`. Anything else is repaired: sorted, de-duplicated, bonus capped. */
export function cleanLadder(l: ActivityLadder): ActivityLadder {
  const steps = l.steps
    .filter((s) => Number.isFinite(s.at) && s.at > 0 && Number.isFinite(s.bonus) && s.bonus > 0)
    .map((s) => ({ at: Math.floor(s.at), bonus: Math.min(s.bonus, ACTIVITY_BONUS_CAP) }))
    .sort((a, b) => a.at - b.at);
  const out: ActivityStep[] = [];
  for (const s of steps) {
    if (out.length && out[out.length - 1].at === s.at) continue;
    if (out.length && s.bonus <= out[out.length - 1].bonus) continue;
    out.push(s);
  }
  return { unit: l.unit, steps: out };
}

export function activityState(ladder: ActivityLadder, count: number): ActivityState {
  const l = cleanLadder(ladder);
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  let reached = 0;
  for (const s of l.steps) if (n >= s.at) reached++;
  const nx = l.steps[reached];
  return {
    count: n,
    bonus: reached ? l.steps[reached - 1].bonus : 0,
    reached,
    next: nx ? { at: nx.at, bonus: nx.bonus, remaining: nx.at - n } : null,
  };
}

/** One quiet line for the wallet strip chip, or null when there is nothing to say. Plain words, no symbols. */
export function activityLine(ladder: ActivityLadder, count: number): string | null {
  const s = activityState(ladder, count);
  if (!s.reached && !s.next) return null;
  const pct = (b: number) => `${Math.round(b * 100)}%`;
  if (!s.next) return `Earn bonus ${pct(s.bonus)} (top step today)`;
  const more = `${s.next.remaining} more ${ladder.unit} for ${pct(s.next.bonus)}`;
  return s.reached ? `Earn bonus ${pct(s.bonus)}, ${more}` : `Play ${more}`;
}

/** Proposed starting ladders. Tune with real play. Daily counts, reset with the local day. */
export const ACTIVITY_LADDERS: Record<string, ActivityLadder> = {
  queensnkings: { unit: "matches", steps: [{ at: 2, bonus: 0.05 }, { at: 4, bonus: 0.1 }, { at: 7, bonus: 0.15 }, { at: 10, bonus: 0.2 }] },
  survivor616: { unit: "runs", steps: [{ at: 3, bonus: 0.05 }, { at: 6, bonus: 0.1 }, { at: 10, bonus: 0.15 }, { at: 15, bonus: 0.2 }] },
};

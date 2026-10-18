// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Achievements: report which achievements an account has unlocked, and when.
 *
 * Contract (server side lives in the GSix hub repo,
 * supabase/migrations/20261018000100_gsix_achievements.sql):
 * `gsix_achievements_report(p_app_key, p_unlocks)` where `p_unlocks` is
 * `{ "<app_key>:<local id>": <epoch ms | null> }`. A number is the real unlock
 * time; `null` means "unlocked before tracking began, date unknown". Records are
 * insert-only and the earliest report wins, so reporting the same thing twice
 * is harmless and a stale device cannot rewrite history.
 *
 * The catalog (names, requirements, rewards) is NOT sent: each platform exports
 * it as JSON into the hub (see the hub's ACHIEVEMENTS.md), so the hub can show
 * achievements a player has not unlocked yet.
 *
 * Framework-free and dependency-free, like the rest of the SDK.
 *
 *   const ledger = loadLedger();                         // your own persistence
 *   const { ledger: next, changed } = updateLedger(ledger, completeIds, Date.now(), { firstRun: !hadLedger });
 *   if (changed) { save(next); await reportAchievements(client, "survivor616", toUnlocks("survivor616", next)); }
 */

/** local achievement id -> unlock time in ms, or null when it was already earned before tracking began. */
export type AchievementLedger = Record<string, number | null>;

/** The wire shape for `gsix_achievements_report`. */
export type AchievementUnlocks = Record<string, number | null>;

export interface UpdateLedgerOptions {
  /**
   * The first time a platform ever builds a ledger, everything already complete
   * has an unknown date. Pass true then, so those are recorded as `null`
   * instead of being stamped "just now".
   */
  firstRun?: boolean;
  /** Real unlock times the platform already keeps (e.g. an id -> ms map). Used before `now`. */
  knownAt?: Record<string, number | undefined>;
}

/**
 * Adds newly complete achievements to the ledger. Never removes or edits an
 * existing entry, so the first unlock time is permanent. Returns a new object.
 */
export function updateLedger(
  ledger: AchievementLedger,
  completeIds: Iterable<string>,
  now: number,
  options: UpdateLedgerOptions = {},
): { ledger: AchievementLedger; added: string[]; changed: boolean } {
  const next: AchievementLedger = { ...ledger };
  const added: string[] = [];
  for (const id of completeIds) {
    if (id in next) continue;
    const known = options.knownAt?.[id];
    next[id] = typeof known === "number" && Number.isFinite(known) && known > 0 ? known : options.firstRun ? null : now;
    added.push(id);
  }
  return { ledger: next, added, changed: added.length > 0 };
}

/** Prefixes local ids with the app key, the form the server stores. */
export function toUnlocks(appKey: string, ledger: AchievementLedger): AchievementUnlocks {
  const out: AchievementUnlocks = {};
  for (const [id, at] of Object.entries(ledger)) out[`${appKey}:${id}`] = at;
  return out;
}

/** Cheap change detector so an unchanged ledger is not uploaded again. */
export function ledgerFingerprint(ledger: AchievementLedger): string {
  return Object.keys(ledger).sort().map((id) => `${id}=${ledger[id] ?? "?"}`).join("|");
}

/** The slice of a supabase-js client this needs, so the SDK does not import it. */
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

const MAX_PER_CALL = 400;

/** Reports unlocks, in batches the server accepts. Signed-in clients only; safe to repeat. */
export async function reportAchievements(client: RpcClient, appKey: string, unlocks: AchievementUnlocks): Promise<{ error: string | null }> {
  const entries = Object.entries(unlocks);
  for (let i = 0; i < entries.length; i += MAX_PER_CALL) {
    const batch = Object.fromEntries(entries.slice(i, i + MAX_PER_CALL));
    const { error } = await client.rpc("gsix_achievements_report", { p_app_key: appKey, p_unlocks: batch });
    if (error) return { error: error.message };
  }
  return { error: null };
}

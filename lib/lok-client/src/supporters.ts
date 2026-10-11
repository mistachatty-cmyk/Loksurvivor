import type { SupabaseClient } from "@supabase/supabase-js";

/** Supporter tiers, lowest to highest. `lifetime` is the founder tier. */
export type SupporterTier = "pass" | "passport" | "lifetime";

export interface SupporterFeedEntry {
  display: string;
  tier: SupporterTier;
  founder: boolean;
}

const TIER_ORDER: SupporterTier[] = ["pass", "passport", "lifetime"];
export const supporterTierRank = (tier: SupporterTier | null | undefined) => (tier ? TIER_ORDER.indexOf(tier) + 1 : 0);

const isTier = (value: unknown): value is SupporterTier => value === "pass" || value === "passport" || value === "lifetime";

/** The public thank-you list (display name + tier + founder only). Callable signed out. */
export async function fetchSupporterFeed(client: SupabaseClient, limit = 200): Promise<{ ok: boolean; entries: SupporterFeedEntry[]; error?: string }> {
  const { data, error } = await client.rpc("lok_supporter_feed", { p_limit: limit });
  if (error) return { ok: false, entries: [], error: error.message };
  const entries = ((data ?? []) as Array<{ display?: unknown; tier?: unknown; founder?: unknown }>).flatMap((row) =>
    typeof row.display === "string" && isTier(row.tier) ? [{ display: row.display, tier: row.tier, founder: row.founder === true }] : [],
  );
  return { ok: true, entries };
}

export interface MySupporter {
  /** Highest tier ever held. Never goes down, even if the subscription ends. */
  tier: SupporterTier;
  founder: boolean;
  showPublic: boolean;
}

export async function fetchMySupporter(client: SupabaseClient): Promise<{ ok: boolean; supporter: MySupporter | null; error?: string }> {
  const { data, error } = await client.rpc("lok_my_supporter");
  if (error) return { ok: false, supporter: null, error: error.message };
  const row = ((data ?? []) as Array<{ tier?: unknown; founder?: unknown; show_public?: unknown }>)[0];
  if (!row || !isTier(row.tier)) return { ok: true, supporter: null };
  return { ok: true, supporter: { tier: row.tier, founder: row.founder === true, showPublic: row.show_public !== false } };
}

export async function setSupporterPublic(client: SupabaseClient, show: boolean): Promise<boolean> {
  const { data, error } = await client.rpc("lok_set_supporter_public", { p_show: show });
  return !error && data === true;
}

/** The highest tier currently ACTIVE (unexpired entitlement). Lapsed Pass/Passport returns null here but stays in `fetchMySupporter`. */
export async function fetchActiveSupporterTier(client: SupabaseClient): Promise<{ ok: boolean; tier: SupporterTier | null; error?: string }> {
  const { data, error } = await client.from("lok_entitlements").select("sku,active,expires_at");
  if (error) return { ok: false, tier: null, error: error.message };
  const now = Date.now();
  let best: SupporterTier | null = null;
  for (const row of (data ?? []) as Array<{ sku: string; active: boolean; expires_at: string | null }>) {
    if (!row.active || (row.expires_at && Date.parse(row.expires_at) <= now)) continue;
    const tier: SupporterTier | null = row.sku === "lifetime" ? "lifetime" : row.sku === "lokpassport" ? "passport" : row.sku.startsWith("lokpass:") ? "pass" : null;
    if (supporterTierRank(tier) > supporterTierRank(best)) best = tier;
  }
  return { ok: true, tier: best };
}

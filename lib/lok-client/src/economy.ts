import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The shared cross-app LokTokens economy. `lok_grant`/`lok_bootstrap_account`
 * (the only functions that can create an account or award tokens) are
 * SECURITY DEFINER but granted EXECUTE only to postgres/service_role, not
 * `authenticated` -- a browser client can never call them directly. The
 * `lok-earn` edge function is the one trusted hop every Lok app calls
 * instead: it verifies the caller's session itself and never trusts a
 * client-supplied account id.
 */

export interface EarnEventInput {
  /** This app's `lok_apps.app_key`, e.g. "survivor616". */
  appKey: string;
  /** Must match an active `lok_earn_rules.event_key` row for this app. */
  eventKey: string;
  /**
   * Unique per real-world occurrence of the event -- the same idemKey
   * replayed (e.g. a retried network request) returns the original result
   * instead of double-crediting. Callers should derive this from something
   * that can't repeat, not just `Date.now()` (a run/match id is a good base).
   */
  idemKey: string;
  refType?: string;
  refId?: string;
  /** Only used the first time this account calls in, to seed a display handle. */
  handle?: string;
}

export interface EarnEventResult {
  ok: boolean;
  /** True when idemKey was already recorded -- the original result, not a new grant. */
  replay?: boolean;
  amount?: number;
  balance?: number;
  lifetime?: number;
  rank?: string;
  division?: number;
  promoted?: boolean;
  error?: string;
}

export async function earnLokTokens(
  client: SupabaseClient,
  event: EarnEventInput,
): Promise<EarnEventResult> {
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, error: "not_signed_in" };

  const { data, error } = await client.functions.invoke<EarnEventResult>("lok-earn", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      appKey: event.appKey,
      eventKey: event.eventKey,
      idemKey: event.idemKey,
      refType: event.refType,
      refId: event.refId,
      handle: event.handle,
    },
  });
  if (error) return { ok: false, error: error.message };
  return data ?? { ok: false, error: "empty_response" };
}

export interface LokProfileRank {
  key: string | null;
  label: string | null;
  division: number;
  color: string | null;
  bonus: number | null;
  next: string | null;
  nextAt: number | null;
  progress: number | null;
}

export interface LokProfile {
  ok: boolean;
  balance?: number;
  lifetimeEarned?: number;
  lifetimeSpent?: number;
  rank?: LokProfileRank;
  multiplier?: number;
  error?: string;
}

/** Read-only -- `lok_profile` is already granted directly to `authenticated`, no edge function needed. */
export async function getLokProfile(
  client: SupabaseClient,
  accountId: string,
  appKey: string,
): Promise<LokProfile> {
  const { data, error } = await client.rpc("lok_profile", {
    p_account: accountId,
    p_app_key: appKey,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as {
    ok: boolean;
    error?: string;
    balance?: number;
    lifetime_earned?: number;
    lifetime_spent?: number;
    multiplier?: number;
    rank?: {
      key: string | null;
      label: string | null;
      division: number;
      color: string | null;
      bonus: number | null;
      next: string | null;
      next_at: number | null;
      progress: number | null;
    };
  };
  if (!result?.ok) return { ok: false, error: result?.error ?? "unknown_error" };
  return {
    ok: true,
    balance: result.balance,
    lifetimeEarned: result.lifetime_earned,
    lifetimeSpent: result.lifetime_spent,
    multiplier: result.multiplier,
    rank: result.rank
      ? {
          key: result.rank.key,
          label: result.rank.label,
          division: result.rank.division,
          color: result.rank.color,
          bonus: result.rank.bonus,
          next: result.rank.next,
          nextAt: result.rank.next_at,
          progress: result.rank.progress,
        }
      : undefined,
  };
}

export interface SpendResult {
  ok: boolean;
  replay?: boolean;
  sku?: string;
  name?: string;
  price?: number;
  balance?: number;
  /** unknown_item | already_owned | sold_out | rank_locked | insufficient | no_account | not_signed_in */
  error?: string;
  need?: number;
  requires?: string;
}

/**
 * Buy one catalog item with LokTokens. Goes through the `lok-spend` edge
 * function for the same reason earning does: `lok_spend` is locked to
 * service_role. The server checks price, rank and ownership atomically; the
 * client only ever names a SKU, never a price.
 */
export async function spendLokTokens(client: SupabaseClient, input: { appKey: string; sku: string; idemKey: string }): Promise<SpendResult> {
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, error: "not_signed_in" };
  const { data, error } = await client.functions.invoke<SpendResult>("lok-spend", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: input,
  });
  if (error) return { ok: false, error: error.message };
  return data ?? { ok: false, error: "empty_response" };
}

/** SKUs this account owns. `lok_inventory` is readable by its owner via RLS. */
export async function fetchOwnedSkus(client: SupabaseClient): Promise<{ ok: boolean; skus: string[]; error?: string }> {
  const { data, error } = await client.from("lok_inventory").select("lok_catalog(sku)");
  if (error) return { ok: false, skus: [], error: error.message };
  const skus = (data ?? []).flatMap((row) => {
    const joined = (row as unknown as { lok_catalog: { sku: string } | { sku: string }[] | null }).lok_catalog;
    return Array.isArray(joined) ? joined.map((item) => item.sku) : joined ? [joined.sku] : [];
  });
  return { ok: true, skus };
}

export interface CatalogEntry {
  sku: string;
  name: string;
  price: number;
  rarity: string | null;
  requiresRank: string | null;
}

/** Live prices for an app's catalog (`lok_catalog` is public-read), so repricing never needs a client release. */
export async function fetchCatalog(client: SupabaseClient, appKey: string): Promise<{ ok: boolean; items: CatalogEntry[]; error?: string }> {
  const { data, error } = await client
    .from("lok_catalog")
    .select("sku,name,price,rarity,requires_rank,app_scope")
    .contains("app_scope", [appKey])
    .range(0, 999);
  if (error) return { ok: false, items: [], error: error.message };
  return {
    ok: true,
    items: (data ?? []).map((row) => ({
      sku: row.sku as string,
      name: row.name as string,
      price: Number(row.price),
      rarity: (row.rarity as string | null) ?? null,
      requiresRank: (row.requires_rank as string | null) ?? null,
    })),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One row per (account, app) in `lokdex_collections`: the compact summary of
 * what the player owns, which the GSix hub's LokDex reads. This is a
 * separate, much smaller write than the full cloud save in `auth_saves`.
 * The payload shape is defined by the hub (`apps/hub/lib/lokdex/types.ts`).
 */
const TABLE = "lokdex_collections";

export async function saveLokDexSnapshot(
  client: SupabaseClient,
  userId: string,
  appKey: string,
  snapshot: { schema: "lok.dex-snapshot" },
): Promise<{ error: string | null }> {
  const { error } = await client
    .from(TABLE)
    .upsert(
      { user_id: userId, app_key: appKey, snapshot, updated_at: new Date().toISOString() },
      { onConflict: "user_id,app_key" },
    );
  return { error: error?.message ?? null };
}

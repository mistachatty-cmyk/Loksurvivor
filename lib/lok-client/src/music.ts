import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One row per (account, app) in `lok_music_progress`: how many objectives the
 * player has completed. The GSix hub's Lok Music player compares it with each
 * song's `gate` to open songs on the website. The database only ever lets the
 * number go up, so a stale device cannot re-lock songs.
 */
const TABLE = "lok_music_progress";

export async function saveMusicProgress(
  client: SupabaseClient,
  userId: string,
  appKey: string,
  objectives: number,
): Promise<{ error: string | null }> {
  const { error } = await client
    .from(TABLE)
    .upsert(
      { user_id: userId, app_key: appKey, objectives: Math.max(0, Math.floor(objectives)) },
      { onConflict: "user_id,app_key" },
    );
  return { error: error?.message ?? null };
}

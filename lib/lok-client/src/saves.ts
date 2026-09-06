import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * auth_saves.save_blob is one JSON object per signed-in user, shared by
 * every Lok product that opts in -- each product keeps its own state under
 * its own `source` key so multiple products can reuse this single row
 * without clobbering each other's data.
 */
const TABLE = "auth_saves";

/**
 * Generous ceiling on a single product's save payload (measured real saves
 * for 616 Survivor top out well under 200KB even fully unlocked). This
 * exists to stop a corrupted or pathological client-side state from ever
 * ballooning shared database storage, not because normal saves get close.
 */
const MAX_SAVE_BYTES = 1024 * 1024;

export interface CloudSaveResult {
  data: unknown;
  updatedAt: string;
}

export async function loadCloudSave(
  client: SupabaseClient,
  userId: string,
  source: string,
): Promise<CloudSaveResult | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("save_blob, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.save_blob) return null;
  const blob = data.save_blob as Record<string, unknown>;
  if (!(source in blob)) return null;
  return { data: blob[source], updatedAt: data.updated_at as string };
}

export async function saveCloudSave(
  client: SupabaseClient,
  userId: string,
  source: string,
  saveData: unknown,
): Promise<{ error: string | null }> {
  const json = JSON.stringify(saveData);
  if (json.length > MAX_SAVE_BYTES) {
    return { error: "Save is too large to sync to the cloud." };
  }
  const { data: existing } = await client
    .from(TABLE)
    .select("save_blob")
    .eq("user_id", userId)
    .maybeSingle();
  const blob = {
    ...(existing?.save_blob as Record<string, unknown> | undefined),
    [source]: saveData,
  };
  const { error } = await client
    .from(TABLE)
    .upsert({ user_id: userId, save_blob: blob, updated_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}

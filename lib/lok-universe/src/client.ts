// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_DECK_SIZE,
  type CardArtRecipe,
  type CardCombat,
  type CollectionSource,
  type EclipseCrossing,
  type RegistryCard,
  type RegistryDeck,
  type RegistryRarity,
} from "./types";

/** Reads work signed-out (registry and Eclipse are public); collection and decks need a signed-in client. */

interface CardRow {
  asset_id: string; source_game: string; namespace: string; set_id: string; set_name: string | null;
  card_number: string | null; kind: string; name: string; description: string | null; rarity: RegistryRarity;
  tags: string[] | null; combat: CardCombat | null; art: CardArtRecipe | null; manifest: Record<string, unknown>; updated_at: string;
}

const toCard = (r: CardRow): RegistryCard => ({
  assetId: r.asset_id, sourceGame: r.source_game, namespace: r.namespace, setId: r.set_id, setName: r.set_name,
  cardNumber: r.card_number, kind: r.kind, name: r.name, description: r.description, rarity: r.rarity,
  tags: r.tags ?? [], combat: r.combat, art: r.art ?? null, manifest: r.manifest, updatedAt: r.updated_at,
});

const PAGE = 1000;

/** Every active card in the universe, all worlds. Pages through the 1000-row API limit. */
export async function fetchRegistryCards(client: SupabaseClient): Promise<{ ok: boolean; cards: RegistryCard[]; error?: string }> {
  const cards: RegistryCard[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("lok_cards").select("*").order("source_game").order("set_id").order("card_number").range(from, from + PAGE - 1);
    if (error) return { ok: false, cards, error: error.message };
    const rows = (data ?? []) as CardRow[];
    cards.push(...rows.map(toCard));
    if (rows.length < PAGE) break;
  }
  return { ok: true, cards };
}

/** Live push of registry changes. Returns an unsubscribe function. */
export function subscribeRegistry(client: SupabaseClient, onChange: (card: RegistryCard) => void): () => void {
  const channel: RealtimeChannel = client
    .channel("lok-cards-registry")
    .on("postgres_changes", { event: "*", schema: "public", table: "lok_cards" }, (payload) => {
      if (payload.new && "asset_id" in payload.new) onChange(toCard(payload.new as CardRow));
    })
    .subscribe();
  return () => void client.removeChannel(channel);
}

export async function fetchCollection(client: SupabaseClient): Promise<{ ok: boolean; entries: Array<{ assetId: string; source: CollectionSource; acquiredAt: string }>; error?: string }> {
  const { data, error } = await client.from("lok_card_collection").select("asset_id,source,acquired_at");
  if (error) return { ok: false, entries: [], error: error.message };
  return { ok: true, entries: (data ?? []).map((r) => ({ assetId: r.asset_id as string, source: r.source as CollectionSource, acquiredAt: r.acquired_at as string })) };
}

export async function listDecks(client: SupabaseClient): Promise<{ ok: boolean; decks: RegistryDeck[]; error?: string }> {
  const { data, error } = await client.from("lok_card_decks").select("*").order("updated_at", { ascending: false });
  if (error) return { ok: false, decks: [], error: error.message };
  return { ok: true, decks: (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, gameScope: r.game_scope as string, assetIds: (r.asset_ids as string[]) ?? [], updatedAt: r.updated_at as string })) };
}

export async function saveDeck(
  client: SupabaseClient,
  accountId: string,
  deck: { id?: string; name: string; gameScope: string; assetIds: string[] },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const row = { account_id: accountId, name: deck.name.slice(0, 60), game_scope: deck.gameScope, asset_ids: deck.assetIds.slice(0, MAX_DECK_SIZE), updated_at: new Date().toISOString() };
  const query = deck.id ? client.from("lok_card_decks").update(row).eq("id", deck.id).select("id").single() : client.from("lok_card_decks").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteDeck(client: SupabaseClient, id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("lok_card_decks").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

interface EclipseRow {
  key: string; name: string; lore: string | null; starts_at: string | null; ends_at: string | null;
  worlds: string[] | null; card_filter: EclipseCrossing["cardFilter"] | null; params: Record<string, unknown> | null;
}

/**
 * Crossings that are open right now. Apps decide what an open Eclipse means
 * in their own world; the registry only says which worlds' cards may cross.
 */
export async function fetchActiveEclipses(client: SupabaseClient, now = new Date()): Promise<{ ok: boolean; crossings: EclipseCrossing[]; error?: string }> {
  const iso = now.toISOString();
  const { data, error } = await client
    .from("lok_eclipse_crossings")
    .select("key,name,lore,starts_at,ends_at,worlds,card_filter,params")
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${iso}`)
    .or(`ends_at.is.null,ends_at.gte.${iso}`);
  if (error) return { ok: false, crossings: [], error: error.message };
  return {
    ok: true,
    crossings: ((data ?? []) as EclipseRow[]).map((r) => ({
      key: r.key, name: r.name, lore: r.lore, startsAt: r.starts_at, endsAt: r.ends_at,
      worlds: r.worlds ?? [], cardFilter: r.card_filter ?? {}, params: r.params ?? {},
    })),
  };
}

/** True when `card` may cross through `crossing` into another world. */
export function cardCrosses(card: RegistryCard, crossing: EclipseCrossing, rarityOrder: RegistryRarity[]): boolean {
  if (crossing.worlds.length && !crossing.worlds.includes(card.sourceGame)) return false;
  const { minRarity, tags } = crossing.cardFilter;
  if (minRarity && rarityOrder.indexOf(card.rarity) < rarityOrder.indexOf(minRarity)) return false;
  if (tags?.length && !tags.some((tag) => card.tags.includes(tag))) return false;
  return true;
}

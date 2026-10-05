import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Client side of the LOK Card Universe (see Lok-EcoSystsem/LokToken EcoSystem/
 * LOK_CARD_UNIVERSE.md). Every Lok game publishes its cards into the shared
 * `lok_cards` registry and reads everyone else's live -- so a card added in any
 * game appears in every binder without a client release.
 *
 * Reads work signed-out (the registry is public); the collection and decks
 * need a signed-in client.
 */

export type RegistryRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "secret";
export const RARITY_ORDER: RegistryRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "secret"];

/** Unit-less fight block. Each game scales it into its own hp/damage units. */
export interface CardCombat {
  role: "hero" | "enemy" | "companion";
  tier: number; // 1..7, index into RARITY_ORDER + 1
  hp: number;
  attack: number;
  speed: number;
}

/**
 * A portable, PROCEDURAL description of how to redraw a card's model. Games
 * publish the same data they draw from themselves, so every other game can
 * reproduce the model faithfully with its own renderer. Never a bitmap or
 * image URL: recipes are small JSON, so nothing user-supplied or unlicensed
 * ever travels. A viewer that does not know a recipe kind falls back to a
 * name-initials face.
 */
export type CardArtRecipe =
  | {
      kind: "sprite-rig";
      /** 616 Survivor SpriteRig (parts + idle/walk clips) and SpritePalette, verbatim. */
      rig: unknown;
      palette: Record<string, string>;
      anim?: "idle" | "walk";
    }
  | { kind: "lokpet-silhouette"; silhouette: string; palette: Record<string, string> }
  | {
      kind: "pixel-grid";
      /** Rows of palette keys; "0" is transparent. */
      grid: string[];
      palette: Record<string, string>;
      motion?: string;
    };

export interface RegistryCard {
  assetId: string;
  sourceGame: string; // lok_apps.app_key
  namespace: string;
  setId: string;
  setName: string | null;
  cardNumber: string | null;
  kind: string;
  name: string;
  description: string | null;
  rarity: RegistryRarity;
  tags: string[];
  combat: CardCombat | null;
  /** How to redraw the model; null when the source game has not published one. */
  art: CardArtRecipe | null;
  /** The full lok.asset manifest. Art is never carried -- the viewing game draws its own. */
  manifest: Record<string, unknown>;
  updatedAt: string;
}

/** Normalized fight stats by rarity. Placeholder tuning: adjust here, republish, every game follows. */
const COMBAT_BY_TIER = [
  { hp: 40, attack: 6, speed: 1.0 },
  { hp: 60, attack: 9, speed: 1.0 },
  { hp: 90, attack: 13, speed: 1.05 },
  { hp: 130, attack: 18, speed: 1.1 },
  { hp: 190, attack: 26, speed: 1.15 },
  { hp: 260, attack: 36, speed: 1.2 },
  { hp: 320, attack: 44, speed: 1.25 },
];

export function combatForRarity(rarity: string, role: CardCombat["role"] = "hero"): CardCombat {
  const index = Math.max(0, RARITY_ORDER.indexOf(rarity as RegistryRarity));
  const base = COMBAT_BY_TIER[index]!;
  const roleScale = role === "enemy" ? { hp: 1.1, attack: 0.9 } : role === "companion" ? { hp: 0.8, attack: 0.8 } : { hp: 1, attack: 1 };
  return {
    role,
    tier: index + 1,
    hp: Math.round(base.hp * roleScale.hp),
    attack: Math.round(base.attack * roleScale.attack),
    speed: base.speed,
  };
}

interface CardRow {
  asset_id: string;
  source_game: string;
  namespace: string;
  set_id: string;
  set_name: string | null;
  card_number: string | null;
  kind: string;
  name: string;
  description: string | null;
  rarity: RegistryRarity;
  tags: string[] | null;
  combat: CardCombat | null;
  art: CardArtRecipe | null;
  manifest: Record<string, unknown>;
  updated_at: string;
}

const toCard = (row: CardRow): RegistryCard => ({
  assetId: row.asset_id,
  sourceGame: row.source_game,
  namespace: row.namespace,
  setId: row.set_id,
  setName: row.set_name,
  cardNumber: row.card_number,
  kind: row.kind,
  name: row.name,
  description: row.description,
  rarity: row.rarity,
  tags: row.tags ?? [],
  combat: row.combat,
  art: row.art ?? null,
  manifest: row.manifest,
  updatedAt: row.updated_at,
});

const PAGE = 1000;

/** Every active card in the universe, all games. Pages through the 1000-row API limit. */
export async function fetchRegistryCards(client: SupabaseClient): Promise<{ ok: boolean; cards: RegistryCard[]; error?: string }> {
  const cards: RegistryCard[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("lok_cards")
      .select("*")
      .order("source_game")
      .order("set_id")
      .order("card_number")
      .range(from, from + PAGE - 1);
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

export type CollectionSource = "native" | "earned" | "eclipse" | "trade" | "seen";

/** Cards this account has collected anywhere in the universe. Requires a signed-in client. */
export async function fetchCollection(client: SupabaseClient): Promise<{ ok: boolean; entries: Array<{ assetId: string; source: CollectionSource; acquiredAt: string }>; error?: string }> {
  const { data, error } = await client.from("lok_card_collection").select("asset_id,source,acquired_at");
  if (error) return { ok: false, entries: [], error: error.message };
  return {
    ok: true,
    entries: (data ?? []).map((row) => ({ assetId: row.asset_id as string, source: row.source as CollectionSource, acquiredAt: row.acquired_at as string })),
  };
}

export interface RegistryDeck {
  id: string;
  name: string;
  /** 'all' or a lok_apps.app_key the deck is limited to. */
  gameScope: string;
  assetIds: string[];
  updatedAt: string;
}

export const MAX_DECK_SIZE = 40;

export async function listDecks(client: SupabaseClient): Promise<{ ok: boolean; decks: RegistryDeck[]; error?: string }> {
  const { data, error } = await client.from("lok_card_decks").select("*").order("updated_at", { ascending: false });
  if (error) return { ok: false, decks: [], error: error.message };
  return {
    ok: true,
    decks: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      gameScope: row.game_scope as string,
      assetIds: (row.asset_ids as string[]) ?? [],
      updatedAt: row.updated_at as string,
    })),
  };
}

export async function saveDeck(
  client: SupabaseClient,
  accountId: string,
  deck: { id?: string; name: string; gameScope: string; assetIds: string[] },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const row = {
    account_id: accountId,
    name: deck.name.slice(0, 60),
    game_scope: deck.gameScope,
    asset_ids: deck.assetIds.slice(0, MAX_DECK_SIZE),
    updated_at: new Date().toISOString(),
  };
  const query = deck.id
    ? client.from("lok_card_decks").update(row).eq("id", deck.id).select("id").single()
    : client.from("lok_card_decks").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteDeck(client: SupabaseClient, id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("lok_card_decks").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * LOK Universe SDK -- shared types. SOURCE OF TRUTH: Lok-EcoSystsem/universe-sdk.
 * Platforms vendor a copy with `sync-sdk.sh`; never edit a vendored copy.
 */

export const SDK_VERSION = "1.0.0";
/** Bump on a breaking change to the registry row / recipe shape. Stored in lok_cards.schema_version. */
export const SCHEMA_VERSION = 1;

export type RegistryRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "secret";
export const RARITY_ORDER: RegistryRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "secret"];

/** Rim/glow colours every platform uses for rarity so a card looks the same everywhere. */
export const RARITY_COLORS: Record<RegistryRarity, string> = {
  common: "#94a3b8",
  uncommon: "#34d399",
  rare: "#38bdf8",
  epic: "#c084fc",
  legendary: "#f9a8d4",
  mythic: "#fde68a",
  secret: "#f87171",
};

/** Unit-less fight block. Each platform scales it into its own hp/damage units. */
export interface CardCombat {
  role: "hero" | "enemy" | "companion";
  tier: number; // 1..7
  hp: number;
  attack: number;
  speed: number;
}

/**
 * A portable, PROCEDURAL description of how to redraw a card's model. Games
 * publish the same data they draw from themselves. Never a bitmap or URL.
 * A viewer that doesn't know a kind falls back to a name-initials face.
 */
export type CardArtRecipe =
  | { kind: "sprite-rig"; rig: unknown; palette: Record<string, string>; anim?: "idle" | "walk" }
  | { kind: "lokpet-silhouette"; silhouette: string; palette: Record<string, string> }
  | { kind: "pixel-grid"; grid: string[]; palette: Record<string, string>; motion?: string };

export type CardArtKind = CardArtRecipe["kind"];

export interface RegistryCard {
  assetId: string;
  sourceGame: string; // lok_apps.app_key -- the card's HOME world
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
  art: CardArtRecipe | null;
  manifest: Record<string, unknown>;
  updatedAt: string;
}

export type CollectionSource = "native" | "earned" | "eclipse" | "trade" | "seen";

export interface RegistryDeck {
  id: string;
  name: string;
  /** 'all' or a lok_apps.app_key. */
  gameScope: string;
  assetIds: string[];
  updatedAt: string;
}
export const MAX_DECK_SIZE = 40;

/**
 * The Eclipse: an in-world event that opens a gateway between apps. A
 * crossing is DATA (a row), so a new Eclipse is scheduled by inserting one --
 * no client release. While a crossing is active, every app that reads it may
 * let cards from the `worlds` listed here appear in its own world.
 */
export interface EclipseCrossing {
  key: string;
  name: string;
  /** Narrative text shown by every app. Authored by the Lok lore owner. */
  lore: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** app_keys whose cards cross. Empty = every world. */
  worlds: string[];
  /** Optional narrowing: { minRarity?, tags?: string[] } */
  cardFilter: { minRarity?: RegistryRarity; tags?: string[] };
  /** Free-form hints for apps (e.g. spawn weight). Apps ignore keys they don't know. */
  params: Record<string, unknown>;
}

/**
 * `lok.universe.json` at the root of every platform repo: everything the
 * universe needs to know about it. Read by that platform's publisher.
 */
export interface PlatformManifest {
  schema: "lok.universe.platform";
  schemaVersion: 1;
  /** lok_apps.app_key */
  appKey: string;
  /** Portable asset namespace, g6.<repo-name> */
  namespace: string;
  label: string;
  /** Recipe kinds this platform can DRAW. Publishers may still publish any kind. */
  draws: CardArtKind[];
  /** Recipe kinds this platform PUBLISHES for its own cards. */
  publishes: CardArtKind[];
  /**
   * How this platform's lore reaches its page on the GSix hub. Null/absent =
   * no public lore yet. `script` exports a `lok.public-lore` document;
   * `hubKey` is the hub's /games/[key].
   */
  publicLore?: { script: string; hubKey: string } | null;
  sdkVersion: string;
}

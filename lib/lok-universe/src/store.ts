// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Shared Lok Shop contract. The visual shell is shipped as the
 * `lok-shop-frame` web component in LokToken EcoSystem/embed so it can be used
 * by games with different UI frameworks. Games provide their own catalog,
 * account adapter, item cards, and purchase callback.
 */
export const LOK_SHOP_FRAME_TAG = "lok-shop-frame";
export const LOK_SHOP_FRAME_VERSION = "1.0.0";

export interface StorefrontManifest {
  /** Shared page frame that keeps the wallet, supporter bar, and content order consistent. */
  component: "lok-shop-frame";
  version: string;
}

export type StoreWalletState =
  | { kind: "signed-in"; balance: number; rank?: string }
  | { kind: "loading" }
  | { kind: "sign-in" }
  | { kind: "offline" };

export interface StoreItemModel {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  rarity: string | null;
  owned: boolean;
  equipped: boolean;
}

/** Clamp balance values before rendering so malformed profiles never show negative currency. */
export function normalizeStoreBalance(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

/** A missing catalog row is deliberately not purchasable. */
export function storeItemCanBuy(item: Pick<StoreItemModel, "owned" | "price">): boolean {
  return !item.owned && item.price !== null && Number.isFinite(item.price) && item.price >= 0;
}

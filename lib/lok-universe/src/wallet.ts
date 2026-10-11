// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Wallet strip model: every Lok shop shows the player's LokToken balance, or offers sign-in.
 * Pure (no DOM, no network): the platform feeds it state it already has, so the strip costs
 * no extra requests. See LOK_PLATFORMS.md ("Wallet strip") and docs/LOK_COST_DISCIPLINE.md.
 */
export type WalletStripState =
  /** Signed in and the balance is known. */
  | { kind: "signed-in"; balance: number }
  /** Signed in, balance still loading. */
  | { kind: "loading" }
  /** Signed out and accounts exist: show the balance as unknown and offer sign-in. */
  | { kind: "sign-in" }
  /** No account backend configured (offline / local dev): explain, no button. */
  | { kind: "offline" };

export interface WalletStripInput {
  signedIn: boolean;
  balance: number | null;
  authAvailable: boolean;
}

export function walletStripState(input: WalletStripInput): WalletStripState {
  if (!input.authAvailable) return { kind: "offline" };
  if (!input.signedIn) return { kind: "sign-in" };
  if (input.balance === null || !Number.isFinite(input.balance)) return { kind: "loading" };
  return { kind: "signed-in", balance: Math.max(0, Math.floor(input.balance)) };
}

/** Where a shop must mount the strip. Declared in `lok.universe.json` -> `walletStrip`. */
export interface WalletStripManifest {
  mount: Array<"shop">;
}

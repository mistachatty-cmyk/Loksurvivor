// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
// Look kit: what a Lok app needs to ship themes and customizations on day one.
// Three kinds of look, one catalog per app:
//   shared    exists in every Lok app under the same id (from sharedLooks.ts); the crossover set.
//   game      belongs to one app only (that app's own flavour); registered by the app.
//   pass      a look reserved for Lok Pass holders; it can be shared or game-specific.
// Pure and storage free: the app decides what the player owns and passes it in. PROPOSED, see docs/LOK_LOOKS_PLAN.md.
import { SHARED_LOOKS, sharedLookCssVars, type SharedLook } from "./sharedLooks";

export type LookKind = "shared" | "game";
export type LookAccess = "free" | "earn" | "buy" | "pass";

/** A look as the kit sees it: the colours plus where it lives and how it is got. */
export interface KitLook extends SharedLook {
  kind: LookKind;
  /** The app key this look belongs to; empty for shared looks. */
  app: string;
  access: LookAccess;
}

const registry = new Map<string, KitLook[]>();

/** Starter set for a brand-new app: the first looks in the shared set are free, the rest are earned or bought in that app. */
export const STARTER_FREE_COUNT = 3;

export const sharedKitLooks = (): KitLook[] =>
  SHARED_LOOKS.map((l, i) => ({ ...l, kind: "shared" as const, app: "", access: i < STARTER_FREE_COUNT ? ("free" as const) : ("earn" as const) }));

/** An app registers its own looks once at start-up. Ids are forced to the app's prefix so they can never clash with a shared look. */
export function registerGameLooks(app: string, looks: ReadonlyArray<Omit<KitLook, "kind" | "app"> & { access?: LookAccess }>): KitLook[] {
  const out = looks.map((l) => ({ ...l, id: l.id.startsWith(`${app}-`) ? l.id : `${app}-${l.id}`, kind: "game" as const, app, access: l.access ?? ("earn" as const) }));
  registry.set(app, out);
  return out;
}

export interface LookCatalog { all: KitLook[]; usable: KitLook[]; closed: KitLook[]; passOnly: KitLook[] }

/**
 * The catalog an app shows: every shared look plus that app's own. A look is usable when it is free, owned, or a pass
 * look and the player holds the pass. Looks from other apps are never shown (a game look stays in its game).
 */
export function lookCatalog(app: string, opts: { owned?: ReadonlyArray<string>; hasPass?: boolean } = {}): LookCatalog {
  const owned = new Set(opts.owned ?? []);
  const all = [...sharedKitLooks(), ...(registry.get(app) ?? [])];
  const usable = all.filter((l) => l.access === "free" || owned.has(l.id) || (l.access === "pass" && !!opts.hasPass));
  const usableIds = new Set(usable.map((l) => l.id));
  return { all, usable, closed: all.filter((l) => !usableIds.has(l.id)), passOnly: all.filter((l) => l.access === "pass") };
}

/** Pick the look to draw: the saved one if the player may use it, otherwise the first free look, so a lost entitlement never leaves a blank screen. */
export function resolveLook(app: string, savedId: string | null | undefined, opts: { owned?: ReadonlyArray<string>; hasPass?: boolean } = {}): KitLook {
  const cat = lookCatalog(app, opts);
  return cat.usable.find((l) => l.id === savedId) ?? cat.usable[0] ?? sharedKitLooks()[0]!;
}

/** Set the 616-style CSS variables for a look on an element (a page root, say). Safe to call where there is no document. */
export function applyLookVars(root: { style: { setProperty(name: string, value: string): void } } | null | undefined, look: SharedLook): void {
  if (!root) return;
  for (const [k, v] of Object.entries(sharedLookCssVars(look))) root.style.setProperty(k, v);
}

/** Test helper: forget every registered game look. */
export function _resetLookKit(): void { registry.clear(); }

// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Billing rules shared by every Lok app, site and server function. Pure: no DOM, no network, no Stripe.
 * The switches live in the database (`billing_status()`), the prices live in `billing_plans`, and what a
 * player owns lives in `lok_entitlements`. This file is only the agreed vocabulary between them.
 *
 * Two promises it keeps everywhere:
 *  - Failing CLOSED: if the status cannot be read, nothing is for sale (never the other way round).
 *  - Switching sales off never takes away what someone already bought: perks follow live entitlements.
 *
 * The edge functions keep a byte-identical copy of this file (see `sync-billing-rules.sh`
 * and `test/billing.test.ts`), so the browser and the server can never disagree about what a plan grants.
 */

// ---------------------------------------------------------------- rules (mirrored to the server) ----

export type PlanKey =
  | "pass"
  | "pass_monthly"
  | "passport_monthly"
  | "passport_yearly"
  | "lifetime"
  | "executive_lifetime"
  | "keepsake_spark"
  | "keepsake_studio"
  | "keepsake_showpiece";

export const PLAN_KEYS: readonly PlanKey[] = [
  "pass",
  "pass_monthly",
  "passport_monthly",
  "passport_yearly",
  "lifetime",
  "executive_lifetime",
  "keepsake_spark",
  "keepsake_studio",
  "keepsake_showpiece",
];

export type PassTier = "free" | "pass" | "passport" | "lifetime";
export const TIER_ORDER: readonly PassTier[] = ["free", "pass", "passport", "lifetime"];

export const isPlanKey = (v: unknown): v is PlanKey => typeof v === "string" && (PLAN_KEYS as readonly string[]).includes(v);

/**
 * Apps that must never sell anything through Lok billing. DJ Shoey is a client site with its own Stripe: any
 * benefit or sale there needs a conversation with the client first (owner, 2026-11-28). Enforced in canSell(),
 * in the checkout function, and by leaving the app out of billing_app_passes.
 */
export const NO_SALES_APPS: readonly string[] = ["dj-shoey"];
export const isSalesBlocked = (appKey: unknown): boolean => typeof appKey === "string" && NO_SALES_APPS.includes(appKey);

/** An app key as used in `apps.ts` and `lok_apps`. Lowercase letters, digits and dashes only. */
export const isAppKey = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,40}$/.test(v);

/** True for the plans that create a subscription (renewals, cancellations) rather than a single payment. */
export const isRecurring = (plan: PlanKey): boolean => plan === "passport_monthly" || plan === "passport_yearly" || plan === "pass_monthly";

export const isPassPlan = (plan: PlanKey): boolean => plan === "pass" || plan === "pass_monthly";

/** True when the plan only records an order (a hand-made keepsake is fulfilled by a person, not unlocked by code). */
export const isKeepsake = (plan: PlanKey): boolean => plan.startsWith("keepsake_");

/** The entitlement skus a plan grants. A single-app Pass needs the app; every other plan must not name one. */
export function skusForPlan(plan: PlanKey, appKey?: string | null): string[] | null {
  if (isPassPlan(plan)) return isAppKey(appKey) ? [`lokpass:${appKey}`] : null;
  if (isKeepsake(plan)) return [];
  if (plan === "passport_monthly" || plan === "passport_yearly") return ["lokpassport"];
  if (plan === "lifetime") return ["lifetime"];
  if (plan === "executive_lifetime") return ["lifetime", "executive"];
  return null;
}

/** The environment variable NAMES that hold Stripe price ids (the ids themselves never appear in code). */
export const priceEnvName = (plan: PlanKey, testMode: boolean): string => `STRIPE_PRICE_${plan.toUpperCase()}${testMode ? "_TEST" : ""}`;

export interface EntitlementRow {
  sku: string;
  active?: boolean | null;
  expires_at?: string | null;
}

/** The skus that count right now: active, and not past their end date. */
export function liveSkus(rows: readonly EntitlementRow[], now: number = Date.now()): string[] {
  return rows
    .filter((r) => r && typeof r.sku === "string" && r.active !== false && (!r.expires_at || Date.parse(r.expires_at) > now))
    .map((r) => r.sku);
}

/** Highest tier held. A Pass only counts for its own app (pass `appKey`); Passport and Lifetime count everywhere. */
export function tierFromSkus(skus: readonly string[], appKey?: string | null): PassTier {
  if (skus.includes("lifetime")) return "lifetime";
  if (skus.includes("lokpassport")) return "passport";
  if (appKey ? skus.includes(`lokpass:${appKey}`) : skus.some((s) => s.startsWith("lokpass:"))) return "pass";
  return "free";
}

export const tierAtLeast = (have: PassTier, need: PassTier): boolean => TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);

/** The tier names the hub skins package (lok-skins) uses, so both vocabularies convert in one place. */
export type SkinsTier = "free" | "lokpass" | "lokpassport" | "lifetime";
const TO_SKINS: Record<PassTier, SkinsTier> = { free: "free", pass: "lokpass", passport: "lokpassport", lifetime: "lifetime" };
const FROM_SKINS: Record<SkinsTier, PassTier> = { free: "free", lokpass: "pass", lokpassport: "passport", lifetime: "lifetime" };
export const toSkinsTier = (t: PassTier): SkinsTier => TO_SKINS[t];
/** Unknown names are "free": a typo can never unlock something. */
export const fromSkinsTier = (t: unknown): PassTier => (typeof t === "string" && Object.hasOwn(FROM_SKINS, t) ? FROM_SKINS[t as SkinsTier] : "free");

/** Baseline guarantee: any paid tier removes the ads in that app, even when the app has no other perks. */
export const adsOff = (skus: readonly string[], appKey: string): boolean => tierFromSkus(skus, appKey) !== "free";

/** Already owned by something bigger: do not sell a Pass to a Passport holder or a Passport to a Lifetime member. */
export function alreadyCovered(plan: PlanKey, skus: readonly string[], appKey?: string | null): boolean {
  if (isKeepsake(plan)) return false;
  const have = tierFromSkus(skus, appKey);
  if (isPassPlan(plan)) return tierAtLeast(have, "pass");
  if (plan === "passport_monthly" || plan === "passport_yearly") return tierAtLeast(have, "passport");
  if (plan === "lifetime") return tierAtLeast(have, "lifetime");
  if (plan === "executive_lifetime") return skus.includes("executive");
  return false;
}

// ---------------------------------------------------------------------------- status (browser side) ----

export interface BillingPlanStatus {
  key: PlanKey;
  name: string;
  priceCents: number;
  cadence: "one_time" | "month" | "year";
  comingSoon: boolean;
  onSale: boolean;
}

export interface BillingStatus {
  master: boolean;
  testMode: boolean;
  message: string | null;
  plans: BillingPlanStatus[];
  /** app key -> is a Lok Pass for that app on sale right now. */
  apps: Record<string, boolean>;
}

/** Nothing for sale. What every app uses when the status cannot be read. */
export const BILLING_CLOSED: BillingStatus = Object.freeze({ master: false, testMode: true, message: null, plans: [], apps: {} }) as BillingStatus;

/** Keeps only well-formed rows from `billing_status()`; anything odd means closed. */
export function parseBillingStatus(raw: unknown): BillingStatus {
  if (!raw || typeof raw !== "object") return BILLING_CLOSED;
  const r = raw as Record<string, unknown>;
  const plans: BillingPlanStatus[] = [];
  for (const p of Array.isArray(r.plans) ? r.plans : []) {
    const o = p as Record<string, unknown>;
    if (!o || !isPlanKey(o.key) || typeof o.priceCents !== "number" || !Number.isFinite(o.priceCents)) continue;
    const cadence = o.cadence === "month" || o.cadence === "year" ? o.cadence : "one_time";
    plans.push({
      key: o.key,
      name: typeof o.name === "string" ? o.name.slice(0, 80) : o.key,
      priceCents: Math.max(0, Math.round(o.priceCents)),
      cadence,
      comingSoon: o.comingSoon === true,
      onSale: o.onSale === true && o.comingSoon !== true,
    });
  }
  const apps: Record<string, boolean> = {};
  if (r.apps && typeof r.apps === "object") {
    for (const [k, v] of Object.entries(r.apps as Record<string, unknown>)) if (isAppKey(k)) apps[k] = v === true;
  }
  const master = r.master === true;
  return {
    master,
    testMode: r.testMode !== false,
    message: typeof r.message === "string" ? r.message.slice(0, 200) : null,
    // The master switch wins over everything it was copied beside.
    plans: master ? plans : plans.map((p) => ({ ...p, onSale: false })),
    apps: master ? apps : Object.fromEntries(Object.keys(apps).map((k) => [k, false])),
  };
}

/** Whether a plan can be bought right now (and, for a Pass, for this app). */
export function canSell(status: BillingStatus, plan: PlanKey, appKey?: string | null): boolean {
  if (!status.master) return false;
  const p = status.plans.find((x) => x.key === plan);
  if (!p || !p.onSale) return false;
  if (isPassPlan(plan)) return isAppKey(appKey) && !isSalesBlocked(appKey) && status.apps[appKey] === true;
  return true;
}

export const formatPrice = (cents: number): string => {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString("en-US") : dollars.toFixed(2)}`;
};

interface RpcClient {
  rpc(fn: string): PromiseLike<{ data: unknown; error: unknown }>;
}

let cache: { at: number; value: BillingStatus } | null = null;
export const BILLING_STATUS_TTL_MS = 5 * 60 * 1000;

/** One read per five minutes, shared by everything on the page. Any failure returns "closed". */
export async function fetchBillingStatus(client: RpcClient, now: number = Date.now()): Promise<BillingStatus> {
  if (cache && now - cache.at < BILLING_STATUS_TTL_MS) return cache.value;
  try {
    const { data, error } = await client.rpc("billing_status");
    if (error) return BILLING_CLOSED;
    const value = parseBillingStatus(data);
    cache = { at: now, value };
    return value;
  } catch {
    return BILLING_CLOSED;
  }
}

export const resetBillingStatusCache = (): void => {
  cache = null;
};

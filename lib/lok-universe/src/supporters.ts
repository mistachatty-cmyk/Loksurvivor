// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Supporter bar model: the platform-neutral part of the Lok supporter bar (the thank-you
 * ticker for Lok Pass / Lok Passport / Lifetime supporters). Pure -- no DOM, no network --
 * so every platform renders it with its own look and the rules stay identical everywhere.
 * See `LokToken EcoSystem/SUPPORTERS.md` and the "Supporter bar" section of LOK_PLATFORMS.md.
 */
export type SupporterTier = "pass" | "passport" | "lifetime";

export interface SupporterEntry {
  display: string;
  tier: SupporterTier;
  founder: boolean;
}

/** Tier colours. Games may restyle the bar, but these three stay recognisable. */
export const SUPPORTER_TIER_COLORS: Record<SupporterTier, string> = {
  pass: "#5eead4",
  passport: "#38bdf8",
  lifetime: "#fbbf24",
};

export const SUPPORTER_BAR_LABEL = "LOK SUPPORTERS · THANK YOU";
export const SUPPORTER_NAME_MAX = 32;
/** Seconds each name is on screen; keeps scroll speed steady as the list grows. */
export const SUPPORTER_SECONDS_PER_ENTRY = 5;
/** One feed fetch per this many ms, at most. */
export const SUPPORTER_REFRESH_MS = 10 * 60 * 1000;

export type SupporterMount = "shell" | "shop";

/** `lok.universe.json` -> `supporterBar`. Every platform with a shop must list both mounts. */
export interface SupporterBarManifest {
  mount: SupporterMount[];
  /** Free-form theme hint (e.g. "hologram", "retro"); the platform maps it to its own CSS variables. */
  theme?: string;
}

const isTier = (v: unknown): v is SupporterTier => v === "pass" || v === "passport" || v === "lifetime";

/** Keeps only well-formed rows, trims and caps names, drops blanks and control characters. */
export function sanitizeSupporterFeed(rows: unknown): SupporterEntry[] {
  if (!Array.isArray(rows)) return [];
  const out: SupporterEntry[] = [];
  for (const row of rows as Array<{ display?: unknown; tier?: unknown; founder?: unknown }>) {
    if (!row || typeof row.display !== "string" || !isTier(row.tier)) continue;
    // eslint-disable-next-line no-control-regex
    const display = row.display.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, SUPPORTER_NAME_MAX);
    if (display) out.push({ display, tier: row.tier, founder: row.founder === true });
  }
  return out;
}

/** The text of one ticker item. */
export function supporterItemText(entry: SupporterEntry): string {
  return `${entry.founder ? "★" : "◆"} ${entry.display}${entry.founder ? " · FOUNDER" : ""}`;
}

export function supporterScrollSeconds(count: number): number {
  return Math.max(30, count * SUPPORTER_SECONDS_PER_ENTRY);
}

// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
// Customization table: one flat list of every cosmetic, theme, unlock and fun world-changing item sold or earned in
// any Lok app, so every game and application can see what exists, what is missing in its own catalog, and what to add
// next. Each app exports its rows from its own data (never typed by hand); `buildMaster` merges them and
// `toMarkdown` writes the readable table. Pure functions, no storage. PROPOSED, see docs/LOK_LOOKS_PLAN.md.

export type CustomKind =
  | "menu-theme" | "palette" | "frame" | "effect" | "inlay" | "banner" | "trail" | "aura" | "hat" | "celebration"
  | "pack-skin" | "card-back" | "card-frame" | "drop-pack" | "feature-key" | "perk" | "pass" | "skin" | "other";
export type CustomAccess = "free" | "earn" | "buy" | "pass" | "find";
/** cosmetic = looks only; world = changes how the game plays or the world around the player; feature = opens a part of the app. */
export type CustomEffect = "cosmetic" | "world" | "feature";

export interface CustomRow {
  app: string;          // lok_apps key, e.g. "survivor616", "queensnkings"
  kind: CustomKind;
  id: string;
  name: string;
  description: string;
  tier: string;         // the app's own tier word, kept as written
  access: CustomAccess;
  /** LokTokens, when the app sells it for them; omit when it is free, earned, or sold in another currency. */
  price?: number;
  scope: "shared" | "game";
  effect: CustomEffect;
  /** A short crossover tag for ideas that could exist in several apps, e.g. "pet-mount", "ambient-souls". Same tag = same idea. */
  concept?: string;
  /** The catalog SKU in lok_catalog when the item is sold through LokToken. */
  sku?: string;
}

export interface AppAudit { app: string; status: "exported" | "not-audited"; note?: string }

const KINDS: ReadonlySet<string> = new Set(["menu-theme", "palette", "frame", "effect", "inlay", "banner", "trail", "aura", "hat", "celebration", "pack-skin", "card-back", "card-frame", "drop-pack", "feature-key", "perk", "pass", "skin", "other"]);
const ACCESS: ReadonlySet<string> = new Set(["free", "earn", "buy", "pass", "find"]);
const EFFECT: ReadonlySet<string> = new Set(["cosmetic", "world", "feature"]);

/** Problems that would make the table wrong: duplicate ids, unknown words, missing names. Empty means clean. */
export function validateRows(rows: ReadonlyArray<CustomRow>): string[] {
  const out: string[] = [], seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.app}/${r.kind}/${r.id}`;
    if (seen.has(key)) out.push(`duplicate ${key}`); seen.add(key);
    if (!r.app || !r.id || !r.name) out.push(`missing app, id or name: ${key}`);
    if (!KINDS.has(r.kind)) out.push(`unknown kind ${r.kind}: ${key}`);
    if (!ACCESS.has(r.access)) out.push(`unknown access ${r.access}: ${key}`);
    if (!EFFECT.has(r.effect)) out.push(`unknown effect ${r.effect}: ${key}`);
    if (r.price !== undefined && !(r.price >= 0)) out.push(`bad price: ${key}`);
  }
  return out;
}

export interface Master { rows: CustomRow[]; apps: AppAudit[]; counts: Record<string, Record<string, number>> }

export function buildMaster(files: ReadonlyArray<{ app: string; rows: CustomRow[] }>, audits: ReadonlyArray<AppAudit> = []): Master {
  const rows = files.flatMap((f) => f.rows).sort((a, b) => a.app.localeCompare(b.app) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const counts: Record<string, Record<string, number>> = {};
  for (const r of rows) { const a = (counts[r.app] ??= {}); a[r.kind] = (a[r.kind] ?? 0) + 1; }
  const exported = new Set(files.map((f) => f.app));
  const apps: AppAudit[] = [...files.map((f) => ({ app: f.app, status: "exported" as const })), ...audits.filter((a) => !exported.has(a.app))];
  return { rows, apps, counts };
}

/** For every crossover concept: which exported apps have it and which do not. This is the "what to add next" list. */
export function conceptGaps(m: Master): Array<{ concept: string; have: string[]; missing: string[]; examples: string[] }> {
  const exported = m.apps.filter((a) => a.status === "exported").map((a) => a.app);
  const by = new Map<string, CustomRow[]>();
  for (const r of m.rows) if (r.concept) by.set(r.concept, [...(by.get(r.concept) ?? []), r]);
  return [...by.entries()].map(([concept, rs]) => {
    const have = [...new Set(rs.map((r) => r.app))];
    return { concept, have, missing: exported.filter((a) => !have.includes(a)), examples: rs.slice(0, 2).map((r) => `${r.name} (${r.app})`) };
  }).filter((g) => g.missing.length > 0).sort((a, b) => a.concept.localeCompare(b.concept));
}

const cell = (s: string): string => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/** The readable document: summary, the crossover gap list, then one table per app and kind. */
export function toMarkdown(m: Master, generated: string): string {
  const L: string[] = [];
  L.push("# Lok customization table", "", `Generated ${generated} from each app's own data by \`tools/customization-table/build.mjs\`. Do not edit by hand: change the app, re-export, rebuild.`, "");
  L.push("## Apps", "", "| App | Status | Items |", "|---|---|---|");
  for (const a of m.apps) L.push(`| ${a.app} | ${a.status === "exported" ? "exported" : "not audited yet" + (a.note ? ": " + cell(a.note) : "")} | ${Object.values(m.counts[a.app] ?? {}).reduce((x, y) => x + y, 0)} |`);
  const gaps = conceptGaps(m);
  L.push("", "## Crossover ideas and where they are missing", "", gaps.length ? "| Idea | Exists in | Missing in | Examples |\n|---|---|---|---|" : "No gaps found.");
  for (const g of gaps) L.push(`| ${g.concept} | ${g.have.join(", ")} | ${g.missing.join(", ")} | ${cell(g.examples.join("; "))} |`);
  const apps = [...new Set(m.rows.map((r) => r.app))];
  for (const app of apps) {
    L.push("", `## ${app}`, "");
    const kinds = [...new Set(m.rows.filter((r) => r.app === app).map((r) => r.kind))];
    for (const k of kinds) {
      const rs = m.rows.filter((r) => r.app === app && r.kind === k);
      L.push(`### ${k} (${rs.length})`, "", "| Name | Id | Tier | How | Price | Scope | Effect | Idea |", "|---|---|---|---|---|---|---|---|");
      for (const r of rs) L.push(`| ${cell(r.name)} | \`${r.id}\` | ${r.tier} | ${r.access} | ${r.price ?? ""} | ${r.scope} | ${r.effect} | ${r.concept ?? ""} |`);
      L.push("");
    }
  }
  return L.join("\n");
}

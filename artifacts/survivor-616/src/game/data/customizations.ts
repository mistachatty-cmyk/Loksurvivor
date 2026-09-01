import { THEMED_PALETTES_BY_ID } from "@/game/data/themedPalettes";
import { UI_THEMES_BY_ID } from "@/game/data/uiThemes";
import type { CustomizationLook, LokCustomizationBundleV1 } from "@/game/types";

export const LOK_CUSTOMIZATION_SCHEMA = "lok.customization-bundle" as const;
export const LOK_CUSTOMIZATION_VERSION = 1 as const;
export const LOK_SURVIVOR_NAMESPACE = "lok.survivor-616" as const;
export const MAX_CUSTOMIZATION_LOOKS = 50;
const MAX_LOOK_NAME_LENGTH = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function sanitizeLookName(
  value: unknown,
  fallback = "Untitled Look",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, MAX_LOOK_NAME_LENGTH) || fallback;
}

function normalizeProvenance(value: unknown): CustomizationLook["provenance"] {
  if (!isRecord(value)) return { source: "imported" };
  const author =
    typeof value.author === "string"
      ? value.author.trim().slice(0, 60)
      : undefined;
  return {
    source: value.source === "local" ? "local" : "imported",
    ...(author ? { author } : {}),
  };
}

export function normalizeCustomizationLook(
  value: unknown,
): CustomizationLook | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    !/^[a-z0-9][a-z0-9._:-]{2,95}$/i.test(value.id)
  )
    return null;
  if (typeof value.uiThemeId !== "string" || !UI_THEMES_BY_ID[value.uiThemeId])
    return null;
  if (
    typeof value.paletteId !== "string" ||
    !THEMED_PALETTES_BY_ID[value.paletteId]
  )
    return null;

  const theme = UI_THEMES_BY_ID[value.uiThemeId];
  const uiSwatchId =
    typeof value.uiSwatchId === "string" ? value.uiSwatchId : undefined;
  if (uiSwatchId && !theme.swatches?.some((swatch) => swatch.id === uiSwatchId))
    return null;

  const createdAt =
    typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? Math.max(0, Math.floor(value.createdAt))
      : 0;
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? Math.max(createdAt, Math.floor(value.updatedAt))
      : createdAt;

  return {
    id: value.id,
    name: sanitizeLookName(value.name),
    uiThemeId: value.uiThemeId,
    ...(uiSwatchId ? { uiSwatchId } : {}),
    paletteId: value.paletteId,
    createdAt,
    updatedAt,
    provenance: normalizeProvenance(value.provenance),
  };
}

export function normalizeCustomizationLooks(
  value: unknown,
): CustomizationLook[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, CustomizationLook>();
  for (const candidate of value) {
    const look = normalizeCustomizationLook(candidate);
    if (!look) continue;
    const existing = byId.get(look.id);
    if (existing) {
      if (look.updatedAt >= existing.updatedAt) byId.set(look.id, look);
      continue;
    }
    if (byId.size < MAX_CUSTOMIZATION_LOOKS) byId.set(look.id, look);
  }
  return [...byId.values()];
}

export function mergeCustomizationLooks(
  existing: CustomizationLook[],
  incoming: CustomizationLook[],
): CustomizationLook[] {
  return normalizeCustomizationLooks([...existing, ...incoming]);
}

export function createCustomizationBundle(
  looks: CustomizationLook[],
  exportedAt = new Date().toISOString(),
): LokCustomizationBundleV1 {
  return {
    schema: LOK_CUSTOMIZATION_SCHEMA,
    schemaVersion: LOK_CUSTOMIZATION_VERSION,
    namespace: LOK_SURVIVOR_NAMESPACE,
    exportedAt,
    provenance: { generator: "Loksurvivor", ownership: "references-only" },
    looks: normalizeCustomizationLooks(looks),
  };
}

export type ParseCustomizationBundleResult =
  | { ok: true; bundle: LokCustomizationBundleV1; skipped: number }
  | { ok: false; error: string };

export function parseCustomizationBundle(
  text: string,
): ParseCustomizationBundleResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isRecord(raw))
    return { ok: false, error: "The bundle must be a JSON object." };
  if (
    raw.schema !== LOK_CUSTOMIZATION_SCHEMA ||
    raw.schemaVersion !== LOK_CUSTOMIZATION_VERSION
  ) {
    return {
      ok: false,
      error: "Unsupported LOK customization schema or version.",
    };
  }
  if (raw.namespace !== LOK_SURVIVOR_NAMESPACE) {
    return {
      ok: false,
      error: "This customization bundle belongs to another LOK project.",
    };
  }
  if (!Array.isArray(raw.looks))
    return { ok: false, error: "The bundle does not contain a looks list." };

  const looks = normalizeCustomizationLooks(raw.looks).map((look) => ({
    ...look,
    provenance: { ...look.provenance, source: "imported" as const },
  }));
  return {
    ok: true,
    bundle: createCustomizationBundle(
      looks,
      typeof raw.exportedAt === "string"
        ? raw.exportedAt
        : new Date(0).toISOString(),
    ),
    skipped: raw.looks.length - looks.length,
  };
}

export function missingLookAssets(
  look: CustomizationLook,
  ownedUiThemeIds: string[],
  ownedPaletteIds: string[],
): string[] {
  const missing: string[] = [];
  if (!ownedUiThemeIds.includes(look.uiThemeId)) missing.push("theme");
  if (!ownedPaletteIds.includes(look.paletteId)) missing.push("palette");
  return missing;
}

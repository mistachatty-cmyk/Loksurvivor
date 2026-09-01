import { useState, type ChangeEvent } from "react";
import {
  Check,
  Download,
  Layers3,
  LockKeyhole,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import {
  createCustomizationBundle,
  missingLookAssets,
  parseCustomizationBundle,
} from "@/game/data/customizations";
import { THEMED_PALETTES_BY_ID } from "@/game/data/themedPalettes";
import { UI_THEMES_BY_ID } from "@/game/data/uiThemes";
import { activeUiThemeSwatchId, useMeta } from "@/game/state/metaStore";
import { ScreenLayout } from "./ScreenLayout";

interface Props {
  onBack: () => void;
}

function createLookId(): string {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `lok.survivor-616.look.${suffix}`;
}

export function LookbookStudioPanel({ onBack }: Props) {
  const {
    meta,
    saveCustomizationLook,
    renameCustomizationLook,
    deleteCustomizationLook,
    equipCustomizationLook,
    importCustomizationLooks,
  } = useMeta();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [notice, setNotice] = useState("");

  const activeTheme = UI_THEMES_BY_ID[meta.uiTheme];
  const activeSwatchId = activeUiThemeSwatchId(meta);
  const activeSwatch = activeTheme?.swatches?.find(
    (swatch) => swatch.id === activeSwatchId,
  );
  const activePalette = THEMED_PALETTES_BY_ID[meta.activePaletteId];

  const handleSave = () => {
    if (meta.customizationLooks.length >= 50) {
      setNotice("The Lookbook is full. Delete a look before saving another.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Name the current look before saving it.");
      return;
    }
    saveCustomizationLook(createLookId(), trimmed);
    setName("");
    setNotice(`Saved “${trimmed.slice(0, 40)}”.`);
  };

  const handleRename = (id: string) => {
    if (!editingName.trim()) return;
    renameCustomizationLook(id, editingName);
    setEditingId(null);
    setEditingName("");
    setNotice("Look renamed.");
  };

  const handleExport = () => {
    if (meta.customizationLooks.length === 0) {
      setNotice("Save at least one look before exporting.");
      return;
    }
    const json = JSON.stringify(
      createCustomizationBundle(meta.customizationLooks),
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "loksurvivor-lookbook.loklook.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(
      `Exported ${meta.customizationLooks.length} saved look${meta.customizationLooks.length === 1 ? "" : "s"}.`,
    );
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice("That customization file could not be read.");
      return;
    }
    const parsed = parseCustomizationBundle(text);
    if (!parsed.ok) {
      setNotice(parsed.error);
      return;
    }
    importCustomizationLooks(parsed.bundle.looks);
    const imported = parsed.bundle.looks.length;
    setNotice(
      `Imported ${imported} look${imported === 1 ? "" : "s"}${parsed.skipped ? `; skipped ${parsed.skipped} invalid entr${parsed.skipped === 1 ? "y" : "ies"}` : ""}.`,
    );
  };

  return (
    <ScreenLayout
      title="Lookbook Studio"
      subtitle="Build it once. Wear it anywhere."
      onBack={onBack}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
        <section
          className="border border-border bg-card p-5 sm:p-6"
          data-testid="section-lookbook-capture"
        >
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Current combination
              </p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">
                Capture this look
              </h2>
            </div>
          </div>

          <div className="mt-5 border border-border bg-background p-4">
            <p className="text-sm font-black uppercase text-white">
              {activeTheme?.name ?? "Unknown theme"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeSwatch?.name ?? "Built-in accent"} ·{" "}
              {activePalette?.name ?? "Standard palette"}
            </p>
            <div
              className="mt-3 flex h-8 overflow-hidden border border-white/10"
              aria-label="Current look color preview"
            >
              <span
                className="flex-1"
                style={{
                  backgroundColor: activeSwatch
                    ? `hsl(${activeSwatch.primaryHsl})`
                    : "hsl(var(--primary))",
                }}
              />
              {[
                activePalette?.palette.body,
                activePalette?.palette.accent,
                activePalette?.palette.accentBright,
                activePalette?.palette.glow,
              ]
                .filter((color): color is string => Boolean(color))
                .map((color) => (
                  <span
                    key={color}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
            </div>
          </div>

          <label
            className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            htmlFor="look-name"
          >
            Look name
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="look-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
              maxLength={40}
              placeholder="After-hours signal"
              data-testid="input-look-name"
              className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={meta.customizationLooks.length >= 50}
              data-testid="button-save-look"
              className="flex items-center gap-2 border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExport}
              data-testid="button-export-lookbook"
              className="flex items-center justify-center gap-2 border border-border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-white"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 border border-border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-white">
              <Upload className="h-4 w-4" /> Import
              <input
                type="file"
                accept="application/json,.json,.loklook"
                onChange={handleImport}
                className="sr-only"
                data-testid="input-import-lookbook"
              />
            </label>
          </div>

          <p
            className="mt-4 min-h-10 text-xs leading-relaxed text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {notice ||
              "Portable files reference owned assets; importing never unlocks paid themes or palettes."}
          </p>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Local collection
              </p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">
                Saved looks
              </h2>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {meta.customizationLooks.length}/50
            </span>
          </div>

          {meta.customizationLooks.length === 0 ? (
            <div className="mt-5 border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Your Lookbook is empty. Mix a UI theme in Settings with a Paint
              Gallery palette, then save it here.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {meta.customizationLooks.map((look) => {
                const theme = UI_THEMES_BY_ID[look.uiThemeId];
                const swatch = theme?.swatches?.find(
                  (candidate) => candidate.id === look.uiSwatchId,
                );
                const palette = THEMED_PALETTES_BY_ID[look.paletteId];
                const missing = missingLookAssets(
                  look,
                  meta.ownedUiThemeIds,
                  meta.ownedPaletteIds,
                );
                const isActive =
                  meta.uiTheme === look.uiThemeId &&
                  activeSwatchId === look.uiSwatchId &&
                  meta.activePaletteId === look.paletteId;
                const isEditing = editingId === look.id;
                return (
                  <article
                    key={look.id}
                    className={`border p-4 ${isActive ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                    data-testid={`card-look-${look.id}`}
                  >
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleRename(look.id);
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          maxLength={40}
                          autoFocus
                          aria-label={`Rename ${look.name}`}
                          className="min-w-0 flex-1 border border-primary bg-card px-2 py-1 text-sm text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(look.id)}
                          aria-label="Save name"
                          className="border border-primary p-2 text-primary"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">
                          {look.name}
                        </h3>
                        {isActive ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-label="Active look"
                          />
                        ) : null}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-muted-foreground">
                      {theme?.name} · {swatch?.name ?? "Built-in accent"} ·{" "}
                      {palette?.name}
                    </p>
                    <div className="mt-3 flex h-6 overflow-hidden border border-white/10">
                      <span
                        className="flex-1"
                        style={{
                          backgroundColor: swatch
                            ? `hsl(${swatch.primaryHsl})`
                            : "hsl(var(--primary))",
                        }}
                      />
                      {[
                        palette?.palette.body,
                        palette?.palette.accent,
                        palette?.palette.glow,
                      ]
                        .filter((color): color is string => Boolean(color))
                        .map((color) => (
                          <span
                            key={color}
                            className="flex-1"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                    </div>

                    {missing.length > 0 ? (
                      <p className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        <LockKeyhole className="h-3 w-3" /> Missing owned{" "}
                        {missing.join(" + ")}
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => equipCustomizationLook(look.id)}
                        data-testid={`button-equip-look-${look.id}`}
                        disabled={missing.length > 0 || isActive}
                        className="border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50"
                      >
                        {isActive ? "Equipped" : "Equip"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(look.id);
                          setEditingName(look.name);
                        }}
                        aria-label={`Rename ${look.name}`}
                        className="border border-border p-2 text-muted-foreground hover:border-primary hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomizationLook(look.id)}
                        aria-label={`Delete ${look.name}`}
                        className="border border-border p-2 text-muted-foreground hover:border-red-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ScreenLayout>
  );
}

export default LookbookStudioPanel;

import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomizationBundle,
  mergeCustomizationLooks,
  missingLookAssets,
  normalizeCustomizationLooks,
  parseCustomizationBundle,
} from "@/game/data/customizations";
import type { CustomizationLook } from "@/game/types";
import { createInitialMeta, reducer } from "@/game/state/metaStore";

const look: CustomizationLook = {
  id: "lok.survivor-616.look.night-run",
  name: "Night Run",
  uiThemeId: "night-drive",
  uiSwatchId: "blue-hour",
  paletteId: "neon-night",
  createdAt: 10,
  updatedAt: 10,
  provenance: { source: "local", author: "Player" },
};

test("a customization bundle round-trips through the portable schema", () => {
  const bundle = createCustomizationBundle([look], "2026-09-01T00:00:00.000Z");
  const parsed = parseCustomizationBundle(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.bundle.namespace, "lok.survivor-616");
  assert.equal(parsed.bundle.provenance.ownership, "references-only");
  assert.deepEqual(parsed.bundle.looks[0], {
    ...look,
    provenance: { source: "imported", author: "Player" },
  });
});

test("normalization rejects unknown catalog references and keeps the newest stable id", () => {
  const normalized = normalizeCustomizationLooks([
    look,
    { ...look, name: "Updated Night Run", updatedAt: 20 },
    { ...look, id: "bad", uiThemeId: "unknown-theme" },
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.name, "Updated Night Run");

  const merged = mergeCustomizationLooks(
    [look],
    [{ ...look, name: "Imported Update", updatedAt: 30 }],
  );
  assert.equal(merged[0]?.name, "Imported Update");
});

test("portable looks reference ownership instead of granting it", () => {
  assert.deepEqual(missingLookAssets(look, ["house"], ["default"]), [
    "theme",
    "palette",
  ]);
  assert.deepEqual(
    missingLookAssets(
      look,
      ["house", "night-drive"],
      ["default", "neon-night"],
    ),
    [],
  );
});

test("malformed and cross-project bundles fail safely", () => {
  assert.equal(parseCustomizationBundle("{").ok, false);
  const other = {
    ...createCustomizationBundle([look]),
    namespace: "lok.somewhere-else",
  };
  assert.deepEqual(parseCustomizationBundle(JSON.stringify(other)), {
    ok: false,
    error: "This customization bundle belongs to another LOK project.",
  });
});

test("the meta store saves and equips owned combinations without granting imported assets", () => {
  let state = { meta: createInitialMeta(), lastRun: null };
  state = reducer(state, {
    type: "saveCustomizationLook",
    id: "lok.survivor-616.look.house-standard",
    name: "House Standard",
    now: 100,
  });
  assert.equal(state.meta.customizationLooks.length, 1);
  assert.equal(state.meta.customizationLooks[0]?.uiThemeId, "house");
  assert.equal(state.meta.customizationLooks[0]?.paletteId, "default");

  state = reducer(state, { type: "importCustomizationLooks", looks: [look] });
  const beforeEquip = state;
  state = reducer(state, { type: "equipCustomizationLook", id: look.id });
  assert.equal(state, beforeEquip);
  assert.deepEqual(state.meta.ownedUiThemeIds, ["house"]);
  assert.deepEqual(state.meta.ownedPaletteIds, ["default"]);
});

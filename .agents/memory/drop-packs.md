---
name: Drop packs (pickup art)
description: Cosmetic art sets for every pickup; Potato Pack is the free original, the rest are LokToken-only. Render-only.
---

# Drop packs

Every `PickupKind` (gems, coins, chests, crafting materials) is drawn by the
equipped **drop pack**. Packs are cosmetic and render-only: they never change
what drops, how much, or magnet/collection rules (`updatePickups` in
`engine/world.ts` is untouched apart from a small particle burst).

- **Data:** `data/dropPacks.ts` (`DROP_PACKS`, `DropStyle`, `getDropStyle`).
  `MetaState.ownedDropPackIds` / `activeDropPackId`, actions `grantDropPack` /
  `equipDropPack` (`state/metaStore.tsx`). The run reads it as `World.dropStyle`
  (`RunScreen.tsx` -> `createWorld` setup).
- **Potato Pack = `classic`** is the art the game always shipped
  (`drawPickupClassic` in `render/draw.ts`, extracted unchanged). It is the free
  default, and `performance` graphics always falls back to it. Never restyle it:
  it is the "original look" promise to existing players.
- **Other packs** are LokToken-only (`'dropPack'` in `LOKTOKEN_ONLY_KINDS`,
  `catalogSku('dropPack', id)`), bought from the Drop packs tab in
  `ui/PaletteGalleryPanel.tsx` with a live `ui/DropPackPreview.tsx` strip.
  Tier sets the placeholder price. `cost` only marks a pack sellable (> 0).
- **Renderers:** `render/pickupArt.ts` (toon, "Pop Cut"), and
  `render/pickupArtStyles.ts` (realistic, tech, pixel, plus the shape-driven
  blueprint / neon / paper packs, which share `render/pickupArtShapes.ts`).
  `drawStyledPickup` owns the shared spawn hop, bob, magnet streak; each style
  only draws the object. All animation is a pure function of
  `now - bornAt` and `uid` -- no `Math.random()` in the draw path.
- **Perf rule:** with more than 120 live pickups, gradient-heavy styles draw XP
  as a flat gem (`cheapGem`). Keep new styles cheap per object.
- **Adding a pack:** add a `DropPackDef` (and a `DropStyle` value + renderer),
  re-run `pnpm exec tsx scripts/export-lok-registry.ts <dir>` and apply only the
  new `survivor616.dropPack.*` rows. The shared store has no other 616 rows yet:
  applying the whole file would also flip palettes to LokToken-only.
- **Achievements:** `new-loot-look`, `pack-rat`, `full-stash` (economy).

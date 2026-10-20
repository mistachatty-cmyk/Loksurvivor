# Survivor616: 616/Null Breach map pack

## Arenas

- **Floodline Breach** is a 2400 × 1800, eight-minute transit arena. Street entrance, flooded platform, exchange, root grove, and relay yard use different ground and cover. Three authored entry lanes schedule city and Null enemies at distinct times. Two relay consoles open the northern barricade; three destructible node pylons quiet the visible spore vents. A cache yields supplies. The 616 Plate unlocks the Breach 616 menu and editor theme, while the Transit Coil grants the Catenary Harpoon now and unlocks it for later weapon rolls. Finds persist on defeat.
- **Glassroot Annex** is a 1600 × 1400, six-minute Null arena with winding arch corridors, holographic tree decoys, a central shrine, and its own encounter schedule.

Both arenas are finite bonus routes. Their authored data lives in `artifacts/survivor-616/src/game/data/areas-breach.ts`. The editor can load either as an editable template. The map pack has 16 individually drawn street and Null props and eight built-in prefab groups. Breakable props have damaged and destroyed art; cosmetic placements draw without collision.

## Builder

The v2 custom map record stores dimensions, ground, tiles, scenery mode, grouped placements, starts, entry lanes, wave positions and timing, pickups, interactables, ambiance, and the map feature. Saving a v1 map migrates it while retaining its existing placements. Editor preview, playtest, and runtime all convert this same record through `customMapToArea`.

Use the asset search to place an item, Shift or Ctrl click to select several, then group, drag, rotate, duplicate, ungroup, or save a named personal prefab. Built-in prefabs stay available for every route. Personal prefabs are stored locally under `survivor616-map-prefabs-v1`. Seeded remix starts from the curated street, Null, or breach template and returns a normal draft. The editor has zoom, scroll pan, grid visibility and snap, undo/redo, property fields, encounter timing, and direct playtest. Preflight reports missing threats, blocked starts and entries, invalid wave windows, and placement limits.

## Controls and performance

Use **F**, controller **A**, or the on-screen **Use** button near a console, cache, or find. Root anchors are destroyed with weapons. Rootglass Cells reduce weapon cooldown for 20 seconds. Reduced graphics omit decorative spores while preserving interactable markers. The Catenary Harpoon target and damage chain is computed in the engine; its amber/cyan wire and sparks are decorative.

## Verification

Focused tests cover map migration and round trips, built-in templates, deterministic remix and quarter-turn prefab transforms, interactions and find results, and weapon data. Browser tests cover a desktop template save/reload and mobile scenery placement. The normal `pnpm typecheck`, `pnpm test`, `pnpm build`, and Playwright suite remain release gates.

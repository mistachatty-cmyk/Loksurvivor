# Odd Routes — 2026-09-10

Four large authored arenas extend `AREAS` through `data/areas-weird.ts`:

- `mirror-mile`: paired reflective lanes and pincer/wall pressure.
- `clockmouth-roundabout`: concentric prop rings, a central triggered pothole, ring waves, and random drops.
- `null-orchard`: generated rows of flora and fuse boxes, fog, lane openings, and random drops.
- `sideways-forty`: a tall elevator-graveyard corridor using heavy boxes, attack blocks, and reflective dividers.

These maps deliberately reuse existing obstacle, landmark, weather, formation, and random-drop systems. Keep weird-map identity in layout grammar rather than adding unique texture packs or a second map engine.

`RunModifiers.quadSpawnMode` is an optional persisted 4× multiplier for normal authored wave cadence. It overrides `doubleMode`'s 2× spawn portion when both are selected, preventing an accidental 8× multiplier; `doubleMode` still contributes its documented HP bump. Existing enemy caps and endless-mode spawn-rate caps remain intact for performance.


---
name: Sky ambiance contract
description: Durable rules for the drifting clouds/shadows, birds, and road fireflies in render/draw.ts.
---

Cloud puffs, their ground shadows, bird flocks, and firefly clusters
(`render/draw.ts`, "Sky ambiance" section) are computed purely from world
position + `w.now` each frame -- no engine/simulation state, no `AmbientKindDef`
actors. They're gated off entirely (`isIndoor`) inside dungeon rooms and
building interiors.

**Why:**
These are decoration only, never touched by collision/damage code, so there
was no reason to add World fields or step them in `stepWorld` -- the same
reasoning `data/ambient.ts`'s civilian/cat actors were meant to follow (that
system is defined but currently unwired: never spawned or referenced by
`world.ts`, `RunScreen.tsx`, or `draw.ts`. Wiring it up is still open ambiance
work.)

Ground-level effects (cloud shadows, fireflies) MUST clip their placement
grid to the actual arena via `clipToArena()` before iterating, not to the
raw padded camera viewport.

**Why:**
For every non-endless story area, `drawArenaEdges` paints opaque
`w.bounds`-void rectangles *after* ground dressing but *before* the HUD --
and it's called after `drawCloudShadows`/`drawRoadFireflies` in
`renderWorld`. Most story bounds (~620-1080 world units, see
`data/areas.ts`) are smaller than the camera's padded view span, so a grid
sized/positioned off the raw viewport mostly lands in that void and silently
never appears on screen -- confirmed by swapping in opaque debug colors and
reading back canvas pixels; the shapes computed fine, they were just being
painted over a frame later. `clipToArena()` is a no-op for endless areas
(unbounded, `drawArenaEdges` returns immediately there anyway).

Sky-layer effects that render *last* (birds, the clouds themselves, both
drawn just before `ctx.restore()` in `renderWorld`) don't need clipping --
nothing draws after them, so being positioned in the void just means
off-camera, not covered.

**How to apply:**
Any new ground-anchored cosmetic effect (grid-cell dressing, glow, decal)
added to `renderWorld` before `drawArenaEdges` needs `clipToArena()` on its
view bounds first. Anything added after `drawArenaEdges` (or intentionally
sky-layer, drawn near the end) does not.

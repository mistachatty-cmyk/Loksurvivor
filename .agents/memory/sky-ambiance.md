---
name: Ambiance contract
description: Durable rules for the render-layer ambiance (clouds/shadows, birds, fireflies, litter, steam, lightning) and the simulated ambient civilian/cat actors.
---

Ambiance in this game splits into two kinds, and the split is the load-bearing
part:

**Render-layer ambiance** -- cloud puffs, their ground shadows, bird flocks,
firefly clusters, wind-blown litter, steam vents, neon flicker, and lightning
(all in `render/draw.ts`) -- is computed purely from world position + `w.now`
each frame. No `World` fields, nothing stepped in `stepWorld`. Gated off
(`isIndoor`) inside dungeon rooms and building interiors.

**Simulated ambient actors** -- `data/ambient.ts`'s civilians and cats -- do
need state (a wander target, a flee reaction), so they live on `World.ambient`
and are stepped by `updateAmbient` in `stepWorld`. They are still cosmetic:
never added to the enemy list or spatial grid, never collided with, never
damaged, and structurally incapable of it (`AmbientActor` has no `hp`).

**Why:** decoration should not be able to change a run. Anything that can be
derived per-frame stays in the renderer where it cannot touch the sim at all;
only the things that genuinely need memory get `World` state, and those get
kept out of every combat path by construction rather than by discipline.

`updateAmbient` draws from `World.ambientRng`, a stream separate from
`World.rng`.

**Why:**
`rng` drives waves, objectives, loot, and incursions, and runs are seeded --
so consuming from it for background life would shift gameplay rolls for a
given seed and break seeded tests. Tuning or adding ambient life must never
have that reach. There is a regression test asserting a drained `ambientRng`
leaves `rng` and the rolled objectives identical.

Ambient actors are drawn (`drawAmbient`) *before* `drawObstacles`, so props
occlude them.

**Why:**
It reads as background life moving behind the parked cars, and it hides the
fact that they pass through scenery -- they deliberately have no collision, so
occlusion is doing the work a physics pass would otherwise have to.

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

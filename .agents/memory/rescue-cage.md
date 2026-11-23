---
name: Rescue cage art and feedback
description: Where the trapped-survivor cage, freeing animation, burst and off-screen pointer live, and what feeds them.
---

# Rescue cage (v0.42.71)

- Art: `src/game/render/rescueArt.ts` (`drawRescue`, `drawRescuePointer`, `rescuePointerPlacement`). Procedural Canvas2D, the real ally rig is drawn inside the bars. All motion is a function of `w.now`, `rescue.progress` and `rescue.freedAt`.
- Engine: `updateRescue` in `engine/world.ts` sets `rescue.freedAt`, shakes the screen, queues `uiNav` (step into ring), `obstacleBreak` + `lootBox` (freed) and a FREED popup. `waveStart` cue when the cage appears.
- The pointer is screen space and is called after the vignette in `renderWorld`.
- Tests: `render/rescueArt.test.ts` (fake canvas, needs a Path2D stub in node).
- Not done: a minimap pin for the cage (the minimap is endless-mode data only), and a visible walk-home trail for the freed ally.

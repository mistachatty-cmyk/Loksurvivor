---
name: nearestEnemy/uid-lookup collision pass — 2026-09-22
description: Why crowd combat still froze/crashed (including on iPhone 17 Pro) after the 2026-09-12 swarm pass, and what closed the remaining O(n²) hole.
---

# nearestEnemy / uid-lookup collision pass — 2026-09-22

## Why the earlier pass didn't catch this

`swarm-performance-2026-09-12.md` profiled a build with `weapons: []` and no
allies, specifically to isolate raw enemy accumulation. That's exactly why it
never saw the hottest remaining path: `nearestEnemy()` (`world.ts`), used for
weapon targeting, evolution-hit chaining, homing-projectile retarget, and —
the case that actually bites — once per converted/commanded enemy per frame
from `updateEnemies` and `advanceCommandedUnit` (Sector Command). Unlike
`forEachNearby`, which already walks `w.grid` in cell-bucketed fashion,
`nearestEnemy` did a full unfiltered scan of `w.enemies`. With the Unleashed
cap at 1,000 enemies and even a modest number of commanded/converted units,
this is `O(units × enemies)` scans, 60×/sec — real quadratic cost that a
combat-free accumulation profile can't see, and exactly the kind of frame
spike that reads as a "crash" (a long GC/main-thread stall) on constrained
hardware, iOS Safari included, even though nothing there is actually leaking
memory.

A second, smaller instance of the same pattern: several one-shot uid
lookups (`w.enemies.find(e => e.uid === ...)`) for homing-projectile
retarget and thrown/carried-enemy resolution — each an O(n) scan, called per
projectile/throw per frame.

## Fixes

- `nearestEnemy` now walks the same fixed cell-box `forEachNearby` uses
  (expand `Math.ceil(maxRange / CELL)` cells around the query point) instead
  of scanning all of `w.enemies`, tracking the closest hit instead of
  visiting every one. Its `exclude?: Set<number>` param is preserved for
  multi-id excludes (e.g. `proj.hitUids`) but call sites that only needed to
  exclude a single id (`new Set([enemy.uid])`, allocated fresh every call)
  now pass a new `excludeUid?: number` instead — no more throwaway `Set`
  per lookup per frame.
- Added `w.enemiesByUid: Map<number, EnemyActor>`, rebuilt alongside
  `w.grid` inside `rebuildGrid` (called once at the *top* of `updateEnemies`
  now, not only right before the separation pass — the converted-ally and
  commanded-unit targeting earlier in that same function needed it current
  too). Kept in sync at the two mid-frame `w.enemies.splice()` sites and the
  one `w.enemies.push()` site (`spawnEnemy`).
  **Deliberately not used for every uid lookup** — only the ones guaranteed
  to run during a `stepWorld` frame after `rebuildGrid` (homing-projectile
  retarget, thrown-enemy impact resolution, dash-skill pending-landing
  lookup). The UI/order-triggered functions (`orderSelectedUnits`,
  `throwSelectedFrozenEnemies`, `selectCommandedUnitByUid`) were **reverted
  back to `.find()`** after converting them broke `world.test.ts`: those
  tests (and legitimate UI call patterns) can call these functions before
  any `stepWorld` has run, and test fixtures also routinely reassign
  `.uid` after construction (`addEnemy()` defaults to uid 900, tests then
  override it) — both patterns leave `enemiesByUid` stale or pointing at the
  wrong object for a manually-constructed enemy. Real `spawnEnemy` output
  never reassigns `.uid` after creation, so this only bit hand-built
  fixtures/cold-path callers, not the hot per-frame paths the map exists for.
- `w.obstacleGrid` was being rebuilt from scratch every single frame for
  static data (`rebuildObstacleGrid`, called unconditionally each
  `stepWorld`). Added `w.obstacleGridDirty`, defaulting `true` and flipped
  by every site that actually mutates `w.obstacles`/`w.breakables`
  (`syncObstacleAabbs`, endless chunk streaming, dungeon room/building
  transitions) — `rebuildObstacleGrid` now no-ops when nothing changed.
- `drawObstacles` (`render/draw.ts`) had an `if (w.area.endless) { A } else { A }`
  with byte-identical branches (dead code — no per-mode behavior at all) and,
  unlike the enemy render path right below it, no camera-bounds culling: it
  filtered+mapped *every* breakable in the loaded chunk set into new objects
  every frame regardless of whether it was on screen. Now takes `viewBounds`
  (already computed once in `renderWorld`) and only builds entries for
  breakables within `viewBounds ± 80px`, matching the pattern already used
  for enemy sprites.

## Verified not a problem

- Player-projectile "split" evolution (`world.ts`, `evolutionBehavior.kind
  === 'split'`): confirmed the newly-spawned split projectiles' object
  literal has no `evolutionBehavior` field at all, so a split child can't
  re-split. Not exponential, one level deep by construction — no fix needed.
- Audio/music playback (`musicPlayer.tsx`, `analysis.ts`, `beatBus.ts`,
  `sfxEngine.ts`, `ambience.ts`): single shared `AudioContext`/`AnalyserNode`,
  throttled FFT/autocorrelation work, every oscillator/buffer-source node
  disconnected via `onended`, object URLs and the context cleaned up on
  unmount. Nothing here reallocates or leaks per frame. If "crashes while a
  song is playing" persists after this pass, it's much more likely downstream
  of a frame stall elsewhere (this pass's fix, or a future one) coinciding
  with music being on, than the audio code itself — get an actual repro
  before assuming this file if it recurs.
- Canvas sizing / listener lifecycle (`RunScreen.tsx`): DPR clamped to 2 and
  multiplied by a dynamic backing-scale that steps down under load; key/blur/
  visibility listeners added and removed symmetrically. Particles/popups are
  already budget-clamped and spliced down every frame. No unbounded growth
  found here.

## What's still not "thousands on screen"

`NORMAL_ENEMY_CAP = 190` / `UNLEASHED_ENEMY_CAP = 1000` (`world.ts`) are
unchanged by this pass, and simulation intentionally still updates every
live enemy regardless of visibility — only rendering culls to viewport
(`draw.ts`, enemy sprite pass, with the comment explaining why: "simulation
still owns all 1,000 Unleashed enemies"). Raising the cap toward literal
thousands needs a further structural change this pass does not make:
separating broad-phase (grid membership, cheap) from narrow-phase (AI/damage
update, expensive) and skipping narrow-phase work for enemies far outside
the viewport/interaction radius — not just draw culling. Re-profile the same
way `swarm-performance-2026-09-12.md` did (real V8 profile, not a guess)
before spending more budget here.

---
name: Swarm performance pass — 2026-09-12
description: Where simulation time actually went at high enemy density, and how it was measured.
---

# Swarm performance — 2026-09-12

## How this was found

Guessing at hotspots in a ~6,800-line simulation is unreliable. This pass instead
scripted `createWorld`/`stepWorld` directly under Node (`tsx`, no browser) with
the player god-moded and `weapons: []` (so nothing dies and enemies purely
accumulate), used `endless-streets` to reach several hundred enemies, then took
a real V8 CPU profile via `node:inspector`'s `Session.post('Profiler.start'/'stop')`
around just the steady-state loop (not the warmup). That is the repeatable way
to re-check this claim or investigate the next bottleneck — don't re-guess from
reading the source a second time.

## What was actually slow (~850 enemies, before this pass)

- `collideObstacles` — **40%** of frame time. Called once per enemy (and once
  for the player) and looped every `w.obstacles` unconditionally. Obstacle
  count scales with how much of the map is loaded (endless chunk streaming),
  so this was an unbounded O(enemies × obstacles) term hiding in what looks
  like a simple per-actor collision call.
- The enemy-crowd separation pass (`updateEnemies`'s tail, `forEachNearby` +
  its per-enemy arrow-function callback) — **~35%** combined. This runs once
  per enemy, unlike every other `forEachNearby` call site (once per
  projectile/effect/prop tick), so it's the one place a fresh closure
  allocation and an indirect callback invocation per neighbor actually
  mattered.
- `updatePickups` — **22%**, and *not* proportional to enemy count: pickups
  have no expiry and no cap, so a run that doesn't backtrack to collect
  (the synthetic benchmark's constant-direction input, but just as plausible
  for a real player clearing a horde and moving on) accumulates them without
  bound. This is as much a latent memory/cost leak as a hotspot — it was still
  growing when the profile was taken.

## Fixes

- `collideObstacles` now queries a per-frame-rebuilt `w.obstacleGrid`
  (same `CELL`/hash scheme as the existing enemy `w.grid`) instead of
  scanning every obstacle. An obstacle can span multiple cells (a building
  is bigger than one 48-unit cell), so it's registered in every cell its
  AABB touches; a query re-testing the same box from two cells is
  correctness-neutral since `resolveCircleBox` is a no-op once the actor no
  longer overlaps. Rebuilt once at the top of `stepWorld`, before
  `updatePlayer` — this means an actor's obstacle collision this frame can be
  one frame behind an endless-chunk streaming event that swaps `w.obstacles`
  later in the same `stepWorld` call, which is imperceptible (chunks stream
  in well ahead of the player reaching them).
- The separation pass no longer calls `forEachNearby` with a callback; it's
  inlined as a direct nested loop over `w.grid` cells in the same function.
  Same math, same one-symmetric-resolution-per-pair behavior, zero
  per-enemy closures. Left `forEachNearby` itself untouched — every other
  caller runs at event frequency, not per-enemy, so it was never the problem.
- Added `PICKUP_CAP = 600` in `updatePickups`: once collection/expiry logic
  runs each frame, if the array is still over the cap, trim the *front*
  (`w.pickups.splice(0, excess)`). Pickups are only ever `.push()`-ed, so the
  array is already in birth order — trimming the front evicts the oldest,
  presumably-abandoned drops. Deliberately **not** a spawn-rejection budget
  like the existing `canSpawnEnemyProjectile`/`canSpawnEnemyEffect` gates:
  rejecting a new pickup would mean a kill silently pays no XP/cred, which
  reads as a bug, not a density limit.

## Result

Per-enemy simulation cost went from ~6.3µs/enemy (and rising with obstacle/
pickup count, not flat) to a measured ~2.65µs/enemy, flat across 288-834
enemies in the same run — confirming the remaining cost is linear, not
hiding another quadratic term. Re-verify the same way (profile, don't guess)
if `stepWorld` gets slow again at high density.

## Render side

`drawRig` and `drawShadow` (`render/sprite.ts`) now bake to an offscreen
canvas once per (rig, palette, anim, frame, outline, flash) combination and
blit with `drawImage`, instead of issuing a `fillRect` per body part (or
constructing a fresh `createRadialGradient` per shadow) every visible actor,
every frame. This is the same technique `draw.ts`'s `softBlob`/`paintSoftCloud`
already uses for cloud gradients, documented there with a measured ~22ms/frame
cost before that fix — same shape of problem, same fix, applied to the actor
sprite path this time. Rig objects are shared per enemy/character
*definition*, not per-instance, which is what makes the cache safe: the set
of (rig, anim, frame) combinations is small and closed, not one entry per
enemy. `dissolve` (continuously-varying death animation) and `tint`
(freeze/converted status recolor) are deliberately **not** cached — both are
transient/rare, and fall back to the original per-part draw path unchanged.
Facing is not baked separately either; a horizontal mirror of the whole
canvas around its origin column at blit time reproduces the flipped-facing
math exactly (verified against the original `-px - pw` formula), which halves
the cache size for free.

Verified visually (headless-browser playtest, not just typecheck) rather than
assumed: shadows, enemy sprites, hit-flash, and boss outlines all still
render correctly after the change.

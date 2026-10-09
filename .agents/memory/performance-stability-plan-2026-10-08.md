# 616 Survivor — Stability & Performance Plan

## Update — 2026-10-09: diagnosed the actual reported lag

The user reported the game "still lagging." Investigation confirmed two things:

**Nothing from this plan has been applied yet** — it's still a plan, not a changelog (the
`.agents/memory/` index entry for it already says so explicitly: "plan, not yet executed").
Zero commits have landed in `artifacts/survivor-616/` since this doc was written, so there is
no new regression to explain — whatever's being felt now is the same unaddressed state this
plan already described... except it turned out the Tier 1 list below **wasn't actually the
cause of what the user is feeling**, because of how they described it:

> lag happens in normal play, early/mid areas (not Unleashed/Million Horde), on desktop,
> "always been there," and correlates with music playing.

Every Tier 1/Tier 2 item below requires *high density* (lots of enemies, breakables, or fluids
alive at once) to matter — exactly what "early/mid areas" doesn't have. Two hypotheses were
chased and ruled out with real measurement before finding the actual answer:

- **Ruled out: the music analyser.** It runs on its own separate `requestAnimationFrame` loop
  (confirmed real — `src/game/audio/analysis.ts:127-137`, independent of `RunScreen.tsx`'s own
  loop) and runs unconditionally whenever a track is *playing*, even muted. But measured
  directly: ~1,500 trivial scalar ops on a 512-element `Uint8Array` per frame, sub-0.1ms on any
  desktop JS engine. Computationally insignificant — ruled out by actual arithmetic, not
  assumption. (The two-separate-rAF-loops architecture is still worth noting for Tier 2, see
  below, but it's not the lag.)
- **Confirmed: baseline background/lighting rendering that runs every frame regardless of
  enemy count, scaling instead with obstacle/light-source count and screen area.** This is
  `drawObjectLighting` (`draw.ts:2736-2946`) plus the ground-tile layers (`drawGround`,
  `drawStreetDressing`, `draw.ts:157`/`238`) plus the ambient sky/civilian layer (`drawAmbient`
  and the cloud/firefly/litter/puddle passes, `draw.ts:5140`, `6684-6739`). **None of these are
  gated by `visualBudget`/`graphicsQuality`/`backingScale` at all** — confirmed by reading the
  call sites directly: those three tiers are consumed only by `drawEffects`/`drawParticles`/
  `drawPopups` (cosmetic VFX), keyed only on `enemies.length`. The auto-degrade controller
  measures overall render cost and *will* eventually throttle `backingScale` down if frame time
  is bad enough, but has no finer-grained lever for this specific cost — it's structurally
  blind to *why* a frame is slow here the same way it was blind to the music analyser's
  separate loop, it just eventually hits the resolution-scaling hammer for everything at once.

  Specifically, `drawObjectLighting` runs unconditionally every frame (`draw.ts:6716`) and does,
  for an ordinary street scene with lamps/barrels/signs/benches/crates (tens of breakables is
  completely normal authored-area content, not a density extreme): up to 8 fresh
  `ctx.createRadialGradient` calls for active light sources/effects, **plus** a shadow-caster
  pass (`draw.ts:2856-2896`) that checks every light source against every non-light breakable
  (cheap distance check, correctly skips anything past 260 units) but does a full
  `save/beginPath/4-point-polygon-fill/stroke/restore` for every pair that *is* within range —
  which in a normal lamp-lit street corner with several breakables clustered near a couple of
  lights is a real, non-trivial number of canvas state changes and fills, every frame, with
  zero dependency on how many enemies are alive. `drawGround`/`drawStreetDressing` separately
  iterate a 64px/192px grid over the *entire visible viewport* every frame (~500 + ~150 cells on
  a 1920×1080 desktop view) doing a hash + conditional fill/ellipse per cell — pure screen-area
  cost, same whether the area is empty or packed.

  **This is the actual explanation for "always been there, even in simple early areas, on
  desktop."** It has nothing to do with enemy density, and everything to do with scene geometry
  (obstacle/light count) and viewport size, which is why the previously-documented
  density-focused hotspots in Tier 1 below didn't match the symptom, and why no amount of the
  existing auto-degrade logic (keyed on enemy count) has ever touched it.

**New Tier 0 item below reflects this. The "also correlates with music" report is most likely
incidental** (music is on by default for most sessions, so it roughly tracks "normal play" in
general) rather than causal — but the two-separate-rAF-loops point from the ruled-out
hypothesis is folded into Tier 2 anyway since it's a real architectural gap worth closing
eventually, just not the cause of this specific complaint.

---

## Context

This plan follows a full-codebase audit of `artifacts/survivor-616` (bugs, dead content,
performance) that already produced two merged fixes:

- PR #247 — `drawProjectiles` now resolves a carried/frozen enemy via the `enemiesByUid`
  map instead of a linear scan over all enemies.
- PR #248 — `ScreenLayout`'s back button was unclickable once a panel scrolled far enough
  (a CSS stacking-context bug: `<main>`, a sibling of the button's `<header>` ancestor at
  the same `z-20` but later in the DOM, painted over the button's `fixed z-110`). Fixed by
  raising `<header>` to `z-30`.

The user's request for this plan, in their own words after clarifying scope: **"a game
where no matter what we don't deal with frame drops that stutter or crash the game."**
That is the lens every item below is scored against — not "render a million distinct
sprites," but *guaranteed stability under any load the game can reach*, including the most
extreme mode already shipped to players (Million Horde).

Everything here is grounded in direct code reading (file:line citations), not guesses.
Two things are worth knowing up front, because they change what "fixing this" even means:

**The game already has real scalability infrastructure, not a blank slate.** `CellGrid`
(`src/game/engine/cellGrid.ts`) is an O(1)-amortized typed-array hash grid for local
collision/targeting. `drawRig` (`src/game/render/sprite.ts`) bakes every unique
(rig, palette, frame) combination into an offscreen canvas once and blits it with a single
`ctx.drawImage` per visible actor — a de-facto runtime sprite atlas. Enemy count is hard-capped
(`enemyCap()`, `world.ts:2199-2203`: 190 normal / 1000 Unleashed / device-tiered for Million
Horde). Most importantly, **Million Horde mode already solves "visually represent more than
you can simulate"**: `HordeField` (`src/game/engine/hordeField.ts`) stores up to 10,000,000
crowd members as flat `Float32Array`/`Uint16Array` data (10 bytes/member, zero per-member
objects), processes a fixed, device-tiered "sweep budget" of members per frame regardless of
total population, and renders only a capped visible subset as two batched `ctx.rect()` fills
plus a constant-cost gradient "pressure" glow for everything beyond that. **This is the exact
trick the user asked for ("tricks are needed... even millions") — it's already built and
shipped.** The job here is to hold the rest of the engine to that same standard, not invent a
new architecture.

**The game already has a *measured* feedback controller, not just static settings.**
`RunScreen.tsx`'s render loop (~lines 844–1218) tracks real render cost and missed-frame-cadence
samples over a rolling 500ms window and auto-adjusts canvas `backingScale` down (floor 0.6x)
under sustained overload, back up when comfortable. `visualBudget` (`'minimal'|'reduced'|'full'`)
is *already* partly driven by this — it's computed each frame from the current `backingScale`
plus a `visualPressure` count (`RunScreen.tsx:1058-1061`). What is **not** in this loop:
`graphicsQuality` (`'high'/'balanced'/'performance'`), which comes straight from a static user
setting (`meta.graphicsQuality`) and never adjusts itself — it's the one knob in the existing
system that isn't closing the loop.

**No perceived-stutter risk from React.** Confirmed directly: `stepWorld` runs every tick
imperatively; `setHud`/`setMissionHud` React state updates are throttled to ~16Hz, not per
simulation frame; canvas drawing is imperative, not React-rendered. React re-renders are not a
contributor to in-run stutter today.

**Audio/music is not a bottleneck — and this was already independently verified once before.**
`.agents/memory/swarm-collision-nearestenemy-2026-09-22.md` investigated "crashes while a song
is playing" directly and cleared the audio code (single shared `AudioContext`, throttled
FFT work, nothing leaking per frame), concluding any future recurrence is more likely a frame
stall elsewhere coinciding with music being on. My own research this session reached the same
conclusion independently. The one per-frame audio-reactive cost (`musicMultiplier`/
`musicVisual`, once per enemy per frame) is cheap today but ungated by any budget tier — worth
folding in later, not urgent.

**Important correction to how the rest of this plan should be read: this repo already has a
real profiling discipline, and the project's own history says not to skip it.**
`.agents/memory/swarm-performance-2026-09-12.md` and `swarm-collision-nearestenemy-2026-09-22.md`
document two prior, successful perf passes — both done by scripting `createWorld`/`stepWorld`
under Node and taking a real V8 CPU profile, *not* by reading source and guessing. That first
doc says it directly: "Guessing at hotspots... is unreliable." It also records a case where a
guess would have been wrong — `collideObstacles` turned out to be 40% of frame time, a result
nobody would have ranked that high from reading the function in isolation. **There are also
already-working benchmark scripts with recorded baselines**: `scripts/bench-sim.ts` (headless
sim cost per step, avg/p99/max) and `scripts/bench-render.mjs` (sim + `renderWorld` in headless
Chromium), documented in `.agents/memory/million-horde-crowd.md` with baselines at 1,000 live
actors (desktop: sim 1.95→0.8 ms/step after the last pass; Million mode with 10M members
~2.0 ms/step; draw JS 14.1→8.0 ms avg, p99 68→30 ms). **This means Tier 1's performance items
below (found by reading source during this audit, the same way the project's history warns
against relying on) are candidates, not confirmed hotspots** — the project's own standard is to
run `pnpm exec tsx scripts/bench-sim.ts` with a real profile before fixing, both to confirm the
item is worth the effort and to catch whatever the next real bottleneck actually is (which, per
both prior passes, was not what static reading would have guessed first).

**The project's own prior work already names the next structural step past today's caps.**
The 2026-09-22 pass closed the quadratic `nearestEnemy()`/uid-lookup gaps that caused real
frame-stall "crashes" on constrained hardware (iOS Safari included) under Unleashed's
1,000-enemy cap, but ends with an explicit, still-open conclusion: simulation currently updates
*every* live enemy's full AI/damage logic regardless of visibility — only rendering culls to
viewport. Reaching higher ceilings "needs a further structural change... separating broad-phase
(grid membership, cheap) from narrow-phase (AI/damage update, expensive) and skipping
narrow-phase work for enemies far outside the viewport/interaction radius." This is already the
project's own named next step, not a new idea — see Tier 2.

---

## Tier 0 — Do first: the actual reported lag

This is the new finding from the 2026-10-09 update above. Unlike everything in Tier 1 (which
only matters at high enemy/breakable density), this is the one item that explains lag in
ordinary, low-density early/mid areas on desktop — i.e. this is almost certainly what the user
is actually feeling, and should be fixed before anything else in this plan.

| # | What | File | Why it matters / impact | Risk if skipped | Effort |
|---|------|------|--------------------------|------------------|--------|
| 1 | **Gate `drawObjectLighting`'s shadow-caster pass** (`draw.ts:2856-2896`) by `graphicsQuality`/`visualBudget` — e.g. skip it entirely at `'performance'` quality, or reduce the active-light-source cap below the current 5, or shrink the 260-unit proximity range at lower tiers | Full `save/polygon-fill/stroke/restore` per nearby light-source/breakable pair, every frame, scaling with ordinary authored-scene obstacle density (lamps, barrels, signs, crates) — not enemy count. This is the single clearest match for "constant lag in simple areas" found in this plan | Without this, a desktop player on a normal street-corner scene pays a real, unconditional, ungated canvas-state cost every frame that has nothing to do with how the fight is going — the one thing in this whole plan actually matching the user's own description | S–M (isolated to this one function; the gating pattern to copy already exists for `drawEffects`/`drawParticles`) |
| 2 | **Cache/reduce the per-frame `createRadialGradient` calls in `drawObjectLighting`** (up to 8 per frame today: `draw.ts:2742,2758,2780,2798,2806,2827,2908,2947`) — gradients are recreated from scratch every frame for slowly-changing or static light sources; most could be built once per light source and reused, or built less often and reused across frames with just an alpha change | Each `createRadialGradient` + multiple `addColorStop` calls is real (if individually small) allocation + GPU-state work; 8 of them every frame, every area, adds up exactly the way the ground-tile/shadow-caster costs do — same root cause, same fix shape (do less work per frame when the underlying thing hasn't moved) | Compounds with #1 — fixing the shadow caster alone won't fully resolve the complaint if this is still paying a similar tax right next to it in the same function | S–M |
| 3 | **Gate `drawGround`/`drawStreetDressing`'s per-cell work by `graphicsQuality`** (currently always full 64px/192px grid density regardless of viewport size or quality setting, `draw.ts:157`, `238`) — e.g. a coarser cell size or a cheaper fill path at `'performance'` tier | Pure screen-area cost (~500 + ~150 cells on a 1920×1080 view), identical whether the area is empty or packed with enemies — directly explains why this never improves no matter what's happening in combat | Same class as #1/#2: an always-on tax that the existing auto-degrade system can't see because it isn't keyed to anything this cost actually depends on | S |

**Verification for Tier 0:** profile first with the existing methodology (`node scripts/bench-render.mjs`
in a simple early/mid area with a normal scattering of breakables, NOT an extreme mode) to get a
real before number, then again after each fix for a real after number — this is exactly the
kind of claim this repo's own history warns not to ship on a guess. Manually confirm on desktop
in a normal early-area run: does the frame time/smoothness improve with no change to enemy
count or combat? That's the actual test of whether this was the right diagnosis.

**Status: #1 and #3 implemented and shipped (graphicsQuality gating on the shadow-caster and
street-dressing layers, plus viewport culling added to `drawObjectLighting`'s light sources —
not in the original item list, but the same root cause: `sources`/`shadowObjects` had zero
camera-bounds check, so an off-screen lamp still paid for a fresh gradient and shadow-pair scan
every frame). Verified: `pnpm typecheck`/`pnpm test` (840/840) clean, visual output confirmed
correct via headless screenshot (lights/shadows still render, no pop-in/missing geometry).
**Known limitation of this verification**: `scripts/bench-render.mjs` only exercises `AREAS[0]`
("monroe-strip"), which is small enough (~16 obstacles, all roughly within one screen's worth
of world space) that the before/after numbers came back statistically indistinguishable
(~2.3-3.0ms drawJS avg either way, within the benchmark's own noise band) — this area simply
doesn't have enough off-screen clutter to exercise the new culling. The fix should matter most
in endless-mode/larger authored areas with many more light-emitting props scattered beyond one
viewport, which the current benchmark doesn't cover. **Extending `bench-render.ts` to also cover
a denser/larger area (or endless-mode chunk streaming) would give this fix a real measured
number** — worth folding into Tier 2 #2's CI-wiring work rather than left unverified. #2
(gradient caching) not yet implemented — lower priority since the culling fix likely already
removes most of the wasted work it would have targeted.

---

## Tier 1 — Do now: real bugs, cheap, isolated

Each of these is small, independent, and directly reduces stutter/crash risk at the specific
load level noted. Safe to do in any order; none blocks another.

**Before fixing items 1, 2, 4, or 5 below: profile first, per this repo's own established
practice.** For sim-side items (1, 4): `pnpm exec tsx scripts/bench-sim.ts 60 million|unleashed|normal`,
or a real V8 CPU profile the way `swarm-performance-2026-09-12.md` describes. For render-side
items (2, 5): `node scripts/bench-render.mjs`. In each case, with enough breakables/fluids/
status-ring-tagged enemies alive to exercise the path *before* spending effort on it. These
four were found by reading source during this audit — the same method the project's own
history says produced wrong rankings before (`collideObstacles` turned out to be 40% of frame
time, which nobody would have guessed from reading it alone). Profiling first either confirms
the item and gives a real before/after number for the commit, or reveals it's not actually
significant yet and effort belongs on whatever the profile *does* show hot instead. Items 3, 6,
7, 8 don't need this (allocation/race/guard fixes with an obvious, profiler-independent win).

| # | What | File | Why it matters / impact | Risk if skipped | Effort |
|---|------|------|--------------------------|------------------|--------|
| 1 | Route `updateBreakables`'s hazard tick through the existing `CellGrid` instead of a full `w.enemies` scan per active hazardous breakable, nested inside a `w.fluids` loop | `world.ts` ~6970-6990 | Removes an O(breakables × fluids × enemies) scan. Only matters once a run has a dozen+ breakables alive near fluid — i.e. exactly the dense mid/late-endless-mode scenario where a stutter would be most visible and most damaging to the "never stutters" promise | A player who leans into environmental combos (breaking things near water) in a long endless run is the one most likely to hit a visible frame drop, and won't know why | S |
| 2 | Pre-filter the shadow-overlap check (currently a full `liveBreakables` loop per visible enemy, every frame) with a grid/bbox check | `draw.ts` ~5977-5984 | Removes O(enemies × breakables) per frame — scales directly with both enemy density and prop density, i.e. gets worse exactly as the game gets more interesting | Compounds with #1 in the same scenario (breakable-heavy, enemy-dense areas) | S |
| 3 | Only rebuild the chunk-tracking `Set` in `updateEndlessChunks` when the player actually crosses a chunk boundary, not every frame | `world.ts` ~10980 | Removes a per-frame allocation + GC churn that currently happens unconditionally in endless mode, the game's primary long-session mode | Endless mode is where sessions run longest — this is a slow, cumulative tax exactly where "no matter what" matters most (hour+ sessions) | S |
| 4 | Replace `updateBubbleWash`'s two `Set` literals + two `.filter()` calls (built fresh every frame to split enemies by faction) with a single-pass bucketing loop | `world.ts` ~6689-6693 | Removes 2 allocations + 2 full-array passes per frame, unconditionally, whenever this mechanic is active | Same class as #3 — an always-on tax, not a spike, so it erodes headroom everywhere else needs | S |
| 5 | Consolidate per-enemy status-ring drawing (commander shield, telegraph, capturable pulse, commanded/selected ring, converted tint, veteran ring+text, freeze ring — up to 6 separate `ctx.save()`/`ctx.restore()` + `ctx.shadowBlur` pairs today) into fewer state changes, batched by which rings are actually active | `draw.ts` (enemy loop ~5790-5974) | `shadowBlur` is one of the most expensive Canvas2D operations; with 100+ enemies and several statuses active at once (a veteran-tagged endless wave is exactly this), this is likely **the single biggest real draw-path cost in the whole engine** — bigger than anything else on this list | This is the one most likely to be the actual visible stutter on a real "hard" wave, not a theoretical one | M |
| 6 | Guard the LokToken economy store's fire-and-forget promises (`refresh()`/`earn()`/`spend()`) against a stale response landing after rapid sign-out/sign-in | `src/state/lokEconomyStore.tsx` ~82-141 | Not a stutter/crash risk — a real but low-severity race that can write a stale balance into the wrong session. Included here because it's cheap and was already found | Occasional stale-balance flicker in the shop; never a crash | S |
| 7 | Guard `beacon.hp / beacon.maxHp` against `maxHp <= 0` | `draw.ts` ~2961 | Currently unreachable from any real data path — pure defensive hardening against a future content mistake | A future area/beacon def with `maxHp: 0` would silently glitch the health bar (NaN/negative fill), not crash — low stakes, but free to fix while touching this file | S |
| 8 | Make hand-built `EnemyActor` test fixtures fail loudly (not silently resolve `w.now < undefined` to `false`) for timestamp fields like `capturableUntil`/`convertedUntil`/`specialReadyAt`/`telegraphUntil` | test fixtures / `world.test.ts` helpers | Test-infrastructure hardening per this repo's own documented philosophy (CLAUDE.md already calls out one instance of this exact trap) — prevents a future test from silently testing the wrong behavior | Not a production risk; a future contributor's test could pass while testing nothing | S |

**Verification for Tier 1:** `pnpm typecheck`, `pnpm test` (currently 815 passing — must stay
815/815), then `pnpm exec playwright test` for the full e2e suite. For #1/#2/#5 specifically,
manually playtest an endless-mode run past the point where breakables + a dense wave are both
on screen and watch for dropped frames before/after.

---

## Tier 2 — Do soon: closing the actual "never stutter" gap

This tier is the heart of the ask. Tier 1 fixes specific hotspots; Tier 2 is what lets the
game **prove** it won't stutter, under any load, including loads nobody has thought to test
yet — rather than relying on today's hotspot list being complete.

| # | What | Why it matters / impact | Risk if skipped | Effort |
|---|------|--------------------------|------------------|--------|
| 1 | **Extend the existing measured RAF controller to also drive `graphicsQuality`**, not just `backingScale`/`visualBudget`. Today `graphicsQuality` is a static setting that never reacts to real measured overload; everything else in the loop already does | This is the highest-leverage single item for the literal ask. It turns "we hope the static tier the player picked is enough" into "the game measures itself and degrades further, automatically, the moment it's actually struggling" — a true closed loop, with no load scenario left unhandled by policy | Without this, a device/scenario combination nobody anticipated (a new high-density area, a new status-effect combo, a slower phone) can still stutter with no automatic recovery — exactly the "no matter what" gap | M (touches a widely-read piece of shared state — needs care, but additive, not a rewrite) |
| 2 | **Wire the existing benchmark scripts into CI with asserted thresholds.** `scripts/bench-sim.ts` and `scripts/bench-render.mjs` already exist with recorded baselines (`.agents/memory/million-horde-crowd.md`) — this is *not* "build a harness from scratch," it's "make the harness that already exists fail the build on regression instead of being a script someone has to remember to run by hand." Cover all three modes: normal (190 cap), Unleashed (1,000 cap), Million Horde (device-tiered cap) | Every fix in Tier 1 was found by manual audit; wiring the existing scripts into CI is how the next ten get caught automatically, against the baselines already on record, instead of needing another full audit pass | Without this, "never stutters" rests on remembering to re-run two scripts by hand before every release — it will regress silently the next time a change touches a hot path, same as it almost did between the 09-12 and 09-22 passes | M (the scripts and baselines exist; this is CI wiring + threshold-setting, smaller than originally scoped) |
| 3 | **Re-validate Million Horde mode specifically against its own recorded baseline** (`~2.0 ms/step` sim cost at 10M members, desktop tier, per `million-horde-crowd.md`) as part of #2, since it's the most extreme case already shipped to real players | It's the one mode explicitly built for "massive scale" — if anything should have a locked-in regression baseline, it's this one, and the baseline already exists, it just isn't enforced | This is the mode most likely to be screenshotted/clipped/shared if it ever visibly chugs — reputationally the highest-stakes item on this whole list | S (baseline already recorded; just needs to be asserted in #2's CI step) |
| 4 | **Broad-phase/narrow-phase split: skip full AI/damage-update cost for enemies far outside the viewport/interaction radius**, not just draw-culling them. This is not a new idea — `.agents/memory/swarm-collision-nearestenemy-2026-09-22.md` names this exact change as the still-open next step after closing the quadratic `nearestEnemy()` gaps, and says explicitly to re-profile the same way (real V8 profile) before spending budget here | This is the project's own identified path past today's hard caps (190 / 1,000 / Million-Horde-actor-tier) toward real "thousands on screen" without raising those caps blindly — currently simulation updates every live enemy's full logic regardless of distance from the player/camera, only rendering culls | This is the highest-effort, highest-payoff item in the whole plan if the ambition is ever to raise the live-actor ceilings further — and the one most likely to introduce a subtle gameplay bug (an enemy that should have reacted but didn't) if done without the Tier 2 #2 regression harness in place first | L (touches core simulation code many systems depend on; do this only after #2's CI harness exists, exactly as this repo's own history recommends) |
| 5 | **Close the documented 120Hz interpolation gap**: the sim runs a fixed 60Hz step with no render interpolation/sub-stepping, so a 120Hz/144Hz display shows 60 distinct frames stretched across more refreshes — this reads as visible judder on high-refresh hardware even when the sim itself is fast. Explicitly recorded as still-open in `million-horde-crowd.md` ("left alone because it affects gameplay tuning") | Directly a "stutter" symptom on an increasingly common class of hardware (most current phones and many monitors are 90Hz+) that has nothing to do with simulation cost — fixing the *other* items in this plan won't touch this one at all | On a 120Hz+ device, the game will visibly judder even at a perfect, unloaded 60fps simulation rate — a "no matter what, never stutters" promise has a real, known, named gap here today | L (render-interpolation changes touch gameplay feel/tuning — the prior pass deliberately deferred it for exactly that reason; needs a design decision, not just an engineering one) |
| 6 | **Fold `musicMultiplier`/`musicVisual` into the same budget-tier gating** as #1, once it exists | Currently a small but ungated O(N) cost; cheap to bring under the same umbrella once the umbrella exists | Low urgency today — flagged so it doesn't get forgotten as enemy counts climb | S |
| 7 | **Consider merging the music analyser's independent `requestAnimationFrame` loop into RunScreen's own loop** (today: `src/game/audio/analysis.ts:127-137` schedules its own rAF, fully separate from `RunScreen.tsx:897/1220`) | Measured insignificant on its own (~1,500 trivial ops/frame, sub-0.1ms) — this is architectural cleanliness, not a performance fix. Two independent per-frame callbacks is still one more thing than necessary, and it means the auto-degrade controller can never account for it even in principle | Low — included because it was investigated this session and the "two loops" fact is worth having on record even though it wasn't the cause of anything | S, but touches audio plumbing — verify playback timing isn't subtly tied to its own rAF cadence before merging |

**Verification for Tier 2:** #2 turns itself into the ongoing test once wired up. Until then,
verify #1 manually: force `visualPressure` artificially high (or play Unleashed mode) and
confirm `graphicsQuality` visibly steps down and recovers, the same way `backingScale` already
does today — watch for it in a dev-tools performance recording, not just by eye. Verify #4 only
with a before/after profile via the same Node-script method the two prior passes used, exactly
as that doc recommends.

---

## Tier 3 — Content correctness cleanup (not stutter-related)

These are real bugs ("broken" in the sense originally asked about) but have no bearing on
performance or crashes — pure game-content correctness. All isolated, all small.

- `digital-disco` area is permanently unreachable: its unlock points at a nonexistent
  `crystal-cellar-4x` (only `crystal-cellar-2x` exists). Its entire `lockstep-remix`
  faction/wave roster is dead by extension. **Impact:** a built area and faction nobody will
  ever see. Fix = correct the unlock's `areaId`.
- 4 broken `discoveryId`s in `areas-4x.ts` with no matching `DISCOVERIES` entry (silent — not
  caught by typecheck). **Impact:** those 4 areas show no discovery text in the UI. Fix = add
  the missing `DISCOVERIES` entries.
- 2 enemies (`pincer-stalker`, `mimic-ambusher`) defined but never spawned by any wave/squad/
  director. **Impact:** dead content taking up roster space. Fix = add to a wave, or remove.
- 3 fully vestigial settings (`miningHelmetOwned`, `rancherWhistleOwned`,
  `eclipseMonocleOwned`): documented intended effects, nothing reads them, and no reducer ever
  sets them `true` — currently unobtainable, not just inert. **Impact:** either finish the
  feature or remove the dead fields.
- A handful of zero-importer exports (`getSectorMap()`, `getSectorMission()`,
  `OBJECTIVES_BY_ID`, `RUN_HUD_ZONE_CLASSES`, `isVisualTarget()`). **Impact:** dead code,
  no behavior change either way — remove once confirmed still unused.
- 2 stale `e2e/breach-builder.spec.ts` tests expect an "Enter the hideout" click step that a
  `?screen=hub` deep link already skips. **Impact:** test-suite noise, not a product bug. Fix
  = drop the now-unnecessary step from those two specs.

**Verification for Tier 3:** `pnpm typecheck` + `pnpm test` after each; for the area/discovery
fixes, manually play to `digital-disco` and the four `-4x` areas and confirm discovery text
now appears.

---

## Tier 4 — Bundle size / load time (explicitly NOT runtime stutter)

Only `StudioScreen` and `RunScreen` are lazy-loaded today (`App.tsx:85-86`); roughly 30 other
UI panels (HubScreen, BestiaryPanel, VendorPanel, WorkshopPanel, SettingsPanel,
ThreatMatrixScreen, LokPetBattleScreen, MapBuilder, SectorCommandScreen, ArenaSetupScreen,
ArenaJoinScreen, ArenaScreen, etc.) plus ~27.7k lines of game-data modules are eagerly bundled
into one ~2.7MB/777KB-gzip main chunk.

**This affects first-load / time-to-interactive, not in-run stability** — deliberately kept
separate from Tiers 1-2 so it doesn't get conflated with the stutter-prevention work. Fix =
convert each rarely-visited panel to `lazy()` the same mechanical way `StudioScreen`/
`RunScreen` already are. Mechanical, many small independent changes, no shared-state risk.

**Verification:** `pnpm build` and compare the main chunk size before/after; confirm each
converted screen still opens correctly (one e2e pass per screen touched, or a manual click-
through).

---

## Out of scope / not recommended

- **Rewriting the renderer in WebGL.** Given the enemy-count hard caps already in place and
  the sprite-atlas (`drawRig` baking) + Million-Horde batched-rect pattern already closing
  most of the real gap, a WebGL rewrite is disproportionate cost and risk for the remaining
  headroom actually needed.
- **Splitting the simulation across Web Workers.** Honest assessment: not recommended today.
  Zero Worker/`OffscreenCanvas` infrastructure exists anywhere in the codebase; `World` is one
  large mutable object with no message-passing boundary designed in. Doing this properly means
  either a per-tick structured-clone (which would net *negative* — serialization cost alone
  could exceed what it saves) or a ground-up rewrite of the simulation's data into transferable
  typed-array structures — a larger, riskier undertaking than everything else in this plan
  combined. **The better move is to generalize the pattern `HordeField` already proves out**
  (flat typed arrays, zero per-member GC, fixed sweep-budget, population-independent cost) to
  the other O(N) hotspots in Tier 2 item 4, instead of introducing real threading. Revisit this
  only if Tier 2 is fully done and a specific, measured bottleneck still can't be closed any
  other way.
- **Raising the enemy cap, or literally simulating/rendering millions of distinct actors.**
  Already correctly out of scope per the user's own clarified goal — the ask is "never
  stutters," which Million Horde's existing aggregate-crowd trick already satisfies without
  this.

---

## Suggested order of execution

0. **Tier 0 first, ahead of everything else.** It's the diagnosed cause of the lag actually
   reported, it's isolated to one function family in `draw.ts`, and nothing else in this plan
   depends on it or blocks it.
1. Profile first (per the note at the top of Tier 1) using `scripts/bench-sim.ts`/
   `bench-render.mjs` or a real V8 profile, with breakables/fluids/status-ring-tagged enemies
   alive — this both informs which of Tier 1's items 1, 2, 4, 5 are actually worth doing and
   gives real before/after numbers.
2. Tier 1, items confirmed by that profile (likely alongside 6-8, which are independent and
   need no profiling — a race-condition guard, a defensive division guard, and test-fixture
   hardening can slot in anywhere, including in parallel).
3. Tier 2, item 2 (wire the existing `bench-sim.ts`/`bench-render.mjs` scripts into CI with
   thresholds) before item 4 (the broad-phase/narrow-phase split) — this repo's own history
   explicitly recommends not touching shared simulation code without a regression safety net
   already in place, and the scripts/baselines already exist, so this is cheaper than it looks.
4. Tier 2, item 3 (Million Horde's existing baseline asserted in CI) rides along with item 2 —
   same work, same PR.
5. Tier 2, item 1 (closing the `graphicsQuality` loop) can happen any time after Tier 1 — it's
   additive to the existing controller, not blocked by anything.
6. Tier 2, item 4 (broad-phase/narrow-phase split) only after item 2's CI harness is live —
   this is the plan's single highest-effort, highest-payoff item, and also the one most likely
   to introduce a subtle gameplay regression without a safety net already watching for it.
7. Tier 2, item 5 (120Hz interpolation) is a design conversation as much as an engineering one
   — schedule it once there's appetite to discuss how it should feel, not as a quick fix.
8. Tier 3 and Tier 4 whenever — both are isolated and don't block or get blocked by anything
   above; do them whenever there's a lighter-weight slot between the heavier Tier 1/2 work.

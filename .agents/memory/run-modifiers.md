---
name: Run modifiers and HordeSpin
description: Durable architectural decisions for the Roster-screen run-modifier checklist and the HordeSpin wheel event.
---

# Run Modifiers & HordeSpin — Key Decisions

**Where the checklist lives and how it threads into a run:**
`RunModifiers` (types.ts) is picked via the checklist on the Roster screen
(`CharacterSelect.tsx` — its `<ScreenLayout title="Roster">`), not on
`AreaSelect.tsx`. It's stored on `meta.runModifiers` in `metaStore.tsx`
(toggled with `toggleRunModifier`), the same way `selectedCharacter` already
lives in meta rather than being passed through screen props. `RunScreen.tsx`
reads `meta.runModifiers` directly and forwards it as `setup.modifiers` to
`createWorld`, which stores it as `world.modifiers` (always a concrete
object, never undefined — defaults to `{}`).

**Why modifiers compose as multipliers, not new spawn/area systems:**
`doubleMode` does **not** double the area's physical bounds (`areas-2x.ts`
already ships that as separate, hand-authored area content) — doubling an
existing area's map size at runtime would misplace every hand-placed
obstacle, since `AreaDef.bounds` are half-extents obstacles are authored
against. Instead `doubleMode`/`scalerMode` fold into a spawn-rate multiplier
(`modifierSpawnMult`) and an hp multiplier (`modifierHpMult`).

**`modifierHpMult` lives inside `spawnEnemy` itself, not at each call site
(fixed after initially getting this wrong):** the first pass applied it only
in `updateSpawning`/`updateEndlessSpawning`, which meant doubleMode/scalerMode
silently never affected district incursions, the endless dungeon boss, or the
elite rotation -- every spawn path that calls `spawnEnemy` directly with its
own hand-picked `hpMult`. It's now folded into `spawnEnemy`'s hp formula
itself, the same choke point `w.challenges`' `enemyHealthMultiplier` already
uses, so every spawn path gets it automatically. `modifierSpawnMult` stays at
its two call sites (`updateSpawning`, `updateEndlessSpawning`) since spawn
*rate* is meaningless outside a wave/spawn-credit loop — incursions and boss
spawns aren't wave-driven, so there's no equivalent single choke point for it
the way there is for hp.

**Run modifiers are player-opted-in like `ChallengeContractDef`, not automatic
like night difficulty -- so they do NOT compose inside endless mode's caps:**
`endless-mode-engine.md`'s "compose inside `Math.min()`, never stack on top"
rule turns out to describe *automatic/environmental* multipliers specifically
(its own example is `nightDifficultyMult`) -- it does not describe player-
chosen ones. Proof is already in the existing code: `w.challenges`'
`enemyHealthMultiplier` has never been folded into endless mode's
`Math.min(1.7, ...)` hp cap; it multiplies (uncapped) inside `spawnEnemy`
*after* that cap is applied to the base hpMult. `RunModifiers` are the same
kind of opt-in "raise the stakes" choice as challenges, so `modifierHpMult`
follows the same pattern -- uncapped, inside `spawnEnemy`, stacking on top of
endless mode's environmental cap rather than folded inside it. (An earlier
version of this file said the opposite and folded `modifierHpMult` inside
both `Math.min()` calls; that was corrected because it was both inconsistent
with the challenges precedent and the direct cause of the missing-coverage
bug above.) `modifierSpawnMult` is the one exception that *does* stay inside
the endless spawn-rate cap — matching how `contractSpawnMultiplier` (from
challenges) was already placed there before this feature existed, which this
change didn't need to revisit.

**`invertedMap` is a real layout flip, not the existing cosmetic invert:**
`meta.worldInvertEnabled` (Settings panel) only rotates the rendered canvas
180° via CSS — it never touches world coordinates. `RunModifiers.invertedMap`
is a different, gameplay-affecting flip: `createWorld` mirrors `area.obstacles`
x-coordinates (`x: -o.x`) once at run start, since area space is centered at
`(0,0)` (bounds are half-extents) so negating x is a correct horizontal
mirror. The mirrored array is built once and reused for all three things
independently derived from `area.obstacles` (collision `obstacles`,
`breakables`, `potholes`) — mirroring only one of the three would desync
what's visible from what's solid.

**`infiniteMode` keeps the finale wave(s) alive instead of faking endless mode:**
Endless mode is a whole separate system (chunk streaming, `EndlessState`,
its own difficulty bands) gated on `AreaDef.endless`. Forcing a normal timed
area into that system at runtime would need chunk generation for an area
that was never authored for it. Instead `infiniteMode` just skips the
time-based clear check in `stepWorld` and, in `updateSpawning`, keeps
whichever wave(s) end at the area's *maximum* `toSec` spawning past that
point with a small escalating multiplier (capped the same 1.7x/2.4x way),
rather than looping the whole wave schedule from the top.

Don't identify "the finale wave" by array position (`waves[waves.length - 1]`)
— that was the original, buggy implementation. `WaveDef` entries are not
guaranteed to be authored in `toSec` order, and several areas' real climaxes
are multiple waves tied at the same highest `toSec` sitting *before* the last
array entry (e.g. `bar-siege`'s waves end at `[45, 90, 130, 150, 180, 180,
180, 141]` — three waves at 180, but the last array entry ends at 141). Using
array position picked the wrong (and only one) wave to extend, and let the
actual finale waves go silent once they individually passed their own
`toSec`. Compute `maxToSec = Math.max(...waves.map(w => w.toSec))` once per
`updateSpawning` call and extend every wave whose `toSec === maxToSec`
instead.

**HordeSpin follows the StormCloud timer pattern, not the district-incursion one:**
`district-setpieces.md`'s incursions are hand-authored per-area setpieces
with bespoke enemy placement per encounter — too much authoring for a
periodic, area-agnostic event. HordeSpin instead follows `updateStormCloud`'s
shape: a `w.now`-driven state slice (`World.wheelSpin`) advanced once per
`stepWorld`, with `nextTickAt`-style fields (`nextSpinAt`, `resultAt`,
`activeEndsAt`). Its enemy pool is read live off whichever `AreaDef.waves`
entry is active when the wheel lands (falling back to `nightcrawler`) so it
never needs its own authored roster — see `hordeSpinEnemyPool`.

**5x5 and 666 spawn as separate clusters, not one bigger burst:**
Common tiers (1x-4x) spawn one scaled `formationPositions` burst. 5x5 and 666
instead spawn `spawnMultiplier` separate 5-enemy clusters, each in a
different formation (`HORDE_SPIN_FORMATIONS`), so a 5x5 or 666 event reads as
distinct groups arriving in different shapes rather than one undifferentiated
blob — this was the specific ask behind those two tiers.

**666's reward and its color effect are both one-shot, guarded by `rewardGranted`:**
The cred payout and the guaranteed LokPet grant (`tier.grantsPet`) fire once
when the `active` phase's timer elapses, guarded by `wheelSpin.rewardGranted`
— the same one-shot-guard shape as `districtIncursion.rewardGranted`. The
666 hue-rotate screen filter (`RunScreen.tsx`, `hordespin-hue` keyframe) is
pure screen-space decoration keyed off `hud.wheelSpin.colorFluctuation` and
never touches the simulation, per the ambiance-contract convention in
`sky-ambiance.md`.

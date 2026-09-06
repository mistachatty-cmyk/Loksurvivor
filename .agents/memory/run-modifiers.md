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
(`modifierSpawnMult`) and an hp multiplier (`modifierHpMult`) applied at the
same choke points `ChallengeContractDef`'s multipliers already use
(`spawnEnemy`'s hp calc, `updateSpawning`'s spawn-credit math).

**The endless-mode cap rule applies here too:**
Per `endless-mode-engine.md`, endless mode's `hpMult`/spawn-rate caps
(`Math.min(1.7, ...)` / `Math.min(3.2, ...)`) must have any new multiplier
composed *inside* the `Math.min()`, never stacked on top afterward.
`modifierHpMult`/`modifierSpawnMult` are folded inside those two `Math.min()`
calls in `updateEndlessSpawning`. For timed (non-endless) areas there is no
pre-existing cap, so `modifierHpMult` bounds itself internally (max 1.5x
double-mode * 3x scaler-mode = 4.5x) rather than relying on an external cap.

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

**`infiniteMode` keeps the last wave alive instead of faking endless mode:**
Endless mode is a whole separate system (chunk streaming, `EndlessState`,
its own difficulty bands) gated on `AreaDef.endless`. Forcing a normal timed
area into that system at runtime would need chunk generation for an area
that was never authored for it. Instead `infiniteMode` just skips the
time-based clear check in `stepWorld` and, in `updateSpawning`, keeps the
*last* authored wave spawning past its `toSec` with its own small escalating
multiplier (capped the same 1.7x/2.4x way) rather than looping the whole
wave schedule from the top.

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

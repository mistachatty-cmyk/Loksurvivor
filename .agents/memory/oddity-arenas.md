---
name: Oddity arenas -- wonky spawn systems
description: Design vocabulary and engine hooks for weird/experimental arenas -- attacking obstacles, ambient item drops, orbiting swarms, and the invisible-then-reveal wraith encounter.
---

Six new areas (`flat-lot`, `flat-tarmac`, `flat-mall-roof`, `the-loop`,
`sporadic-ward`, `the-choir`) explore deliberately "weird and wonky" content
outside the main story chain: open arenas with no wall/building obstacles,
obstacles that fight back, item weather instead of kill-drop loot, enemies
that circle instead of chase, and a mass-spawn ghost-squad encounter. This
doc records the systems added to support them, so the next oddity area is a
data-only addition, not another engine change.

**Why this needed engine work at all:** every mechanic here is a genuinely
new verb (an obstacle that damages on its own initiative, a pickup source
independent of kills/breakables, an enemy that can't be targeted or hurt for
a window) rather than new content riding an existing verb. That's the same
bar `teleporter`/`ghost`/`orbit` cleared when they were added -- see
`types.ts`'s "never editing the simulation loop" header comment, which is
about *content*, not about the fixed set of verbs content can select.

## Attack-block obstacles

`ObstacleDef.kind === 'attack-block'` is a normal `heavy-metal` prop
(pushable, 220 HP, breaks like any other heavy obstacle) with one addition:
`updateBreakables` in `world.ts` fires a short-range homing-free bolt at the
player on a ~1.4s cadence whenever they're within 260 units and the block is
still intact. It reuses the existing `hazardNextTickAt` field on
`BreakableObstacle` as its cooldown timer rather than adding a new field --
that field already exists for the street-lamp's post-break hazard tick, and
nothing else needs it on this kind. Shove it, break it, or eat the bolt.

Cross-cutting spots touched for the new kind (see `types.ts`'s note on this
same list for `vending-machine`): `OBSTACLE_WEIGHT_PROFILES` and the
`updateBreakables` firing branch in `world.ts`, `OBSTACLE_COLORS` plus the
light-source/shadow-exclusion arrays in `draw.ts` (it glows red and casts a
pulsing radius like a barrel), and the exhaustive `sizes` record in
`chunks.ts`.

## Ambient item drops (`AreaDef.randomDrops`)

`{ intervalMs }` on an `AreaDef` makes `updateAmbientDrops` (called once a
frame from `stepWorld`, after `updatePickups`) spawn a random pickup
(mostly XP, sometimes health/cred/coin) at a random point in the arena on
that cadence, jittered 0.7-1.3x, regardless of kills or breakables. Backed
by one new `World` field, `nextAmbientDropAt` (`Infinity` when the area has
no `randomDrops`, so the check is a no-op for every existing area). This
is the loot source for the flat maps, which otherwise have almost no
breakables to drop anything.

## `ringer` behavior -- continuous circling, no chase

A cheap, low-HP behavior for swarm/mass content: it never approaches the
player in a straight line. Every tick it re-targets a point on a circle of
radius `traits.swayRadius` (default 150) centered on the player and lerps
toward it; angular speed is `enemy.speed / radius`, alternating clockwise
and counter-clockwise by `enemy.uid` parity so a crowd of them doesn't read
as one rigid gear. `speed` is zeroed for the generic chase-movement line
that runs after the behavior switch, since position is already
fully driven inside the case. This is what makes "rings that circle around
you" and "masses of 100" work as pure data: spawn `ring-runner` with
`formation: 'ring'` (ring-shaped initial positions) and any `burst` count
you like (100 is one wave entry, `{ fromSec, toSec: fromSec + 1, burst: 100
}`), and the behavior keeps them orbiting instead of collapsing onto the
player like a `chase` mob would. `MAX_ENEMIES` is 190 -- budget concurrent
waves in an area with a mass burst accordingly.

## `wraith` behavior -- invisible, then reveal, sway, teleport

The Choir Wraith (`the-choir` area, 20-unit burst) is the elaborate one:

1. **Lurking** (`traits.revealMs`, 20000ms on Choir Wraith): set once at
   spawn as `enemy.invisibleUntil = w.now + revealMs` (`EnemyActor`, new
   field). While `w.now < invisibleUntil` the enemy is undamageable
   (`damageEnemy` returns immediately), excluded from `nearestEnemy` so
   player homing/chain effects don't waste themselves on something they
   can't hit, deals no contact damage (same gate as `ghostUntil`), and
   renders at `globalAlpha 0.05` in `draw.ts` rather than skipping the draw
   call outright -- a keen-eyed player can still catch a shimmer, which
   reads as designed rather than as a rendering bug. A sparse particle
   puff every 700ms while lurking is the only tell before the reveal.
2. **Reveal**: the instant `invisibleUntil` passes, the enemy is fully
   damageable, visible, and starts firing `ranged` shots at the player
   (identical projectile shape to the `spitter`/`lookout` cases).
3. **Sway**: every tick it re-targets a point on `traits.swayRadius`
   (210) around the player with a slow angular drift plus a sine-wave
   radius wobble -- reads as circling and breathing at once, not a rigid
   orbit.
4. **Teleport**: every `traits.swayMs` (6500ms default, 6500 on Choir
   Wraith), it rerolls its orbit angle and snaps straight to the new
   position with a particle burst, then resumes swaying from there.
   Repeats indefinitely; there's no second lurking phase.

"Infinite health" is deliberately *not* `Infinity` -- `enemy.hp / enemy.maxHp`
feeds a health-bar width, and `Infinity / Infinity` is `NaN`. Choir Wraith
uses a large finite HP (420,000) and 1 XP: it is not meant to be farmed for
XP or realistically killed inside the encounter window, just survived. If a
future oddity enemy wants the same "unkillable spectacle" feel, keep HP
finite for the same reason.

**Bestiary gotcha:** `BestiaryPanel` shows a "caught / total" ratio over
every entry in `ENEMIES` with at least one recorded kill
(`meta.bestiary[id] > 0`, sourced from `w.killsByEnemy`, which only
increments on an actual kill). An enemy that's realistically unkillable in a
run -- which is the whole point of Choir Wraith -- can never contribute a
kill, which silently makes 100% completion permanently unreachable for
every player. `EnemyDef.excludeFromBestiary` exists for exactly this: set it
on any enemy whose HP is intentionally out of a run's reach, and
`BestiaryPanel` drops it from both sides of the ratio (it still appears in
the grid as a locked entry, same as any other enemy nobody's killed yet --
only the completion math is affected). Any new "spectacle, not a kill
target" enemy needs this flag too.

Two new `EnemyActor` fields carry this: `invisibleUntil` (also reused by
`ringer`'s sibling, `ghostUntil`, semantics but gates damage/targeting/render
rather than just contact damage) and `phaseUntil` (`w.now` the current sway
phase ends and the next teleport fires).

## Wave-table vocabulary, without new engine features

"Sporadic" and "masses" didn't need new `WaveDef.formation` values --
they're achievable with the fields that already exist:

- **Sporadic**: many short, deliberately *unevenly spaced* wave entries
  (a few seconds wide, offset across the whole run) instead of the usual
  long overlapping ramps. `sporadic-ward`'s wave table is the reference
  example -- eleven short windows scattered from `fromSec: 4` to
  `fromSec: 185` across a 200s run, mixing existing roster enemies with
  `ring-runner` bursts.
- **Masses**: one wave entry with a large `burst` value fired in a
  `toSec = fromSec + 1` window, same as any other burst -- just bigger.
- **Rings**: `formation: 'ring'` (already existed) for the initial spawn
  positions, paired with the `ringer` behavior above for the *ongoing*
  circling motion. Formation alone only shapes where a wave's enemies land;
  it doesn't make them orbit afterward.

## No-wall flat maps

"No walls" means the obstacle list simply omits every wall-forming kind
(`barrier`, `building`) -- `AreaDef.bounds` still defines the play boundary
via `clampToArena` the same as any other timed area (this is not endless
mode). The three flat maps (`flat-lot`, `flat-tarmac`, `flat-mall-roof`)
use only `attack-block`, light decorative props (`flora`, `trash-can`,
`ac-unit`, `street-lamp`), and `randomDrops` for loot. Progression is
chained off kill count (`{ kind: 'kills', count: 130 }`) rather than the
main district `clearArea` chain, since these are optional side content, not
gates on story progress; the two big mini-maps chain off clearing the flats,
and `the-choir` (the finale set-piece) chains off clearing the last story
area (`haven-of-the-bubs`) instead.

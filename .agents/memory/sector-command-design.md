# Sector Command — RTS/campaign mode

## What shipped

A playable campaign mode that reuses the survivor run loop rather
than forking it. A mission is a normal `RunScreen` run with three extra things
attached: an authored map, a `MissionRuntime`, and a `SectorCommandState`.

Entry: the public Sector Command action beside the Map Builder inside the
Sanctum computer. Individual missions still consume normal progression through
their commander and prerequisite requirements.

### The Tier 1 economy: a stolen army

There is no production, no resource and no build queue. Every unit you have is
an enemy you weakened and captured, so the economy *is* the wave, and every
unit costs you the kill (`captureEnemy` deliberately does not increment
`w.kills` or drop loot). `SectorUnitDef.captureHpFraction` is the window: an
enemy must be under that fraction of max HP before it can be turned. Bosses are
never capturable, and `sectorMissions.test.ts` enforces that against
`ENEMIES_BY_ID` so a roster edit can't quietly make one capturable.

### Load-bearing engine decisions

- **`commanded` is not `convertedUntil`.** The allymaker weapon's temporary
  ally already existed and already inherited stats, rig, HP and grid
  membership. Sector Command adds a *separate* `commanded: boolean` rather than
  reusing that timer, so the weapon's behavior is untouched and the two can
  never be confused by a `w.now >= …` comparison.
- **`damageEnemy()` is where friendly fire dies.** `nearestEnemy()` skipping
  commanded units only stops them being *aimed at*; splash, status ticks,
  thrown enemies and every other path still reach `damageEnemy`. The single
  `if (enemy.commanded) return;` there is what actually makes a unit safe from
  its own side. A unit's own mortality (hostile contact damage in
  `advanceCommandedUnit`) touches `hp` directly and so is unaffected by it.
  There is a regression test that runs 8 simulated seconds with no hostiles
  present and asserts a captured unit takes zero damage.
- **A move order is the storm cloud's lerp with a sticky target.** No
  pathfinding exists anywhere in this engine and none was added: units steer
  straight, get ejected by `collideObstacles`, and slide along walls. They
  *will* press against a concave obstacle cluster. Keeping orders short and
  near the player is the design mitigation, and the briefing screen says so
  out loud rather than hiding it.
- **Mission clear is "every required objective done".** Optional objectives
  never hold a mission open. `updateMission` runs after enemies, breakables and
  fluids so objectives read the same frame's state.

### Mobile is the constraint that shaped the controls

The one rule everything else follows: **the movement stick and the RTS grammar
never share a pointer-down.** A visible Command toggle swaps the whole pointer
meaning — with it off, a drag steers you; with it on, a drag marquee-selects
and a tap issues an order. Movement under `COMMAND_TAP_SLOP` (12px) is a tap,
not a drag, so a thumb wobble can't wipe a standing selection.

Everything else follows from having no hover, no right-click and no keyboard:
Select All is a button (there are no control-group hotkeys), capture is a
button with a reach radius and a nearest-eligible sort (there is no unit to
click on precisely), and unit caps stay small (6–8 squad cost) because ~10px
sprites and fat fingers do not permit dense micro.

**Commander view** is the second camera mode, and it is deliberately *not* a
detached drag-to-pan camera: panning and marquee want the same drag on touch,
and adding a third pointer meaning would break the rule above. Instead it keeps
the player-locked camera and pulls it back via the `targetViewOverride` hook
that `MapLivePreview` introduced. Pointer math must read the *rendered* target
view (`renderTargetViewRef`), not recompute the default, or selections land in
the wrong place at commander zoom.

That zoom-out also exposed a latent renderer bug worth remembering:
`drawArenaEdges` blacked out the region past the arena with a fixed 400-unit
border, which is always enough at the default zoom and visibly not enough when
zoomed out. It now derives its extents from the visible world rect.

### What the first playtest broke on

Three complaints, all the same root cause -- the controls were *correct* and
gave the player nothing to read:

- **"You kill units before you can add them."** `captureHpFraction` is 0.35-0.5,
  auto-fire DPS is high, and nothing showed who was capturable. The window
  between "weak enough" and "dead" was often a single frame. Fixed with capture
  **priming**: an enemy weakened inside `CAPTURE_REACH` gets
  `capturableUntil = now + 3.5s`, and while primed `damageEnemy` floors it at
  1 hp instead of killing it. Again the choke point earns its keep -- one line
  covers every weapon, splash and status path. Scoped to missions
  (`w.sectorCommand` non-null), so ordinary runs are untouched, and there is a
  test asserting priming never leaks outside Sector Command.
- **"Hard to drag over characters."** The marquee tested point-in-box against a
  ~10px sprite, so a drag that visibly crossed a unit could select nothing. It
  now tests overlap, inflating by `enemy.radius + SELECTION_TOUCH_PAD`. The box
  also draws from pointer-down at zero size; waiting for the 12px slop before
  rendering anything made the drag feel like it had failed to start.
- **"Commanding is buggy."** A tap on your own unit did nothing -- taps only
  ever issued orders -- and an order with an empty selection failed silently.
  Tap grammar is now: tap a unit (within `TAP_SELECT_RADIUS`, snap-to-nearest)
  selects just that unit; any other tap orders the standing selection; an order
  with nothing selected raises a one-line hint instead of nothing.

The general lesson, worth applying to anything added here: **on touch, an
action that silently does nothing is indistinguishable from a bug.** Every
command verb needs a visible pre-state (the reticle, the capture count on the
button) or a visible failure (the hint).

### Mission success is not the run's `cleared` flag

The engine ends any timed area as `cleared` at `durationSec`, which is right
for a survivor block and wrong for a mission -- and campaign credit was keyed
off it, so **idling out the clock banked every mission**. Objectives were
decoration until this was fixed.

The fix deliberately does *not* widen `RunOutcome` (`'running' | 'cleared' |
'dead'`), which run summary, contracts, episodes and relics all read. Instead
mission success rides separately: `MissionRuntime.failed` is set when the clock
expires with a required objective outstanding, `buildResult` carries
`missionId`/`missionComplete`, and `App.tsx` banks on `missionComplete`. The run
still ends the ordinary way; only the campaign ledger changed.

`RunSummary` now reads that pair to headline *Mission complete* / *Mission
failed*, and is the only place the authored `debrief` string has ever been
shown.

### Tier 2 shipped: beacons

Two invariants keep beacons from undoing Tier 1's tension, and both are tested:

- **A beacon refills a squad, it never inflates one.** When the squad is at
  `squadCap` the spawn tick is *skipped*, not queued, so the mobile unit
  ceiling stays absolute.
- **A beacon is mortal.** Hostiles standing on it break it and reinforcements
  stop, so it is ground worth holding rather than a free tap.

Beacon output is an ordinary commanded unit (`spawnEnemy` then `captureEnemy`),
so it inherits orders, squad-cost accounting and the cap for free.
`SectorMissionDef.economyTier` gates whether beacons exist at all -- a
`'stolen'` mission ignores them even if its map places them.

### Commanded units now fight

Captured units took damage but never dealt any, which made the whole economy
decorative -- a squad you could lose but not use. The melee exchange runs on one
cooldown in `advanceCommandedUnit`, and unit damage is routed through
`damageEnemy` on purpose: kill credit, loot, XP, status and kill objectives all
work exactly as they do for the player. The accepted consequence is that crit
and lifesteal apply to a unit's hits too.

`orderKind` gained `'attack-move'`: walk the order line but break off for
hostiles inside `UNIT_AGGRO_RANGE`, then resume. Plain `'move'` still exists
because disengaging is a different intent from taking ground; a dock toggle
picks which one a tap issues, so a tap still means exactly one thing.

### Fog of war needed its own grid

The earlier note in this file suggested reusing the renderer's shadow caster.
**That was wrong** and is corrected here: the shadow caster is a per-frame
lighting effect projecting breakable corners away from light sources, and it
cannot answer "has the player seen this cell". Fog is a coarse `Uint8Array`
grid (64-unit cells, matching the ground tile) stamped from the player and every
commanded unit on a 120 ms throttle -- a few KB at mission scale.

**Fog is presentation and targeting only.** Enemy AI still knows exactly where
the player is. There is a parity test that runs two identically-seeded worlds,
one foggy and one not, for 20 simulated seconds and asserts identical kills,
enemy counts, player position and player HP. A fog that changed the simulation
would be a much larger feature; a fog that *looked* like it had would be a lie.

### What the map editor was silently eating

`normalizeCustomMap` filtered placements through a hand-written category list
that was never updated when `spawn-point` and `objective-marker` were added --
so the editor could place them and `saveCustomMap` dropped them on the way to
storage. Campaign maps escaped it only because they read their raw authored
records. The list is now derived from the asset catalog, so a new category
cannot be forgotten there again.

## Deliberately unbuilt (typed, not implemented)

`SectorStructureDef`, `SectorResourceDef` and `SectorProductionDef` exist in
`types.ts` and `SectorMissionDef.economyTier` already names the tier, so a
mission can be authored against a tier the engine does not yet run.

- **Tier 3 — Production.** A real resource (`perKill` income is already the
  shape sketched) plus a build queue. This is where a base-defense mission
  becomes possible.

Worth stealing later, in rough order of value per unit of work: hero units with
abilities (the character roster already *is* a hero roster), rally points,
queued waypoints, tech tiers, hostile beacons you can raze (needs a
player-targeting change, since weapons only ever target enemies), and a
skirmish mode against a scripted opponent.

Queued waypoints were scoped out of the QoL pass on purpose: on touch they cost
another gesture for less benefit than unit combat, which was the actual gap.

**Story hooks already exist.** `MissionBeatDef` carries authored lines and
fires on elapsed time, objective completion, or a squad wipe — that is the seam
where "movie scenes" and original characters plug in without an engine change.
Missions are bound to registered `FactionDef`s and to allies the player
actually rescued (`commanderAllyId`), so the campaign consumes base-game
progression instead of running beside it.

## Rules that must survive anything added here

1. No pointer gesture may mean two things at once. If a feature needs a new
   gesture, it needs a mode toggle, not an overload.
2. Any new camera behavior must feed `renderTargetViewRef` (or its successor),
   or pointer→world conversion silently drifts.
3. Captured units stay excluded at `damageEnemy`, not only at targeting.
4. Unit counts stay small. The mobile ceiling is fingers, not `MAX_ENEMIES`.
5. Mission content is data (`sectorMaps.ts` / `sectorMissions.ts`), validated
   at module load by the `mission()` factory — bad content fails at boot, not
   mid-run. The factory now also rejects a `kill-enemy` objective naming an
   enemy that does not exist, and a test rejects one naming an enemy the
   mission's own map never spawns. That test caught an impossible mission the
   day it was written.
6. A beacon refills a squad but never inflates it past `squadCap`, and fog
   never touches the simulation. Both are load-bearing and both are tested.
7. On touch, an action that silently does nothing is indistinguishable from a
   bug. Every command verb needs a visible pre-state (the capture reticle, the
   candidate count on the button) or a visible failure (the hint line).

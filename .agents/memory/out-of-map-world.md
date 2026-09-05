---
name: Out-of-map world -- Beyond the Fence
description: The dash-through-blocks unlock, the fenced yard it opens, gas tanks, radial shooters, and the Instant Transmission pickup.
---

"Beyond the Fence" is the first area whose *point* is leaving the arena you were
given. It exists because the dash gained a way through solid geometry, and an
ability that opens walls needs somewhere worth opening.

## Through Traffic (dash phasing)

The Quartermaster item `through-traffic` sets `World.dashThroughBlocks`. While
`dashUntil > now` and the flag is on, `updatePlayer` skips `collideObstacles`
entirely and calls `bounceBlocksAlongDash` instead: every movable prop the dash
sweeps takes one shove along the dash direction (tracked per-dash in
`player.dashPropUids`, same pattern as `dashHitUids`). The dash deals no damage
of its own -- the shoved prop's own flight does whatever damage happens, through
the existing `damageEnemiesFromMovingProp` path.

`clampToArena` still runs, deliberately: phasing is meant to get you past
*props*, not out of the world. An area that wants a reachable "outside" builds
it as playable space inside `bounds`, with a wall of `barrier` props short of
the edge -- which is exactly how Beyond the Fence's outer strip works.

Fence panels leave one gate per side. Enemies walk straight lines and do not
path, so a fully sealed perimeter would strand every spawn outside it.

## Gas tanks

`ObstacleDef.kind === 'gas-tank'` is a `medium-movable` prop with **1 HP**, so
any hit at all is fatal and every death is `detonateGasTank`: a
`GAS_TANK_BLAST_RADIUS` nova that burns enemies, hurts the player, throws nearby
props (force only), leaves a burning-oil tile, and marks every intact tank in
the ring broken so it detonates too.

The chain is a bounded queue (`GAS_TANK_MAX_CHAIN`, 12) inside one call, not
recursion back through `damageBreakable` -- and the props it throws take force
with **zero damage**, so a blast can never re-enter the chain through a third
path. A fuel farm of any size therefore resolves in one frame, once.

Cross-cutting spots for the kind (the usual list): `types.ts` union,
`OBSTACLE_WEIGHT_PROFILES` + the `damageBreakable` break branch in `world.ts`,
`OBSTACLE_COLORS` plus the light-source/shadow-exclusion arrays in `draw.ts`
(it glows), and the exhaustive `sizes` record in `chunks.ts`.

## `traits.radialShots` -- "shoots in every direction"

A firing-*shape* modifier, not a behavior. `fireEnemyShot` is the single volley
helper the `spitter`, `lookout` and `wraith` cases all call; when the enemy def
carries `traits.radialShots: n` it emits `n` evenly-spaced shots covering the
full circle with the aimed heading as the first spoke. Any shooter becomes
omnidirectional by adding one number to its record -- no new `EnemyBehavior`
value, and no new case in the movement switch.

`the-groundskeeper` is deliberately a `spitter` rather than a `teleporter`:
`traits.teleportMs` is applied *before* the behavior switch and so is
behavior-independent, while `spitter` is what keeps an enemy at the range its
radial volleys need.

## Null alloy and random prefabs

`aegis-slab` is the one material projectiles do not get through: no `hp` entry
in `OBSTACLE_WEIGHT_PROFILES` (so it is indestructible), in
`PROJECTILE_BLOCKING_KINDS`, and handled in `collideProjectileObstacle` before
the breakable branch so a shot stops dead rather than passing damage to a prop
that cannot take it.

Prefabs built from it live in `data/prefabs.ts` and are scattered by
`AreaDef.randomPrefabs: { count }`. `scatterPrefabs` runs once at world
creation, rejects placements that overlap authored props, other prefabs, or the
player's spawn circle, and draws every roll from `w.propRng` -- the same
separate stream the seal rolls use, so a map's furniture can be re-tuned without
shifting any combat or loot roll. A seed reproduces a layout exactly. Adding a
prefab is a record in `data/prefabs.ts`, never a change to the scatter code.

## Instant Transmission (`PickupKind === 'teleport'`)

A findable escape charge, not a weapon. It is **held, not spent on pickup**:
collecting one increments `World.teleportCharges` (capped at
`TELEPORT_CHARGE_CAP`), a HUD badge shows the count, and the player spends it
from the pause screen through `useTeleportCharge` -- the single guarded entry
point, so the UI never touches world state itself. On spend, `instantTransmission` scores
16 candidate points in a ring 260-520 units out by distance to the nearest
enemy, blinks the player to the best one, clears their knockback, grants
`INSTANT_TRANSMISSION_INVULN_MS` of invulnerability and shoves the arrival zone
clear with **force only** -- no damage, no XP, no kills, so it can never become
a reward source. It reaches the player through the existing
`AreaDef.randomDrops` bag (`AMBIENT_DROP_KINDS`), weighted as the rare entry.

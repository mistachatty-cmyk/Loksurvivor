# Mirror Ball Cartel (disco faction)

A new disco-themed faction layered on top of the already-merged Run
Modifiers / HordeSpin system (`run-modifiers.md`) -- this doc covers only
the content that system doesn't: a faction, enemies, an area, and two new
render-only hooks. Don't duplicate the modifiers/wheel work; it's built.

## Render-only hooks
- `EnemyDef.traits.colorCycleMs` (types.ts): a period in ms. Read in
  `draw.ts`'s `drawActors` to compute a `hueRotate()`'d tint from the
  enemy's `accentBright` color and pass it through `drawRig`'s existing
  `tint` option -- the same option already used for freeze/converted status,
  so no new rendering pipeline was needed.
- `AreaDef.discoFloor` (types.ts): hue-rotates the ground's `tile`/`glow`/
  `seam` colors in `renderWorld` before `drawGround` runs, same `hueRotate`
  helper.

Both are additive and don't touch simulation -- pure `draw.ts` reads of
`w.now`.

## Roster
Three enemies form the `Mirror Ball Cartel` faction roster (`factions.ts`),
so `squadWave()` brings them in together:
- `disco-diva` -- ranged `spitter` (laser via the existing `ranged` tuning).
- `mirrorball-heavy` -- giant floaty `drifter`.
- `chroma-wisp` -- mini `drifter` with `colorCycleMs`.

The boss, `disco-orb-prime` (giant `spitter` with a fast `ranged.cooldownMs`
for sweeping fire, plus `colorCycleMs` + `shiftMs` for pulsing), deliberately
stays **out of** the roster array -- a `squadWave` roster spawns repeatedly
every tick (see `high-roller-syndicate`'s single-member roster for the
established precedent of keeping a boss out of its mob squad). Its `faction`
field still names `Mirror Ball Cartel` for bestiary grouping; `factions.test.ts`
only requires the *name* be registered, not that every enemy naming it
appears in the roster.

## Area
`mirror-lounge` ("The Mirror Lounge") chains after `neon-overflow`
(`unlock: { kind: 'clearArea', areaId: 'neon-overflow' }`), sets
`discoFloor: true`, and ends with a one-time `disco-orb-prime` spawn
(a normal wave entry, `fromSec`/`toSec` one second apart -- same pattern as
`neon-overflow`'s `marquee-reaper` entry).

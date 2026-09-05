# Crew feature: rescue routes, room population, activity variety

## Why this doc exists

The crew/ally system (`AllyDef`, `CrewActivityDef`, `HubRoomDef`) had two
rooms (`the-alley`, `the-storefront`) with zero activities and zero
guaranteed allies, and a rescue-route bug that silently dropped a rescue.
Fixing that required understanding the exact runtime contract for how
rescues and activities resolve, which is non-obvious from the data files
alone.

## Rescue routing contract

`nextRescueAllyId(areaId, rescuedAllyIds, fallbackAllyId)` (called once, at
`RunScreen.tsx:214`, when an area is cleared) checks
`RESCUE_ROUTE_BY_AREA[areaId]` first: if present, it returns the first ally
in that ordered list not already in `rescuedAllyIds`, or `undefined` once
the whole list is rescued. Only if the area has **no** route-table entry
does it fall back to the area's static `AreaDef.rescueAllyId`.

This means:
- A **single-ally** area needs only `AreaDef.rescueAllyId` — no
  `RESCUE_ROUTE_BY_AREA` entry. This is the pattern for `back-alley`,
  `bar-siege`, `haven-of-the-bubs`, and now `riverfront` (denny),
  `old-market` (ruth), `northline-yard` (frankie), `civic-plaza`
  (constance).
- A **multi-ally, replayable** area (the player can clear it repeatedly and
  should get a different ally each time) needs a `RESCUE_ROUTE_BY_AREA`
  entry listing every ally in order. `monroe-strip` is `['vee', 'pippa',
  'theo']` — theo was appended to the existing two-ally chain rather than
  given his own area, since monroe-strip is the area the early game sends
  players back to repeatedly.
- Do **not** add a single-element `RESCUE_ROUTE_BY_AREA` entry for a
  single-ally area — it's redundant with `rescueAllyId` and, worse, was
  previously a copy-paste trap: `riverfront` and `crystal-cellar` both had
  `rescueAllyId: 'sable'` before this pass, so whichever area a player
  cleared second granted nothing. `progression.test.ts` now has a
  three-deep assertion (`vee` → `pippa` → `theo` → `undefined`) specifically
  to catch a route silently truncating again.

## Room population

Every `HubRoomDef` should have both an ally who can permanently live there
(`AllyDef.room`) and enough `CrewActivityDef` entries scoped to that
`roomId` for `preferredActivitiesForAlly()` to have real rotation options —
`rollCrewActivities()` picks from an ally's `preferredActivityIds` filtered
to activities whose `roomId` matches the ally's `room`, so an ally with zero
matching activities silently never displays a task. Before this pass,
`the-alley` and `the-storefront` had allies (added in this same pass) but
no activities at all scoped to either room. Every room now has 3+ activities
and at least one resident ally.

## Activity design conventions confirmed by this pass

- Effect magnitude follows the existing scale, not a new one: `add` for
  crit/lifesteal is in the 0.01–0.03 range, `add` for armor is
  0.02–0.05, `mult` for haste is 0.94–0.96 (i.e. -4% to -6%, since haste is
  a cooldown multiplier), `mult` for power/area is 1.05–1.10.
- `mult` is only meaningful on stats with an established nonzero baseline
  (`area`, `haste`, `power`). Every other `BaseStats` field (`maxHp`,
  `speed`, `power` at times, `armor`, `magnet`, `crit`, `lifesteal`) should
  use `add` — a `mult` on a stat most characters start at 0 (crit,
  lifesteal) is a silent no-op.
- Icons are a closed `CrewActivityIcon` union checked exhaustively in
  `HubScreen.tsx`'s `ACTIVITY_ICONS` map (`satisfies Record<...>`) — adding
  an activity with a new icon means extending both the union in
  `types.ts` and the map in `HubScreen.tsx`, or typecheck fails immediately.
- Flavor mix per room follows the room's established theme rather than
  reusing one gimmick everywhere: `main-floor` (bar) got a music/hospitality
  set (jukebox, polishing the bar, running the till), `rooftop-perch` got
  observational/physical activities (watching the skyline, stretching),
  `the-cellar` leaned into the existing music/anomaly theme (pressing
  records, brewing, cataloging vinyl), `the-alley` (workshop) got
  maker/craft activities (welding, sharpening, painting a mural), and
  `the-storefront` (records room) got clerical/street activities (filing
  ledgers, walking the block, keeping a lookbook).

## Ally visual variety without hand-authored sprites

`AllyDef` never carried a full `SpriteRig` — `allyRig()` in `progression.ts`
derives one from `humanoidRig()` using a deterministic height/width from the
ally's id plus a small set of boolean silhouette flags. Before this pass
those flags were hardcoded per-ally by name (`ally.id === 'sable'` for
`seated`, etc.), which doesn't scale. `AllyDef` now has an optional
`rigHint?: 'seated' | 'hood' | 'cap' | 'bulk' | 'hunched' | 'wings' |
'staff' | 'puffs' | 'halo' | 'cloudHair' | 'flarePants'` field, and
`allyRig()` maps it straight onto the matching `humanoidRig()` option. New
allies pick a `rigHint` that reads as their role (`denny`: `cap`,
ferry hand; `ruth`: `bulk`, market keeper; `frankie`: `staff`, signalman;
`constance`: `halo`, sister/clerk; `theo`: `hunched`, locksmith) rather than
inventing new rig geometry — reuse the existing humanoid options before
adding a new one to `sprites/rigs.ts`.

## Pre-existing, out-of-scope failure noticed during this work

`world.test.ts`'s "crew rumors apply bounded effects through existing run
systems" test fails on current `main` independent of this change (confirmed
via `git stash` + rerun: 1 failure on clean baseline, same test). It exercises
`chain-whip`/`nightcrawler`/`bell-shock`, none of which this pass touched.
Left unfixed as out of scope for a crew-roster content pass; flagged here so
it isn't mistaken for a regression introduced by this work.

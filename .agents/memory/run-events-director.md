---
name: Run events (Director) contract
description: How seeded run beats (supply drop, rush-hour stampede) are scheduled, unlocked, simulated, drawn and counted. Read before adding a beat.
---

Built v0.22.5, step 1 of `docs/EVENTS_AND_INTERACTIONS_PLAN.md`.

- `data/runEvents.ts`: `RUN_EVENTS` records + `scheduleRunEvents(seed, mapsCleared, disabled)`.
  Seeded with `quirkHash`, never `w.rng`. Count = 0 below 2 maps, then +1 per 3 maps (max 4);
  one beat per 110s window with 80s jitter, so beats never overlap. `unlockMaps` gates each beat
  (supply-drop 2, rush-hour 4). New beat = a record + one branch in `updateRunEvents` (world.ts).
- `createWorld` setup `runEvents: { mapsCleared, disabledIds? }`; omitted = no beats, so every
  existing test/fixture is unchanged. `RunScreen` passes `mapsCleared(meta).have`.
- Phases wait -> warn -> active -> survived, like the Quirk Surge. Survived is pushed at the end of
  the active window only; death or pause mid-beat pays nothing, and nothing is counted twice.
- Supply drop pays via ordinary pickups (health, cred, prism-quartz) plus 4 guards from the
  area's own non-boss wave enemies. Stampede enemies get the optional `EnemyActor.stampede`
  (straight run, still damages on contact, skips normal AI); optional so hand-built test
  fixtures keep compiling.
- Drawn by `drawRunEventMarker` (draw.ts): drop ring + beam, stampede lane lines and green gap.
- Counted in `meta.runEventsSurvived` (id -> count) from `RunResult.runEventsSurvived`; achievements
  `moment-first / 10 / 50 / both`.

## Not built yet
Per-beat Settings toggle (`disabledIds` is plumbed but nothing sets it), beats in the Archive/bestiary,
Blackout / Block party / Tremor / Relay storm, first-time tooltip, a screenshot playtest.

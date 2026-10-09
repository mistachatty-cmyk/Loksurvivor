---
name: Crew call-ins
description: How rescued allies lend a hand mid-run (shared cooldown, rotation, effects reuse existing mechanics) and the design choices behind it.
---

Built v0.22.9, step 3 of `docs/EVENTS_AND_INTERACTIONS_PLAN.md`.

- Decision (the plan's open question): NO loadout slot. Every rescued ally with an entry in
  `data/crewCallIns.ts` joins `World.callIns.roster` in rescue order; each press calls the next one
  and rotates. One shared 30s cooldown, first ready at 20s. Unlock = rescuing the ally.
- Effects are a closed union (`heal`, `shield`, `nova`, `stun`, `magnet`, `haste`) that map onto engine
  pieces that already exist: HP, `invulnUntil`, `damageEnemy` (so kills still count once), `frozenUntil`
  (bosses excluded), `magnetUntil`, `rootglassUntil`. A new call-in is a record, not a loop edit.
- Input: control action `callin` (default Q / pad LB). RunScreen sets `callInRequestRef`; consumed once
  per frame via `callInCrew(world)`. HUD `callIn { name, label, readyPct }` drives the round button.
- Counted: `RunResult.callInsUsed` -> `meta.callInsUsed`; achievements `crew-callin-1/25/100`.
- Old saves: `normalizeControls` gives a missing action a spare key if its default is already used, so
  adding actions never wipes someone's bindings.
- Lines are kid-safe and avoid the banned word (CLAUDE.md naming rule).

Not built: call-in upgrades after N uses, ally-pair bonds, a visible ally sprite arriving on screen,
a per-ally picker, characters-with-no-crew teaser, tests for each effect kind beyond heal.

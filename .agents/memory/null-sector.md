# Null Sector: art-direction break, maze layout, escalation timer

## Why this exists
A request for a themed world that "goes past what's cute" and "breaks
outside of the general theme" — 616's other areas share one visual language
(fictionalized Grand Rapids street-level color, soft warm lighting). Null
Sector deliberately doesn't: cold cyan/magenta on near-black concrete, a
decommissioned data-center basement instead of a city block, a 2600x2600
maze instead of an open arena, and a fixed 10-minute match built around a
repeating spawn-escalation rhythm instead of a normal wave ramp.

## The 6 world-unique mechanics (5+ required)
1. `server-rack` — the only new `ObstacleDef` kind added for this world.
   Cross-cutting by necessity (touches `types.ts`, `world.ts`
   `OBSTACLE_WEIGHT_PROFILES` + a new AoE-on-destroy branch in
   `damageBreakable`, `draw.ts` `OBSTACLE_COLORS` + both the light-source
   list at ~1939 and its shadow-exclusion counterpart at ~1981, `chunks.ts`
   `sizes`) — this was the one accepted cross-cutting change for the whole
   world; everything else here is pure data.
2. The maze layout itself: a radial 8-rack "server ring" hub plus four
   diagonal chicane corridors with alternating-offset walls, unlike any
   other area's open-block layout. Pure `obstacles: []` placement.
3. `ac-unit` obstacles reused as "coolant conduits" — this obstacle kind and
   its coolant-fluid-tile-on-break behavior already existed (see
   `damageBreakable`'s `ac-unit` branch); Null Sector just leans on it
   thematically. Zero new code.
4. Unusual `formation` timing — `drift-shard` swarms arrive in `pincer`
   bursts on a cadence unique to this area; the `squadWave()` "signal spike"
   set piece (mechanic 6) uses `ring`. Both reuse `formationPositions` in
   `world.ts`, already fully generic.
5. The 10-minute escalation rhythm — `escalatingWaves()`, a new
   `data/authoring.ts` helper (see below).
6. A one-time "signal spike": the whole Null Sector roster arrives together
   via `squadWave()` at the match's halfway point (300s) — the first real
   in-game use of that helper since it was built.

## `escalatingWaves()` (data/authoring.ts)
Takes `enemyId`/`baseRatePerSec`/`matchLengthSec` (+ optional `cycleSec`,
`steps`), and returns a flat `WaveDef[]`: `steps` sequential waves per
`cycleSec`-long cycle, rate climbing `baseRatePerSec * (stepIndex + 1)` each
step, then resetting for the next cycle. Repeats until `matchLengthSec` is
covered, clamping the final cycle's last wave's `toSec` so it never overruns
the match length. Pure data-generation — `updateSpawning` in `world.ts`
already tracks `spawnCredit` independently per wave-array index, so no
engine change was needed to support this; it was purely a question of
generating the right sequence of `WaveDef` entries, which hand-typing would
have made ~20 entries of repetitive, error-prone arithmetic.

Null Sector's concrete numbers: `packet-wraith` escalates at 0.4/0.8/1.2/1.6
enemies-per-second across four 30-second steps, five 120-second cycles,
exactly covering the 600-second (10-minute) match.

## Design decisions
- `durationSec: 600` needed genuinely zero engine change — `world.ts`'s win
  condition already checks `w.time >= w.area.durationSec` generically for
  any non-endless area (confirmed by reading the check directly rather than
  assuming from CLAUDE.md, which is worth doing every time: this codebase
  has had more than one stale doc claim turn out not to match the code, see
  `content-authoring-system.md`).
- Deliberately did NOT add a second new closed-union value (a new
  `FluidKind` for a "corruption stain") in the same pass as `server-rack` —
  one cross-cutting enum addition per world is enough; the coolant-reuse
  approach (mechanic 3) delivers the same "environmental hazard" feel for
  free.
- No area-scoped `data/ambient.ts` entry was added, because `AreaDef` has no
  field associating ambient actor kinds with a specific area — that
  association doesn't exist anywhere in the schema today, so adding one
  would itself be a schema change out of scope for "just add enemies/an
  area."
- Unlocked via `clearArea: 'the-choir'` (the previous endgame area) rather
  than a discovery gate, so it reads as a true "there's something underneath
  even that" finale-plus area.

## See also
`CLAUDE.md`'s "Spawning a larger group" and "Adding an enemy/area,
checklist" sections; `content-authoring-system.md` for `squadWave()`'s
original design.

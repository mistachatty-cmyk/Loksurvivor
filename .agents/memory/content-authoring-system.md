# Content-authoring system: factions, squad waves, palette helper

## Why this exists
Adding the Neon Arcade area/enemies surfaced three structural gaps in the
"data-driven by design" rule: `CLAUDE.md` claimed authoring helpers
(`palette()`/`BASE_STATS_DEFAULTS`) that did not actually exist anywhere in
the codebase; `EnemyDef.faction`/`WaveDef.faction` were free-text strings
with no registry, so a typo silently drifted; and the `test` script listed
`*.test.ts` files by hand in `package.json`, so a new test file could be
written, committed, and never run by CI without any error. This pass fixed
all three.

## What changed
- **`data/authoring.ts`** (new): `palette(seed)` — a real version of the
  helper CLAUDE.md had wrongly claimed existed — builds a full
  `SpritePalette` from 4 required colors, defaulting `accentBright`/`skin`/
  `glow` to `accent`/`body`/`accent`. `squadWave(seed)` builds a `WaveDef`
  that spawns a whole faction roster as one lead enemy + `group` array,
  pulling from `data/factions.ts` instead of the id list being typed out (and
  potentially typo'd) inline.
- **`data/factions.ts`** (new): `FactionDef { id, name, description, accent,
  roster }` registry, seeded from the 8 faction names already in use across
  `enemies.ts`/`areas.ts` (Afterimage Choir, Cinder Procession, River Antler
  Court, Bubblenaught Tide, Bubbleteer Parade, Loop Chorus, Choir of Twenty,
  Cabinet Rot) with their actual roster ids cross-checked against
  `enemies.ts`.
- **`data/factions.test.ts`** (new): checks every `EnemyDef.faction` string
  against the registry, every `FactionDef.roster` id against `ENEMIES`
  (both directions), and exercises `squadWave()`'s multiplication + its
  unknown-faction error path.
- **`package.json`**: `test` script changed from a hardcoded list of 13
  `*.test.ts` paths to a glob (`'src/**/*.test.ts'`) passed straight to
  Node's built-in test runner, which supports glob patterns natively. A new
  test file now runs without editing this script. Verified equivalent
  (174 tests found via glob vs. 170 hardcoded + 4 new before the glob
  change) before committing.

## Design decisions worth keeping
- `palette()`/`squadWave()` are opt-in, not enforced — existing records were
  **not** mass-migrated. Retrofitting ~130 existing character/enemy records
  to a new helper is a large, purely-cosmetic diff with real regression risk
  for a formatting change; the payoff is only in new content being easier to
  write, which the helper already delivers going forward.
- `WaveDef.faction` (the flavor label shown on a wave banner) is deliberately
  **not** validated against the registry — it's already used loosely in
  existing content (a corner-cutter burst labeled "Afterimage Choir" for
  mood, though corner-cutter itself carries no `faction` field). Only
  `EnemyDef.faction` and `squadWave()` rosters are checked. Widening the
  test to also validate `WaveDef.faction` would break that existing,
  intentional flavor usage.
- The `EnemyBehavior` union still lists `teleporter`/`ghost`/`shifter` as
  literal values even though no switch case in `world.ts` handles them (the
  actual effect comes from the orthogonal `traits` object on any real
  movement behavior). Removing those misleading union members was out of
  scope for this pass (a type change, however small, risked ripple effects
  in code paths not audited here) — instead this is now called out
  explicitly in CLAUDE.md's "Enemy `behavior` and `traits` are orthogonal"
  section so nobody else loses time reverse-engineering `world.ts` to learn
  it, the way discovering it cost a full read-through here.

## See also
`CLAUDE.md`'s "Spawning a larger group" and "Adding an enemy/area, checklist"
sections are the day-to-day reference; this file is the *why* behind them.

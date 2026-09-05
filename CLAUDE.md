# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A pnpm workspace monorepo. The only real product is **"616 Survivor"**, a browser
beat-em-up/survivor game (Vampire-Survivors-like) set in a fictionalized Grand
Rapids ("616"), at `artifacts/survivor-616/`. The other workspace packages are
scaffolding, not shipped product:
- `artifacts/api-server` — Express skeleton, health-check route only, not wired to the game.
- `artifacts/mockup-sandbox` — a shadcn/ui component preview sandbox, not shipped.
- `lib/*` — Drizzle ORM + OpenAPI codegen scaffolding, unused by the game (empty schema/spec).

Do not confuse `/home/user/Loksurvivor` (capital L) with `/home/user/loksurvivor`
(lowercase) if both exist on disk — the lowercase one is the real, actively
developed clone with commit history; the capitalized one is a stale duplicate
stuck on the initial import commit.

## Commands

Run from the repo root unless noted:
- `pnpm install` — install all workspace deps.
- `pnpm run typecheck` — typechecks every workspace package (`tsc --build` for
  library refs, then each `artifacts/*` package's own `typecheck` script).
  Run this after any data/type change — the codebase is heavily typed, so
  most content mistakes (a malformed `CharacterDef`, a bad `UnlockRule`, etc.)
  surface here immediately.
- `pnpm run build` — typecheck, then build every package. Note:
  `artifacts/mockup-sandbox` requires a `PORT` env var to build/dev and will
  fail without it — this is a pre-existing quirk of that package, unrelated
  to the game; if you just need the game to build, run the survivor-616
  commands directly instead (below).
- `pnpm test` (from `artifacts/survivor-616/`) runs the game's `node:test`
  suites — engine, data and audio-studio tests, ~174 cases. Run it alongside
  `typecheck` after any engine or data change. The script globs
  `src/**/*.test.ts` (see `package.json`), so **a new `*.test.ts` file is
  picked up automatically** — nothing else to wire up. (This used to be a
  hardcoded file list in the `test` script; a file left off it ran locally
  but never in CI, silently. If you ever see the test script name files
  explicitly again, that regression is worth fixing the same way.) Note the
  hand-built fixtures in `world.test.ts`: an enemy literal there must set
  *every* `EnemyActor` field (a missing `invisibleUntil`/`ghostUntil`
  silently disables contact damage, because `w.now >= undefined` is false).
  No other workspace package has tests — don't add a second runner as a side
  effect of an unrelated task.

For the game itself, run from `artifacts/survivor-616/`:
- `PORT=5173 BASE_PATH=/ pnpm dev` — Vite dev server. `PORT` and `BASE_PATH`
  fall back to `5173` and `/` when unset (which is why the Vercel build, whose
  build command passes neither, works); set them explicitly to pick a free port.
- `PORT=5173 BASE_PATH=/ pnpm build` — production build (`dist/public/`).
- `pnpm typecheck` — just this package.

There is no automated visual/gameplay test suite. Verify changes by running
`pnpm typecheck`, then playtesting via `pnpm dev` (a headless browser +
screenshots works well for this from an agent context — see any recent
commit's description for the manual-verification pattern used).

## Architecture (`artifacts/survivor-616/src/game/`)

The whole game is **data-driven by design** — this is the load-bearing rule,
stated in `types.ts`'s header comment: *"Adding a character, enemy, area,
ally or upgrade means adding a record — never editing the simulation loop."*
Content changes (new character, enemy, weapon, area, ally, upgrade) should
almost always be a new entry in `data/*.ts`, not a change to `engine/world.ts`.

- `engine/world.ts` — the entire simulation (`stepWorld`, ~2300 lines): fixed
  timestep, spatial-hash-grid collision, waves, endless-mode chunk streaming
  and dungeons. `damageEnemy()` is the single choke point all player-caused
  damage flows through (crit/lifesteal, splash damage, etc. all hook in
  there). `World.cycle.phase` (0..1) is the day/night clock, advanced once
  per frame in `stepWorld` — pure function of `w.now` (run-elapsed ms), never
  wall-clock time.
- `engine/math.ts` — shared collision/geometry helpers (`resolveCircleBox`,
  `circleHitsBox`, `createRng`, etc.), reused by both the sim and the renderer.
- `engine/chunks.ts` — endless-mode procedural chunk generation (obstacle
  placement per chunk `variant`); has its own size/weight tables that must
  stay in sync with any new `ObstacleDef` kind (see below).
- `data/characters.ts`, `data/enemies.ts`, `data/areas.ts`, `data/weapons.ts`,
  `data/evolutions.ts`, `data/passives.ts`, `data/progression.ts` (allies,
  hub rooms, discoveries, level-up upgrades), `data/ambient.ts` (non-combat
  background actors), `data/factions.ts` (named enemy rosters) — all
  plain-record content.
- `data/authoring.ts` — shared content-authoring helpers, used across
  `characters.ts`/`enemies.ts`/`areas.ts` rather than duplicated per file:
  - `palette(seed)` fills a full `SpritePalette` from the 4 colors that
    actually vary per record (`ink`/`body`/`bodyDark`/`accent`);
    `accentBright`/`skin`/`glow` default to `accent`/`body`/`accent` and are
    only worth overriding when a record wants them visibly distinct (most
    humanoid characters do, most enemies don't). Existing records were not
    mass-migrated to it — use it for new ones, hand-write the full object
    only when every field genuinely differs.
  - `squadWave(seed)` builds a `WaveDef` that spawns an entire faction's
    roster (see `data/factions.ts` below) together each spawn tick — the
    ergonomic path to "a bigger group" instead of typing out `enemyId` +
    `group: [...]` by hand and risking an id typo nothing catches. See
    "Spawning a larger group" below.
- `data/factions.ts` — registry of named enemy rosters (`Afterimage Choir`,
  `Cabinet Rot`, etc.). An enemy's own `faction` field and every
  `squadWave()` roster are checked against this registry by
  `factions.test.ts`, so a typo on either side fails the test suite instead
  of silently drifting. (A `WaveDef.faction` label — the flavor string shown
  on a wave banner — is looser and *not* checked here: it's fine for one
  burst of a single enemy id to be labeled with a faction name for mood, the
  way `back-alley`'s corner-cutter wave is labeled "Afterimage Choir" without
  corner-cutter itself belonging to that faction.) Adding a new faction means
  adding one `FactionDef` here, not touching the engine.
- `sprites/rigs.ts` — procedural pixel-rig factories (`humanoidRig`,
  `quadrupedRig`, `blobRig`). Characters/enemies are built from a handful of
  parameters (height, width, `bulk`/`hunched`/`seated`/`hood`/`cap`/etc.), not
  hand-authored sprite sheets — extend a factory's options for new
  silhouettes rather than hand-placing `SpritePart`s.
- `render/draw.ts` (`renderWorld`) / `render/sprite.ts` (`drawRig`) — 100%
  Canvas2D, no WebGL, no sprite sheets, no bitmaps in the render path
  (radial-gradient lighting, a hand-rolled shadow-polygon caster, procedural
  rectangle sprites). Screen-space overlays (vignette, damage flash, the
  minimap) are drawn after `ctx.restore()` at the end of `renderWorld`, once
  the camera transform is popped.
- `RunScreen.tsx` — the run loop tying engine + renderer + level-up/pause/
  reel UI together; owns the fixed-timestep loop (`FIXED_STEP`/`MAX_SUBSTEPS`).
- `state/metaStore.tsx` — persistent meta-progression (`localStorage` key
  `survivor616.meta.v1`): unlocks, bestiary, currencies, rescued allies.
  `effectiveStats()` applies permanent ally-boost totals on top of a
  character's base stats — every `BaseStats` field must be a concrete number
  (not optional) or this arithmetic produces `NaN`.

### Enemy `behavior` and `traits` are orthogonal, not alternatives

`EnemyDef.behavior` (`chase`/`charger`/`spitter`/`drifter`/`flanker`/
`shockwave`/`prowler`/`lookout`/`current`/`ringer`/`wraith`/...) selects the
per-frame movement routine in `updateEnemyAI` in `world.ts` — this is a
`switch` with one case per behavior, `chase` being the implicit default when
a behavior has no case.

`EnemyDef.traits` (`teleportMs`, `ghostMs`, `shiftMs`/`shiftScale`,
`burstSpeed`, `swayRadius`/`swayMs`, `revealMs`) are checked *before* that
switch and apply regardless of which `behavior` is selected: any behavior
can teleport periodically (`teleportMs`), go briefly untargetable
(`ghostMs`), or pulse its collision radius (`shiftMs`/`shiftScale`). Despite
`EnemyBehavior` also listing `teleporter`/`ghost`/`shifter` as literal
values, no case in the switch handles them — they read as pure labels and
fall through to `chase`. **Don't set `behavior: 'teleporter'` expecting a
teleport effect; set `behavior: 'chase'` (or any real movement behavior) and
add `traits: { teleportMs: ... }` instead.** Every existing enemy that
teleports/ghosts/shifts follows this pattern — e.g. `spiral-moth` is
`behavior: 'flanker'` with `traits: { teleportMs: 4200, ghostMs: 520 }` — so
grep `enemies.ts` for `traits:` before inventing a new combination.

`ringer` and `wraith` are the two behaviors that *do* fully own an enemy's
movement (constant orbit around the player, and invisible-then-orbiting
respectively) — pairing a `swayRadius` trait with a different behavior does
nothing, since only the `ringer`/`wraith` switch cases read it.

### Spawning a larger group

A `WaveDef` already spawns more than one enemy per tick, two ways that
compose:
- `burst` — copies spawned together each time the wave's `ratePerSec` credit
  fires.
- `group` — additional enemy ids spawned alongside `enemyId` in the *same*
  tick, one of each per `burst` copy.

So `{ enemyId: 'a', burst: 3, group: ['b', 'c'] }` spawns 9 enemies per
tick (3 of `a`, 3 of `b`, 3 of `c`), not 3. `formation`
(`ring`/`wedge`/`wall`/`escort`/`pincer`/`file`/`bait`) then places that
tick's whole batch geometrically around the player instead of stacking them
on one point — see `formationPositions` in `world.ts`.

For a *named* group (a faction's whole roster arriving together, not an ad
hoc id list), use `squadWave()` from `data/authoring.ts` instead of writing
`enemyId`/`group` by hand — it pulls the roster from `data/factions.ts`, so
adding a member to a faction automatically makes every `squadWave()` call
for that faction spawn one more enemy, and `factions.test.ts` catches a
roster id that no longer exists. `squadWave`'s own `burst` still means
"copies of the whole roster," same multiplication as above.

### Cross-cutting rules to respect when adding an `ObstacleDef` kind

Adding a new obstacle kind touches several exhaustive/lookup structures at
once — confirmed by hitting each of these when `vending-machine` was added:
`types.ts` (`ObstacleDef['kind']` union), `world.ts` (`BREAKABLE_HP`,
`PUSHABLE_KINDS` if it should be shovable, the damage-particle/xp-drop
branches in `damageBreakable`), `draw.ts` (`OBSTACLE_COLORS`, and the
light-source/shadow-exclusion filters if it glows), and `chunks.ts` (the
`sizes` record is an exhaustive `Record<ObstacleDef['kind'], ...>` for
endless-mode chunk generation, even if the kind isn't added to `KINDS`/the
per-variant weight tables).

### Adding an enemy, checklist

1. `data/enemies.ts` — new `EnemyDef`: pick a real `behavior` for movement
   (default to `chase` if none of the specialized ones fit) and layer
   `traits` on top for teleport/ghost/shift, per the section above. Use
   `palette()` from `data/authoring.ts` unless every color genuinely differs
   from its default.
2. If it belongs to a named group, either add its id to an existing
   `FactionDef.roster` in `data/factions.ts`, or add a new `FactionDef` —
   don't just set `faction: '...'` on the `EnemyDef` to a string that isn't
   registered; `factions.test.ts` will fail.
3. Reference the new enemy id from at least one `AreaDef.waves` entry (by
   hand, or via `squadWave()` for a whole faction) — an enemy nothing spawns
   is dead content.
4. `pnpm typecheck` (catches a malformed `EnemyDef` or a `WaveDef.enemyId`
   that doesn't type-check) and `pnpm test` (catches a `faction`/roster typo
   and any `world.test.ts` fixture affected).

### Adding an area, checklist

1. `data/areas.ts` (or a themed sibling file spread into `AREAS`, like
   `areas-2x.ts`) — new `AreaDef`: `bounds`, `obstacles` (existing
   `ObstacleDef['kind']` values unless you're also doing the cross-cutting
   work below), `waves`, `unlock`. Chain `unlock: { kind: 'clearArea', areaId: '<previous>' }`
   to the area that should precede it, or `{ kind: 'default' }` only for a
   true entry point.
2. Add a `DISCOVERIES` entry in `data/progression.ts` if `discoveryId` is
   set — the id is a plain string, not validated by the type system, so a
   typo there silently shows no discovery text in the UI.
3. If introducing a new ally rescue, add the `AllyDef` in `data/progression.ts`
   before setting `rescueAllyId`.
4. `pnpm typecheck` then `pnpm dev` and playtest the new area's wave
   pacing — `durationSec` and `ratePerSec` values aren't checked for being
   survivable by anything automated.

### Durable decisions in `.agents/memory/`

Read these before touching the areas they cover — they record *why*, not
just *what*, so the reasoning doesn't need to be re-derived:
- `survivor-616-art-assets.md` — user-supplied reference art in `public/art/`
  must never be shown raw in a UI card/panel (only the procedural rig may
  represent a character; scene photos are fine as backdrops directly).
  Also: never fabricate real artist/licensing claims — the soundtrack only
  plays the player's own local audio files.
- `endless-mode-engine.md` — why dungeons are centered on the player's entry
  position, why chunk obstacles lose their visual `kind` (inferred from
  dimensions in `draw.ts` instead), and the endless-mode difficulty caps
  (`hpMult` ≤ 1.7, spawn rate ≤ 3.2/s) — any new difficulty multiplier must
  be composed *inside* those `Math.min()` calls, never stacked on top.
- `MEMORY.md` — index/entry point for the above.

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
- No unit test runner exists anywhere in this repo (script lists are always
  dev/build/serve/typecheck) — don't introduce one as a side effect of an
  unrelated task.

For the game itself, run from `artifacts/survivor-616/`:
- `PORT=5173 BASE_PATH=/ pnpm dev` — Vite dev server. `PORT` and `BASE_PATH`
  are **required** env vars (the config throws without them); pick any free
  port and `BASE_PATH=/` for local work.
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
  background actors) — all plain-record content. `characters.ts` has small
  `palette()` / `BASE_STATS_DEFAULTS` authoring helpers to cut down per-record
  boilerplate; use them for new characters rather than repeating the full
  `SpritePalette`/`BaseStats` shape by hand.
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

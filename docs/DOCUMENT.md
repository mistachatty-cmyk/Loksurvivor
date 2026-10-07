# 616 Survivor: project document

The one-page entry point for any AI or contributor picking this repo up cold. It points at the deeper files; it does not repeat them. Last updated 2026-10-07 (v0.19.1).

## What the product is

**616 Survivor** (`artifacts/survivor-616/`): a browser beat-em-up and survivor game set in a fictionalized Grand Rapids. React, Vite, TypeScript, Canvas2D engine. Everything else in the pnpm workspace is scaffolding (`api-server`, `mockup-sandbox`, `lib/*`).

## Where to read, in order

| Need | File |
|---|---|
| Rules, commands, architecture, naming ban | `CLAUDE.md` |
| Who does what, handoff format | `AGENTS.md`, `COLLABORATION.md` |
| Latest big-change handoff | `docs/ai-handoff-2026-10-04.md` |
| Why a system works the way it does | `.agents/memory/MEMORY.md` (index) |
| Currencies and earning | `docs/ECONOMY.md` |
| Open problems and bugs | `docs/PROBLEMS.md` |
| Hideout UI direction and micro-interaction plan | `docs/HIDEOUT-UI.md` |
| PR triage ("Pullcheck") | `docs/PULLCHECK.md` |
| Deploy | `docs/vercel-deploy.md` |

## Working loop

1. Branch from `main`. One focused change per branch.
2. Content is data: add records under `src/game/data/`, never edit the simulation loop for content.
3. From `artifacts/survivor-616/`: `pnpm typecheck` and `pnpm test` (glob picks up new `*.test.ts`).
4. Bump `CHANGELOG` in `src/game/data/changelog.ts`, then `pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json`. `publicUpdates.test.ts` fails if you forget.
5. New player-facing text goes in `src/locales/en.json` only; the Auto-translate action fills the rest.
6. Hand off: what changed, how it was checked, known limits, next task.

## Sync duties (LOK platform)

Cards, palettes, auras, hats: run `scripts/export-lok-registry.ts`. Lore: `scripts/export-public-lore.ts` then copy to the hub. Patch notes: the updates export above. Full steps in `CLAUDE.md`.

## Permanent constraints

- The word banned in `CLAUDE.md` never appears in new copy, ids, classes, test ids, comments or docs.
- Keep original looks and modes when adding new ones; the new thing is an option.
- Reference art is never shown raw in a UI card; only the procedural rig represents a character.
- No invented real artists or licensed music.

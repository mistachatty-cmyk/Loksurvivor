# Google AI Studio build — merge plan & audit scaffold

Status: **waiting on the AI Studio push** (not yet in the repo as of 2026-10-04).

## Safety net
- `main` was at `b68dbde` (#183 cosmetic shop hats) when this plan was written.
- Backup branch: `backup/main-pre-ai-studio-2026-10-04` -> `b68dbde`. Never push to it.
- Tag push is blocked by the session proxy; create a tag manually from GitHub if wanted.
- Older branch `claude/google-ai-studio-build-check-9gdk6n` is a prior, much older check (behind main, deletes ~13k lines) — do not merge it.

## Import procedure (when the AI Studio build is pushed)
1. Push AI Studio's code to its own branch (e.g. `ai-studio/import`), never `main`.
2. Verify `main` is still `b68dbde`: `git rev-parse origin/main`.
3. `git diff --stat main...ai-studio/import` and `git merge-base` to see how old its base is.
4. Audit per area (below); port additive content as data records (`data/*.ts`) on a fresh branch off `main`, not by merging wholesale.
5. `pnpm typecheck` + `pnpm test` in `artifacts/survivor-616` after each area.

## Audit checklist (fill in once the branch exists)
| Area | In AI Studio only | In main only | Conflict / decision |
|---|---|---|---|
| characters / enemies / areas | | | |
| weapons / evolutions / relics | | | |
| shops (Quartermaster etc.) | | | |
| chests / drops | | | |
| TCG / arena / foils | | | |
| UI / animations | | | |
| engine (`world.ts`) | | | |
| metaStore / save compat (`survivor616.meta.v1`) | | | |
| Known bugs / TODO | | | |

## Feature backlog from the requested prompt
- Chest and drop types with unique systems and special contents.
- Quartermaster and other shops: special/legendary weapons, weapon-combo evolutions.
- Relics: craftable, with real earnable rewards (not flavor text).
- Better animations / UI polish everywhere.
- Light-source tiers (earnable; % world visibility, radius around player, enemy glow); fireflies that emit light.
- Firefly extreme dark map: Firefly Miners, Evokers, Spikers (underground sequential pulses, 9-pulse reach, higher tiers farther), Firefly Cannon (screen flash, scatter), dual-cannon Red Firefly tier (fire damage); Bag of Water (Quartermaster, extinguishes).
- TCG and arena upgrades; card foils: top tiers not purchasable, plus overlay customizations.
- Veteran system for enemies.

Note: avoid the word "signal" in all new content (see CLAUDE.md).

## Intake status (2026-10-04)
- User's AI Studio download lives at `C:\Users\glory\Downloads\loksurvivor 1.9` on their own machine — not reachable from this cloud session. Needs to be uploaded (zip) or pushed to a branch.
- Versioning rule recorded in CLAUDE.md (patch bumps for minor/hotfix, middle rolls at 10).

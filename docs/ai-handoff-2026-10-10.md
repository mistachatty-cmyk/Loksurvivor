# AI handoff: run events, crew call-ins, controls and the painted hideout (v0.23.1 to v0.23.8)

Written for any AI (ChatGPT, Gemini, Replit Agent, Claude) picking this repo up cold. It says what changed on 2026-10-09/10, why, where the code is, how to check it, and what is left. Read `CLAUDE.md`, `AGENTS.md` and `.agents/memory/MEMORY.md` as well; this file does not replace them. The earlier handoff is `docs/ai-handoff-2026-10-04.md`.

The game is **616 Survivor** at `artifacts/survivor-616/`. The design plan behind this work is `docs/EVENTS_AND_INTERACTIONS_PLAN.md`.

## Hard rules that apply to all new work

- Follow the naming rule in `CLAUDE.md` (one word is banned everywhere; use `beacon`, `pulse`, `relay`, `static`, `frequency`).
- Every update bumps `CHANGELOG` in `src/game/data/changelog.ts`; never reuse a version, and `publishedAt` must match `date` and never go backwards (`changelog.test.ts`). After editing it run `pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json` from `artifacts/survivor-616/`.
- New player text goes in `src/locales/en.json` only; the Auto-translate action fills the other languages after a push (it pushes a commit to the branch, so `git pull` before your next push).
- Run `pnpm typecheck` and `pnpm test` from `artifacts/survivor-616/` after every change.
- Content is data-driven. Add records under `src/game/data/`; do not edit the simulation loop beyond the one hook per kind of thing that already exists.

## What shipped, in order

| Version | What | Where |
|---|---|---|
| 0.23.1 | **Painted hideout strip**: per-room canvas backdrops, light pool, dust, footstep puffs; ambience gets a slow music-box melody. | `src/ui/hideoutScenery.ts`, `HideoutPreview.tsx`, `game/audio/ambience.ts` |
| 0.23.2 | **Event Director**: seeded run beats unlocked by maps cleared. First two beats: Supply drop, Rush-hour stampede. Achievements `moment-*`. | `game/data/runEvents.ts`, `updateRunEvents` in `engine/world.ts`, `drawRunEventMarker` in `render/draw.ts` |
| 0.23.3 | Settings switches for each event; **Magnet coil** pickup. | `game/state/runEventSetting.ts`, `SettingsPanel.tsx` |
| 0.23.4 | **Tremor** beat (shoves, never damages). | `tremorPulse` in `engine/world.ts` |
| 0.23.5 | **PC dash** (Shift, on-screen button, double-click) and a **Controls** tab in Settings: rebindable keys, controller (stick, d-pad, remapping, deadzone), touch switches. | `game/input/controls.ts`, `ui/ControlsSettings.tsx`, `ui/SettingsPager.tsx`, `RunScreen.tsx` |
| 0.23.6 | **Crew call-ins**: next rescued ally in rotation, shared 30s cooldown, effects reuse existing mechanics. Achievements `crew-callin-*`. | `game/data/crewCallIns.ts`, `callInCrew` in `engine/world.ts` |
| 0.23.7 | **Block party** beat. | `updateRunEvents` |
| 0.23.8 | **Blackout** and **Relay storm** beats, plus five hideout choice events. | `data/runEvents.ts`, `data/choiceEvents.ts`, `drawBlackout` in `render/draw.ts` |

Versions were renumbered from 0.22.4-0.23.1 to 0.23.1-0.23.8 when this branch was merged with `main`, which had shipped its own 0.22.4-0.23.0 (Light Spurs, soundbar, ambient visitors and others). The code and notes use the new numbers.

## Decisions and why

- **Events unlock by maps cleared**, not by time: supply drop 2, stampede 4, tremor 6, block party 8, blackout 10, relay storm 12. A run gets 0 beats before 2 maps, then one more per 3 maps, up to 4. This keeps early runs calm.
- **Beats are seeded** from the run seed with `quirkHash`, never `w.rng`, so replays and tests are stable. Payouts happen once, at the end of the active window; dying or pausing mid-beat pays nothing.
- **No new reward path.** Beats pay through ordinary pickups and `damageEnemy`. The Tremor deals no damage on purpose so it can never create kills, XP or loot (`.agents/memory/impact-physics.md`).
- **Call-ins cost no slot.** One shared cooldown and a rotation keep the system hands-off; the plan's open question was settled this way and can be revisited.
- **WASD and arrow keys are not rebindable** so nobody can lock themselves out of walking. A saved controls file with clashes falls back per field (`normalizeControls`), and a missing action takes a spare key instead of resetting everyone's bindings.
- Detailed notes: `.agents/memory/run-events-director.md`, `controls-and-dash.md`, `crew-call-ins.md`, `hideout-scenery-and-melody.md`.

## How to check it

From `artifacts/survivor-616/`: `pnpm typecheck && pnpm test` (about 940 tests). Tests for the beats are `src/game/engine/runEvents.test.ts`; controls are `src/game/input/controls.test.ts`. There is no automated visual test. To play a beat quickly in dev, give `createWorld` the setup `runEvents: { mapsCleared: 12 }` or edit `w.runEvents.schedule` in a test; real runs read `mapsCleared(meta).have`.

Known flaky test (not caused by this work): `quickFight.test.ts` "a fainted lead sends in a teammate and the fight goes on until the whole team is down" failed in about 1 of 8 runs on a clean checkout and sometimes in the full suite. A task card to make it deterministic was queued.

## What has not been done (and was never seen on screen)

- **No playtest or screenshot of any beat.** Balance numbers are guesses: stalker counts, relay slow (60%), payouts, cooldowns.
- Blackout's darkness, the stampede lane and the block-party ring were written from reading the renderer, not from looking at them. Check them at phone and desktop widths.
- Controller support is unit-tested only; no real controller was used.
- Left-handed touch layout, stick size, mouse-button rebinding, call-in upgrades and ally bonds are not built.
- From the plan, still open: hit-stop tiers and combo music layers, hideout crew schedules and bonds, a cosmetic physics toy in the hideout, static-layer caching for the painted hideout backdrops (a performance follow-up), a separate toggle for the room melody.

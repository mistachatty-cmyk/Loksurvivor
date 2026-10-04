# AI handoff: AI Studio 1.9 merge and fight styles (v0.10.1 to v0.10.7)

Written for any AI (ChatGPT, Gemini, Replit Agent, Claude) picking this repo up cold. It says what changed on 2026-10-04, why, where the code is, how to check it, and what is left. Read `CLAUDE.md`, `AGENTS.md` and `.agents/memory/MEMORY.md` as well; this file does not replace them.

The game is **616 Survivor** at `artifacts/survivor-616/` (React, Vite, TypeScript, Canvas2D engine). Everything below is on `main`.

## Hard rules that apply to all new work

- Follow the naming rule in `CLAUDE.md`: one specific word is banned from all new copy, ids, CSS classes, test ids, comments and docs (the word is spelled out in `CLAUDE.md`, not repeated here). Use `beacon`, `pulse`, `relay`, `static` or `frequency` instead.
- Every update bumps `CHANGELOG` in `src/game/data/changelog.ts` (last number for minor updates and hotfixes, middle number after 9). Never reuse a version. The last entry is `CURRENT_VERSION` (now `0.10.7`).
- Content is data-driven: add records under `src/game/data/`, do not edit the simulation loop.
- Do not lose original versions of features. The owner asked explicitly: when adding a new look or mode, keep the original as an option.
- Run `pnpm typecheck` and `pnpm test` from `artifacts/survivor-616/` after every change. A new `*.test.ts` file is picked up automatically.

## What happened, in order

| Version | PR / commit | What |
|---|---|---|
| 0.10.1 | `e177eb8` | Google AI Studio build "loksurvivor 1.9" merged into main. Main-only content was kept. |
| 0.10.2 | PR #185 | **Card Style picker**: Classic (main's original `lok-collection-card` look, the default), New (the AI Studio look), Dynamic 3D. |
| 0.10.3 | PR #185 | Soundtrack starts on the first tap or key press (browser autoplay rules block it on load). Konami-code firefly easter egg and six new splash lines. |
| 0.10.4 | PR #185 | **Always animate** override for devices that report reduced motion (this froze the title live feed, hideout rain and walking operative). |
| 0.10.5 | PR #185 | Studio 28 weapon filters (type, status, search, bulk activate/ban). Old e2e failures fixed or parked. `GameLoop.ts` removed (unused). |
| 0.10.6 | PR #186 | Arena move buttons say Strong / Normal / Weak / Support; status chips show good vs bad and turns left. First quick fight. |
| 0.10.7 | PR #187 | **Travel fight styles**: Classic, Quick, Duo, Arena (details below). |

Backups that must never be pushed to: `backup/main-pre-ai-studio-2026-10-04` (`b68dbde`) and `backup/main-before-ai-studio-merge-8fe971a` (`8fe971a`).

## Decisions and why

- **Classic card look is the default.** The owner likes main's original borders on Lok Card Shop cards. `CardViewMode = 'classic' | 'new' | 'dynamic'` lives in `src/ui/LokDeckCardView.tsx`; `CardStyleToggle` is shared by the card shop and the collection.
- **Reduced motion.** The override is device-local: `survivor616.motion` (`system` or `full`), mirrored onto `<html data-motion>`. CSS reduced-motion blocks are written `:root:not([data-motion='full'])`. Code reads it through `prefersReducedMotion()` in `src/anim/motion.ts`, never `matchMedia` directly.
- **Music.** `src/game/audio/musicPlayer.tsx` has `autoStart` (key `survivor616.music.autostart`, default on) and a click/keydown listener that starts track 0 only if audio is paused and `currentTime === 0`. Touch pointerdown does not count as a user activation; a completed click does.
- **Fight styles keep the original.** The classic popup (`TravelEncounterOverlay`) is unchanged and still the default. See `.agents/memory/fight-styles.md` for the full contract.

## Travel fight styles (the newest work)

Chosen per device in Settings, stored as `survivor616.fightstyle` (`classic`, `quick`, `duo`, `arena`). An older on/off key `survivor616.quickfight = 'on'` is still read as `quick`. The style is read once when an encounter starts, so changing it never swaps a fight mid-round.

| Style | What it is |
|---|---|
| Classic | Original card-throw popup. Default. |
| Quick | Lead LokPet on the arena engine, three moves, no finishers, 8-round cap, the opponent's next move shown before you choose. |
| Duo | As Quick, plus the operator stands beside the LokPet (third actor in `HideoutVignette`). Each round pick a LokPet move and an operator assist: punch, a Battle Deck card (burns a copy unless the Handheld DigiScope is owned), or a once-per-fight cover. The operator is never targeted. |
| Arena | Depth `deep`: every move including finishers, trinkets, a free once-per-fight Cheer, 20-round cap, stat panels either side and a running log on wide screens. |

Layout adapts at 640px: phones get one stacked column, wider screens get the side-by-side layout. Any new style must keep both.

Rewards, catch chance and flee are identical across styles through `buildTravelEncounterResultFromOutcome` in `src/game/travelEncounter.ts`.

### Where the code is (all under `artifacts/survivor-616/src/`)

- `game/engine/quickFight.ts`: pure state machine (`createQuickFight`, `stepQuickFight`, `cheerQuickFight`, `QUICK_TURN_CAP`, `DEEP_TURN_CAP`, `ASSIST_SCALE`). No React, no storage; `stepQuickFight` never mutates its input.
- `game/engine/battleClarity.ts`: `moveMatchup`, `statusChips`, `describeIntent`. Shared by the arena screen and the fights.
- `game/engine/lokPetBattle.ts`: `chooseEnemyMove` was split out of `executeEnemyAi` so the telegraphed move is exactly the one played.
- `game/state/fightStyleSetting.ts`: the setting and its legacy-key fallback.
- `ui/EncounterFightOverlay.tsx`: one overlay for quick, duo and arena. It also exports `MATCHUP_STYLE`.
- `ui/HideoutVignette.tsx`: optional `support` actor and `'support'` gesture side.
- `ui/SettingsPanel.tsx` (`FightStyleSetting`), `App.tsx` (picks the overlay), `ui/LokPetBattleScreen.tsx` (matchup labels, status chips).
- Tests: `game/quickFight.test.ts` (22 cases), `e2e/quick-fight.spec.ts` (8 cases).

### Behaviors that look like bugs but are deliberate

- If the opponent is faster, it gets a free opening move. That move is dropped if it would end the fight, so nobody loses before acting.
- At the round cap the fight is judged on remaining HP share; a tie goes to the player.
- Operator assist damage is multiplied by `ASSIST_SCALE` (3.5) because the classic numbers were tuned for a 50 HP scrap and LokPets here have a few hundred HP.
- `executeMove` in `lokPetBattle.ts` mutates the pets it is given. The quick fight clones with `structuredClone` first; do the same if you call it.
- Burn, shock and glitch damage at end of turn can take a pet to 0 HP without marking it fainted in the arena engine. The quick fight handles that in `settle()`; the arena screen was not changed.

## How to verify

From `artifacts/survivor-616/`:

```
pnpm typecheck
pnpm test                       # 431 tests at v0.10.7
pnpm exec playwright test       # 35 pass, 1 test.fixme (dev-tool HUD stress test)
```

- The sandbox may lack Playwright's bundled browser. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium` (see `.agents/memory/browser-regression-tests.md`).
- e2e meta seeds must include `version: 5` or the saved meta is discarded.
- To force a travel encounter in a test, set `Math.random = () => 0` for one room change and restore it as soon as the overlay appears (see `e2e/quick-fight.spec.ts`).
- Use `pnpm exec playwright test`, not `npx playwright`.
- Not verified: the test browser cannot decode `.m4a`, so audible music playback was only checked as far as the start call. Check on a real device.

## Operator Forge (v0.10.8) and End game extras (v0.10.9)

The owner said operators were too simple and samey, but explicitly did **not** want existing operators changed ("nothing replaced but expanded", "don't want this to be retroactive") and asked for deeply expanded design options, a generation option, and a customizer. So the Forge is purely additive: new operators only, appended after the 69 authored ones.

In 0.10.9 the owner said the new screen content was "a lot on screen", so everything from the Forge round became an **end-game unlock**, optional and toggleable:

- **Gate:** every standard map cleared once (`STANDARD_MAPS` in `data/endgameUnlocks.ts`: timed maps only, so no endless modes and no extreme 2x/4x versions). Before that, Settings shows no tab and no hint; after it, Settings has two pages, Standard and End game, with a slide animation (`ui/SettingsPager.tsx`, `ui/EndgameSettings.tsx`).
- **Switches (all off until the player turns them on):** Operator Forge, Zoom viewer (magnifier on roster tiles opening `OperatorInspector`), Faction races (the 21 faction-themed species in the Forge), Champion foil (shimmer on the selected tile), Glow aura (glow on every tile). Turning the Forge off hides custom operators from the roster (they stay saved); that one needs a reload.
- **Five custom slots:** the Forge holds only as many operators as earned slots. Each slot has its own goal: Full Circuit (the gate itself), Crowd Control (20,000 kills), Roll Call (15 allies rescued), Field Notes (18 discoveries), Beast Master (25 LokPet battle wins). A custom operator is a modified copy of an unlocked premade kit and never overrides a premade operator. Tune the goals in `CUSTOM_SLOTS`.
- **Persistence:** earned unlocks are sticky and live in the forge store (`survivor616.forge.v1`: `earned`, `toggles`). `MetaProvider` records new unlocks from the save and announces them once. A Forge found by the old five-tap reveal (0.10.8) stays available and switched on; the tap reveal is gone.
- Design: 9 builds with height and width sliders, 9 palette schemes plus 22 skin tones, 31 species (10 core, 21 faction races), 7 wardrobe styles, 202 features in 15 categories, each with its own color.
- Generate: seeded, so a seed is a shareable recipe; also fill-the-free-slots generation, per-category rerolls and share codes.
- Kit: a forged operator borrows stats, weapon and ultimate from an unlocked authored operator. `llama-mama`, `llama-overlord`, `cluck-616` and legendary operators cannot be borrowed.
- Full design and how to add options: `artifacts/survivor-616/docs/operator-forge.md`. Decision record: `.agents/memory/operator-forge.md`.
- The retroactive approach (a global detailed-mode getter on every existing operator) was built first and deliberately thrown away. Do not reintroduce it.

## LokPet creature range

The owner wants hybrid, fantasy, fictional and sci-fi creatures as uncommon finds and easter eggs, some cute and some terrifying, alongside ordinary animals, and wants a few more added every once in a while. In 0.10.9 they asked for the cute/dread idea to be deeply expanded, more thematic, an eventually infinite roster, user-imported art, and rarity as both findability and tier (like ordinary vs legendary creatures). The brief and its answers are in `artifacts/survivor-616/docs/lokpet-creature-design.md`; the data and seeded generator are in `src/game/data/creatureTraits.ts` (51 axes, 46 quirks, 22 themes, 48 body plans, 7 findability levels, 6 tiers). It is not wired into battles or chests yet, and no creatures have been added; that waits on the body-plan recipes (roadmap item 1). The user-art import is designed, not built.

## Deployment

Vercel project `survivor-616`; `main` auto-deploys to production. The Vercel status on a PR commit turns `success` when the preview build finishes. GitHub's GraphQL API is blocked in some agent sessions; the REST API (`gh api repos/...`) works.

## What is not done (the roadmap)

The owner's goal is a collect-and-battle loop (Palworld / Pokémon style) with 200 unique LokPets. Fight clarity and fight styles are done. Remaining, in suggested order:

1. **LokPet body-plan recipes**: data recipes plus lazily cached images, so more animals (dog, cat, bird, fish, reptile, insect...) without runtime growth. Today there are 78 variants on about 41 silhouettes.
2. **Seeded variants and card tie-in**: pattern layers, fighting-style tags, variants becoming their own cards.
3. **Operator design range**: DONE as the additive Operator Forge (v0.10.8), now an end-game unlock with five custom slots (v0.10.9), see above. More features, species and builds can be added as data entries.
4. **Living hideout strip**: pet follower, visitors, tap-to-fight events using the new fight styles.
5. **City exploration loop**: wander, find items, LokPets, allies and events, fight data mites and enemies.
6. **Expansion packs** up to 200 LokPets.

Open questions for the owner: which animals first, and whether Duo or Arena should become the default for new players. (Operator customization is answered: it is additive and goes as far as bodies, species, palettes and outfits, and existing operators are never changed.)

Still needing a check on real devices: music starting on first tap, hideout animations with the override, Firefly Hollows Extreme balance, light tiers, veterans, and Classic card foil-frame parity with the new look.

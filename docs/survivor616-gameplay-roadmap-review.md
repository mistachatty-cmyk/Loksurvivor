# Survivor616: chat review and next roadmap

Reviewed 2026-10-13 against `main` at `0e28ee7` and the current working tree. This document consolidates the requests, implementation notes, acceptance criteria, and follow-up ideas from this chat. It distinguishes shipped work from local work and from recommendations; a suggestion here is not a claim that the feature exists.

## Current state

- The integrated branch has the earlier Operator Forge, hideout-dock work, and the broad gameplay/DIGI-Tower merge (`3db63b1` and `0e28ee7`). `main` and `origin/main` were aligned at the review start.
- This review found the Training Bay implementation in the working tree after the user's “Training bay next” request. It is implemented locally, typechecked, and documented, but is not yet committed or pushed to `origin/main`.
- The latest code check was `pnpm typecheck` (passed). No end-to-end or manual gameplay review was recorded in this pass, so the acceptance routes below remain outstanding even where the code is present.

## What this chat has delivered

### Character creator, operators and enemies

- Added creator-authored operators with distinctive silhouettes, palettes, signatures, and lore, including **LokPet Master / Bondkeeper 616**. The roster additions include Vitrail, Cinder Kiln, Threadwake, Quarry Choir, Comet Courier, Railwarden and Nightline Runner.
- Added the **Kennel Marshal**, a custom-rig elite grappler tied to the Kennel Patrol and introduced into the late street encounter roster.
- Preserved the existing roster and built additions alongside it. Avoid duplicating these kits when adding more operators or enemies.

### Hideout, controls and companion scene

- Put hideout controls into a top dock, with Mission Briefing and Looks & LokPets available as controls. The saved cage scene is the default and shows the player's actual operator, selected LokPets and rescued crew; Old block is a selectable fallback.
- Added animated crew/pet responses, hideout chat-bubble visibility control, and cosmetic “Call for help” / “Encourage crew” commands.
- **Still needs a focused regression check:** the user reported that Mission Briefing can cover endgame and that briefing/looks controls appear to float instead of staying in the top bar. Existing dock work is in place, but a fresh full playthrough through endgame has not established that this is fixed in every route. See “Immediate fix and verify” below.

### Combat presentation and run setup

- Made breakable-prop damage a standing **major priority**. Implemented deterministic, cumulative, material-aware crack stages, impact-position response, break fade, debris/rubble aftermath, reduced-motion behavior and graphics-quality particle limits. Core health, collision and reward rules remain in the simulation.
- Added a recommended next map, a compact Run Setup briefing for operator/team/map/controls/modifiers/contracts, and first-clear LokPet field specimens in the run report and Bestiary.
- Clarified that online Arena is presently a **shared-enemy kill race**. Added connection feedback, retry after disconnect and tie handling. Online results remain reward-free where clients cannot authoritatively validate the outcome.

### DIGI-Tower and Training Bay

- Built a finite 100-floor campaign over ten sectors, with authored trials, faction floors, mirror encounters, Masters, sector rules, persistent party condition/checkpoints, wipe recovery, safe practice replays and a first Tower-token exchange.
- Added the Training Bay on every active, unclaimed Rest floor. Points come from pet levels (one per level gained, with a second point at evolution thresholds); the starter has a higher rank cap. Vigor, Fury, Guard, Pace and Spirit affect real saved-pet battle stats. Training Data comes from first-clear floors and rest choices; a respec costs 25.
- Training Bay code, public patch notes, the broad design plan and durable memory are currently **local working-tree changes**. It has passed `pnpm typecheck`; it has not been merged/pushed since the prior Tower merge.

## Open issues and incomplete loops

### P0 — Mission Briefing and endgame obstruction

Reproduce the reported route from a normal run through mission briefing, run clear/death, summary, and endgame. Controls should live in the top dock and open compact, dismissible content on demand. A mission or looks panel must never sit over a required endgame action or intercept its input. Test keyboard, pointer, Escape/back, small viewport, and re-entry after returning to the hideout. If the current dock is already correct, fix the specific overlay stacking/route state instead of moving unrelated controls.

### P1 — Real online player-versus-player

Online Arena is not PvP. A distinct mode still needs:

- Player combat rules: player health, legal targets, attack cadence, knockouts, respawns (if any), scoring, round timer, tie and simultaneous-knockout rules.
- Lobby ready-up, visible seat/presence state, host departure/forfeit behavior, reconnect-or-clear-forfeit behavior, deterministic cleanup, and late-join policy.
- Trusted outcome validation. Current clients simulate locally and relay inputs/counters, which permits drift and cannot secure rank or rewards. Keep rewards/ranking off until the authority model is real.
- Multi-client checks for lag, duplicate/out-of-order/lost messages, simultaneous knockouts, host loss, reconnect, ties and forged result payloads.

### P1 — First-session path and return route

The game has many modes and unlocks. Walk a brand-new save from operator selection to the first run, first objective, death/clear, report, and return to the hideout. Add an optional, short tutorial or contextual prompts only where a player otherwise has to guess. Keep the briefing on demand and avoid adding another blocking introductory modal.

### P1 — Field specimen to LokPet collection

Current specimens are deterministic research traces in a report/archive, not companions. The loop stops before encounter provenance, scan/capture choice, duplicate keep/release/compare, save identity, sprite/rig generation, bounded battle stats, and use in the selected party. Finish this as one opt-in collection path with a clear archive record; never silently replace a pet or let flavor traits change combat stats without a separately balanced rule.

### P2 — DIGI-Tower follow-through

The core climb and rest-floor training exist. Useful additions, in order of distinct value:

1. A daily seeded challenge with a fixed floor/modifier/reward seed and a personal best, without requiring a server.
2. Vault choice floors with three transparent, earned options and no paid power.
3. Sector transitions, Master pre-fight/post-fight dialogue, and a clean campaign recap that remembers which sector story the player reached.
4. Evolution Cores and branch unlocks with clear source/reward/cost; pet-specific Companion Trials once each can use a distinct mechanic.
5. Tower Token cosmetics, props, titles and operator/pet presentation items; keep token purchases cosmetic so the finite campaign is not pay-to-win.
6. Endless Spire and Operator/LokPet Duo floors after the base campaign is tuned. Keep them distinct from the first 100-floor pet-only campaign.

### P2 — Existing systems that can stop at the menu

- **Operator Forge:** the creator can build and save a character, but continue to audit the path from saved design → roster visibility → unlock/use-in-runs setting → run → save import/export. New operator content should add a different combat role and a readable signature, not just another palette.
- **Mission/contract rewards:** show a clear end-of-run result for each optional contract and give the player a useful next goal. Check that daily jobs, achievements, mastery, pet bonds and endgame unlocks do not all compete as disconnected notification lists.
- **Sector Command:** selection, prerequisites, mission launch, objectives, debrief and persistence exist. Mobile/touch input and objective/reward clarity still need a phone pass; only then decide whether Production tier or scripted skirmish adds a real new loop.
- **Pet traits and battle:** the broad trait/personality system remains only partly connected. Add discovery provenance and useful archive comparisons before growing the catalog. Avoid adding species faster than players can find, understand, save and field them.

## Further ideas, after the open loops

- **Destruction depth:** author a small set of silhouettes for the most common breakable materials; vary splinter/shard direction from the impact vector; pair heavy breaks with restrained material-specific audio; let rubble remain legible without becoming a collision/reward exploit. The implemented shared procedural system is the base, and object cracking/destruction remains a major priority.
- **Operator roles:** use creator presets as starting points for a few grounded roles (protector, scout, controller, companion handler). Tie each to a signature action and a short unlock story. Keep the forged roster additive and ensure every design can be selected, saved, exported and used.
- **Enemy creator pipeline:** promote well-authored creator concepts into reusable enemy/faction templates with a combat behavior, tell, counterplay, palette, silhouette and lore. Give each new enemy a place in at least one encounter rather than growing an isolated catalog.
- **Hideout use:** preserve the cage as the social hub, then add optional crew/pet group poses and lightweight scene moments. Keep callouts cosmetic, allow bubbles off, and provide a quiet alternative where important guidance is needed.
- **Progression direction:** one “recommended next” goal could combine map unlocks, Tower progress, pet growth, and jobs, with a visible reason and reward. Let players dismiss or turn it off.
- **Accessibility/quality:** review phone layout, reduced motion/flashes, low graphics quality, long localized text, keyboard/controller navigation, and crowded combat before widening content.

## Recommended next order

1. Reproduce and fix the Mission Briefing/endgame obstruction, then record a short acceptance route.
2. Integrate the already typechecked Training Bay change; the contradictory Tower/pet-growth notes have now been reconciled in this working tree.
3. Complete one fresh-save desktop and phone walkthrough, including cage/Old block and chat controls.
4. Write an authoritative online PvP design and transport/result trust boundary before adding combat networking.
5. Finish the specimen-to-collection path and add the next Tower mode only after its reward loop is visible end to end.

## Cross-check list

- [ ] Mission/Looks stay in the top dock; endgame and Run Summary remain actionable on every exit path.
- [ ] Cage is the saved default; Old block, actual operator/pets/crew, animated callouts, bubble toggle and two commands all survive reload and remain readable on phone.
- [ ] Destruction is visually distinct by material and hit direction, bounded in crowds, reduced-motion aware and simulation-neutral.
- [ ] A fresh save can understand and complete the first objective without a mandatory lore wall.
- [ ] Creator operator and enemy have discoverable roster/encounter placement and a reliable save/use path.
- [ ] Specimen and pet progression can be traced from discovery through archive to use.
- [ ] Tower training point/cap/respec rules are clear and preserved by save migration; first clears, checkpoints, retry and practice remain correct.
- [ ] Online kill-race and future PvP are labeled and tested as different modes; untrusted results never grant rank or rewards.
- [ ] Update changelog, public update feed, canonical roadmap and `.agents/memory/` notes together when status changes.

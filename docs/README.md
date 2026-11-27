# 616 Survivor docs: start here

Everything written down about the game, grouped by what you are trying to do. The list of every asset is first.

## Assets and art
- [**ASSETS.md**](./ASSETS.md): full catalog of every character, enemy, ally, area, weapon, pet, icon, sound cue, track and picture, plus the code that draws each. Generated from the game; never edit by hand.
- [LOK_DESIGN_STANDARD.md](./LOK_DESIGN_STANDARD.md): the art, feedback and parity rules (no emoji, no stock icons, original art only).
- [DAMAGE_NUMBERS.md](./DAMAGE_NUMBERS.md): how hit numbers look and behave.
- Rescue cage and dungeon doors: [ASSETS.md objective art](./ASSETS.md#objective-and-world-art-rescue-cage-dungeon-doors-chest). Notes on why: `.agents/memory/rescue-cage.md`.

## Design and plans
- [LOK_PARTY.md](./LOK_PARTY.md): Lok Party Slice 1 (juice engine, party progression, The Lok Drop), the blueprint gaps that were filled, and the next slices.
- [LOK_PARTY_NEXT.md](./LOK_PARTY_NEXT.md): everything Lok Party still needs, sized and ordered.
- [FAITH_MODE.md](./FAITH_MODE.md): optional Faith Mode (verse bar, bouncing Bible, Bible reader), ported from Queens N Kings.
- [616_BACKGROUND_OPTIONS_PLAN.md](./616_BACKGROUND_OPTIONS_PLAN.md): plan for selectable interactive backgrounds (mockups first).
- [Lok Party visuals](art-library/lok-party/README.md): vault mockups and minigame screenshots, with how each was made.
- [**UNIFIED_ROOMS_PLAN.md**](./UNIFIED_ROOMS_PLAN.md): how 616 menus become a room and how the 616, Queens N Kings and Lok rooms and halls become one universe.
- Lore, including why survivors are held (digitization relays): `artifacts/survivor-616/docs/LORE.md`.
- [survivor616-gameplay-roadmap-review.md](./survivor616-gameplay-roadmap-review.md): where the game is going next.
- [EVENTS_AND_INTERACTIONS_PLAN.md](./EVENTS_AND_INTERACTIONS_PLAN.md), [experimental-maps-and-directors.md](./experimental-maps-and-directors.md), [survivor616-map-builder-breach.md](./survivor616-map-builder-breach.md), [endless-block-supplies-2026-10-04.md](./endless-block-supplies-2026-10-04.md)
- [endgame-armory-weapons.md](./endgame-armory-weapons.md)
- [lokpet-rpg-and-digi-tower-plan.md](./lokpet-rpg-and-digi-tower-plan.md), [hideout-rewards-lokshop-lokpet-plan-2026-10-08.md](./hideout-rewards-lokshop-lokpet-plan-2026-10-08.md)
- [training-arena-handoff-2026-10-13.md](./training-arena-handoff-2026-10-13.md), [training-arena-next-pass-spec-2026-10-13.md](./training-arena-next-pass-spec-2026-10-13.md)

## Online, friends and music
- [LOK_FRIENDS.md](./LOK_FRIENDS.md), [lokserver-knowledge.md](./lokserver-knowledge.md), [CREW_CHATTER.md](./CREW_CHATTER.md)
- [jukebox-spec.md](./jukebox-spec.md), [shared-music-2026-10-27.md](./shared-music-2026-10-27.md), [arcade-card-2026-10-27.md](./arcade-card-2026-10-27.md)

## Working rules and handoffs
- [LOK_COST_DISCIPLINE.md](./LOK_COST_DISCIPLINE.md): keep data and AI cost minimal.
- [PULLCHECK.md](./PULLCHECK.md): pull request triage.
- [vercel-deploy.md](./vercel-deploy.md): deploying.
- Handoffs: [ai-handoff-2026-10-04.md](./ai-handoff-2026-10-04.md), [ai-handoff-2026-10-10.md](./ai-handoff-2026-10-10.md), [ai-studio-merge-plan.md](./ai-studio-merge-plan.md)

## Also in the repo
- Lore and character notes: `artifacts/survivor-616/docs/` (LORE.md, character-reference-guide.md and more).
- Durable decisions and the reasons behind them: `.agents/memory/` (start at MEMORY.md).
- Project rules for every AI: `CLAUDE.md` at the repo root.

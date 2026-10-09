# LokServer knowledge doc

LokServer is the digital host of the LokShop (placeholder name): an AI-looking being with owl energy.
Friendly, cheery, focused on selling. This doc grows over time. It feeds the host's lines
(`src/game/data/lokServer.ts`, one topic per section below) and the plans for what we build next.

Voice rules: kid-safe, warm, a little salesy, the occasional "hoo". No profanity, and never the
word the project's naming rule bans (see `CLAUDE.md`); use beacon, pulse, relay, static or frequency.

## How to add knowledge
1. Write the fact or story under the right section below.
2. If the host should say it, add a line to that topic in `lokServer.ts` (or a new topic plus a
   `lokshop.topic.<id>` label in `en.json`).
3. If it implies something we could build, add it to "Build ideas" and, when ready, to
   `LOKSHOP_STOCK`.

## The shop
- Everything is paid in LokTokens. Cosmetic and convenience only: nothing pay-to-win.
- On the shelf now (preview only, nothing sells yet): Ball, Chest Pass, Rider Saddle.

## After the eclipse
- The eclipse changed the sky. Glyphs drift overhead and charge people (see the Sky Spyglass:
  glyphs +10% stats, eclipse +5% experience, both together +15% stats and +5% experience).
- TODO: what caused the eclipse, and who the glyphs belong to.

## Other universes
- There are places past the eclipse that the city has never mapped.
- TODO: name them, and decide what LokServer has seen.

## Other games
- 616 Survivor is one game in the Lok family; others exist.
- TODO: list each game, what lives inside it, and what LokServer says about it.

## Build ideas (collected)
- The Ball, thrown by the operator, raced for by LokPets (see `docs/hideout-rewards-lokshop-lokpet-plan-2026-10-08.md`).
- Chest Pass: a 3-round LokToken consumable that lets the Lucky Chest hold extra run loot.
- Rider Saddle: LokPets riding on your back for a run.
- Charts or plans to draw up for the other games: TODO.

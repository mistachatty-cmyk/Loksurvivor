# Lok Party: what is still needed

Checked 2026-11-26 (v0.42.96) against the blueprint Google Doc "GSix / Lok Party Mode: Cross-Game Mario Party Mechanics & Minigame Blueprint". Build notes for what exists: [LOK_PARTY.md](./LOK_PARTY.md). Section numbers (s2, s5) point into the blueprint.

Size: **S** a few hours, **M** a session, **L** several sessions. **Look** means it needs new art or a new screen, so show the owner visuals before building.

## Owner rule for minigames (2026-11-27)

Party games like Mario Party, never filler: every minigame is something you play, with each player's character visibly on screen moving or doing something, and a polished feel (juice, reactions, a podium). Creative formats such as drawing on faces are welcome.

## Built today

Turbo Crown Blitz on the Monroe Loop (5, 10 or 15 rounds, 4 characters, signature dice, 5 items, 2 bonus crowns), The Lok Drop, online rooms with bots, the hideout door, crew invites, the juice engine, the capsule pull, and the progression rules (mastery, two ladders, 50-tier pass, capsules, keys, shards, weekly missions).

## 1. Fix first: rewards that dead-end

The rules are written and tested, but the player cannot reach them.

| Gap | Today | Size |
| --- | --- | --- |
| No vault screen | Shards pile up. `forgeShard`, `disenchantShard` and `rerollShards` have no buttons, so no shard ever becomes a permanent unlock. | M, Look |
| Unlocks show nowhere outside the pull | `exportFlex` is not read by 616, so Party palettes, capes and hats cannot be worn in the main game. | M |
| Pass tiers give nothing before 50 | The tier number rises; only the bonus shards past tier 50 are paid. | M (needs a reward list from the owner) |
| Seasons never turn over | `startSplit` is never called, so the capsule-per-character reset and rank soft reset never happen. | S (needs a season length) |

## 2. Prove online on real devices

- Never tested against real Supabase or on a phone. Only unit tests and two browser tabs over a stand-in relay. **Do this before inviting anyone.** (S, needs a deploy)
- Someone who switches apps now gets 90 seconds and the others see a note (v0.42.94). Past that, a guest becomes a bot and a host ends the party. There is no host hand-over. (M)
- Two game windows visible side by side can show a false "Lok caught a crash" card (`src/lib/lokCrash.ts`). Switching tabs does not, because a hidden tab clears its marker. Minor, not specific to Lok Party. (S)
- Online results are unranked on purpose. The Online Crew ladder stays unfed until a server can verify results. (L, backend)

## 3. Board game depth (s3)

| Gap | Size |
| --- | --- |
| Duel spaces, and duels on shared tiles in Overtime | M (needs a 1v1 minigame) |
| Crewmate roving allies (double actions, stealable) | M, Look |
| Items: Triple Dice and Warp Pipe; board-only items such as Floodgate Key | S each, Look (icons) |
| Overtime Golden Crown worth 2 | S, Look |
| Item shop and toll gates (items only come from supply drops today) | M, Look |
| Origin perks and a LokPet companion slot (s2) | M |
| Supply wheel with a LokPet ally; Hack Terminal that can swap a Crown | S |
| Guaranteed capsule spin for every finisher, podium share card, party trophies | M, Look |
| Local pass-and-play and gamepad (s6) | M |

## 4. Minigames (s5), the biggest hole

Three exist and rotate on the board: The Lok Drop, Ring Run Rush (v0.42.95) and Roof Rumble (v0.42.96) and Roof Collapse (v0.42.97, a second rooftop arena). Rush, Rumble and Collapse can also be played alone from "Party games" on the menu (practice, no rewards). New games plug into the minigame kit (`minigameKit.ts` + `MinigameStage.tsx`): a rules file and an art file, and the shared entrance, controls, effects, HUD and podium come free.

1. Done in v0.42.96 as the minigame kit. Still to do: move Ring Run Rush and the Lok Drop onto `MinigameStage`, and an iframe/postMessage bridge for games hosted in other repos. (M)
2. More rooftop arenas (square, tile drop, tilting deck, conveyor, bridge, storm): plan in LOK_PARTY.md, each S to M on the shared rules. (Look)
3. Gem Vacuum Frenzy. (M, Look)
4. Then: Kinetic Knockout, PongFall Panic, Pigeon Kick Climb, Lexicon Lightning; three 2v2; three 1v3; two 1v1. Formats picked by space color. (L)

All minigames must keep the seeded, score-attack shape so online stays cheap.

### Ideas to pick from (not in the blueprint)

- **Face Off:** doodle on your operative's face against the clock; it wears your art for the rest of the match, then everyone votes. Online needs the strokes shared. (M, Look)
- **Strike a Pose:** the leader flashes a pose and you drag your operative's arms and legs to match it. (M, Look)

## 5. Characters, boards, modes

- Roster: 4 characters, all from 616. The blueprint MVP asks for 2 from 616 and 2 from Queens N Kings; the full table (s8) has 11. Needs rigs from other repos through the party profile (s2). (L)
- Boards: Pawnford Castle Circuit, Shoey's Neon Arcade, The Thaw Floodwall, then The Astral Plane and the Grand GSix Crossroads. (L each, Look)
- Reference images 10 and 11 (vertical maps) were never in the Drive folder. (owner to upload)
- Modes: Micro-Gauntlet and Boss Rush with a betrayal. (L)

## 6. Other repos

- Queens N Kings: pay the 15 Gold grant waiting in the outbox, and add its Party Lounge door. (S, M)
- GSix hub: sync the new operators' LokDex art and lore (see CLAUDE.md "LOK universe" steps; not checked). (S)
- party.gsix.online as a standalone app, if wanted later. (M)

## Questions for the owner

1. Vault screen layout: A (shelf), B (list) or C (workbench)? Mockups sent 2026-11-27.
2. How long is a season (the blueprint says 8 to 12 weeks)?
3. What should pass tiers 1 to 50 give?
4. The blueprint Doc still uses the word CLAUDE.md bans for the keys and one swap item. Please rename them to Beacon Keys and Swap Relay there.

## Suggested order

Real-device test, vault screen, one more minigame, Duel spaces, then Pawnford.

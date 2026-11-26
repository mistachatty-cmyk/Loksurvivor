# Lok Party: what is still needed

Checked 2026-11-26 (v0.42.93) against the blueprint Google Doc "GSix / Lok Party Mode: Cross-Game Mario Party Mechanics & Minigame Blueprint". Build notes for what exists: [LOK_PARTY.md](./LOK_PARTY.md). Section numbers (s2, s5) point into the blueprint.

Size: **S** a few hours, **M** a session, **L** several sessions. **Look** means it needs new art or a new screen, so show the owner visuals before building.

## Built today

Turbo Crown Blitz on the Monroe Loop (5, 10 or 15 rounds, 4 characters, signature dice, 5 items, 2 bonus crowns), The Lok Drop, online rooms with bots, the hideout door, crew invites, the juice engine, the capsule pull, and the progression rules (mastery, two ladders, 50-tier pass, capsules, keys, shards, weekly missions).

## 1. Fix first: rewards that dead-end

The rules are written and tested, but the player cannot reach them.

| Gap | Today | Size |
| --- | --- | --- |
| No vault screen | Shards pile up. `forgeShard`, `disenchantShard` and `rerollShards` have no buttons, so no shard ever becomes a permanent unlock. | M, Look |
| Capsules only open on the results screen | Leave that screen and a saved capsule waits until the next match ends. | S |
| Unlocks show nowhere outside the pull | `exportFlex` is not read by 616, so Party palettes, capes and hats cannot be worn in the main game. | M |
| Weekly missions are invisible | They track and pay XP, but there is no list. Only "mission complete" appears. | S, Look |
| Pass tiers give nothing before 50 | The tier number rises; only the bonus shards past tier 50 are paid. | M (needs a reward list from the owner) |
| Seasons never turn over | `startSplit` is never called, so the capsule-per-character reset and rank soft reset never happen. | S (needs a season length) |

## 2. Prove online on real devices

- Never tested against real Supabase or on a phone. Only unit tests and two browser tabs over a stand-in relay. **Do this before inviting anyone.** (S, needs a deploy)
- A host who leaves the tab for more than 25 seconds ends the party for guests (for example, switching to Messages on iPhone). No host hand-over. (S for a longer grace and a "host is away" note; M for hand-over)
- Opening an invite link in a second tab while the game is already open shows a false "Lok caught a crash" card (`src/lib/lokCrash.ts`). Seen in browser testing, with two tabs sharing one save. Not specific to Lok Party. (S)
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

Only The Lok Drop exists, so every round plays the same minigame.

1. `LokMinigameCartridge` contract (`mount`, `getResults`, `unmount`) so new games plug in. (M)
2. Ring Run Rush, reusing the Ring Runs now in 616. (M, Look)
3. Gem Vacuum Frenzy. (M, Look)
4. Then: Kinetic Knockout, PongFall Panic, Pigeon Kick Climb, Lexicon Lightning; three 2v2; three 1v3; two 1v1. Formats picked by space color. (L)

All minigames must keep the seeded, score-attack shape so online stays cheap.

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

1. Which comes first: the vault screen, or a second minigame?
2. How long is a season (the blueprint says 8 to 12 weeks)?
3. What should pass tiers 1 to 50 give?
4. The blueprint Doc still uses the word CLAUDE.md bans for the keys and one swap item. Please rename them to Beacon Keys and Swap Relay there.

## Suggested order

Real-device test, vault screen, mission list, Ring Run Rush, Duel spaces, then Pawnford.

# Lok Party: build notes (Slice 1)

Source of truth for the design: the Google Doc "GSix / Lok Party Mode: Cross-Game Mario Party Mechanics & Minigame Blueprint" (sections 1 to 13) and the Drive folder "Lok Party Visual References". This file records what is built in this repo, the gaps the blueprint left open and how they were filled, and what comes next.

Play it: `?screen=lok-party` (works in every build; it writes only its own save key).

**Where it lives (decided 2026-11-26):** inside this repo for now, built so it can become its own game later. The four engine files (`juiceEngine.ts`, `lokPartyMeta.ts`, `lokDrop.ts`, `capsulePull.ts`) import nothing from the game; a test enforces it. Only the screens touch 616 (rigs, audio context, the capped bridge). Moving to its own repo later means copying `src/party/` and swapping those three host hooks.

## Built in Slice 1 (v0.42.88)

| Piece | File | What it does |
| --- | --- | --- |
| Juice engine | `artifacts/survivor-616/src/party/juiceEngine.ts` | Spring camera zoom punch (8 to 14 percent, peaks in about 4 frames), trauma shake, 45 to 75 ms hit-stop, Canvas2D refraction ring (annulus clip, 1.06x lens, 2 px cyan/magenta split, 180 ms), squash and stretch (land 1.25 x 0.78, launch 0.85 x 1.2), 100 ms input buffer, 80 ms coyote grace, beat bus and pentatonic pickup chimes on the app's one shared AudioContext. Reduced motion scales shake, zoom and rings to zero. |
| Progression | `artifacts/survivor-616/src/party/lokPartyMeta.ts` | Save key `lokparty.meta.v1`. Grades C to S+, Character Mastery (levels 1 to 10 then infinite, Marks of Mastery gates at 5, 7 and 10, signature stat milestones), Vault Capsules (S- or better, once per character per split), Beacon Keys (3 fragments make a key), shards with forge, disenchant and the 3-to-1 reroll into a guaranteed new unlock, two ranked LP ladders (Solo Blitz and Online Crew, Iron to 616 Apex), 50-tier Split Pass plus a bonus shard every 500 XP past tier 50, first win of the day, three seeded weekly missions, split soft reset, one-way bridge outbox. |
| The Lok Drop | `artifacts/survivor-616/src/party/lokDrop.ts` | Pure seeded 60 s simulation: falling Loot Capsules (mid-air crack bonus, rare Gold L capsules), Crumbler Boulders, dash knockback that spills loot, a moving Extraction Ring with a hold-to-bank timer, vault slam at 60 s, frenzy spawn rate from 40 s, greedy bots with a skill dial. |
| Screen | `artifacts/survivor-616/src/party/LokDropScreen.tsx` | Lobby (pick one of four rigs), 2.5D front-facing vault floor, cream and espresso HUD, floating touch stick plus DASH button (fires on pointerdown), keyboard, landscape and portrait layouts, results card, tap-to-crack capsule. |
| Bridge into 616 | `metaStore.tsx` action `claimLokPartyGrant` | Pays the daily Party grant through the hideout reward choke point (daily caps), idempotent by grant id. |
| Tests | `artifacts/survivor-616/src/party/lokParty.test.ts` | 24 cases: juice timings, every meta rule, a full four-bot match, determinism, dash spill, meta hand-off. |

## Gaps in the blueprint, and how they were filled

1. **Naming rule.** The blueprint names its key item and one swap item with the word CLAUDE.md bans. Shipped as **Beacon Keys**; the item should become **Swap Relay**. Please update the Google Doc so other AIs do not reintroduce it.
2. **The cross-game daily valve broke 616's cap.** The doc asks for +150 Cred, but the hideout pays at most 60 Cred a day and 15 per grant. The bridge now asks for 15 Cred and pays through that same choke point, so the cap always wins. Queens N Kings gets a matching 15 Gold grant in the outbox for its own path to pay.
3. **Accessibility was missing.** Gold capsules carry an L shape, the ring has rotating dashes, and lane colors repeat as text in the HUD, so nothing relies on color alone. Reduced motion is honored.
4. **Portrait phones.** The doc only specified 9:16 for the loot pull. The arena now crops and follows on portrait and reflows the HUD into a 2 x 2 block.
5. **Determinism.** The sim uses seeded hashes only, so the same seed replays exactly. This is what async online score-attack and ghosts need (blueprint section 6, phase 2).
6. **Online ranked needs trust.** The Online Crew ladder exists in the save, but nothing should feed it until results can be verified, the same rule 616's Arena follows.
7. **Bot tiers for Solo Blitz.** The doc says solo LP is earned against escalating bot tiers. Bots have a skill dial now; tying it to the player's LP tier is Slice 2.
8. **Cross-game rigs.** Queens N Kings, Kinetic Souls and DJ Shoey rigs are not in this repo, so the launch four are 616 rigs (Zero Day, Shade, Quarry Kid, Golden Hour). The `renderAdapter` contract in section 2 is the way to bring the others in.
9. **Reference images 10 and 11** (the two vertical maps) were not in the Drive folder or the session. The Drive reader also returns no content for images, so the build followed each image's written notes in section 13B.
10. **Daily reset time zone.** Days and weeks reset on the player's local clock.

## Built in Slice 2 (v0.42.89)

| Piece | File | What it does |
| --- | --- | --- |
| Capsule pull logic | `artifacts/survivor-616/src/party/capsulePull.ts` | Pure crack state machine: tap (4 to open), swipe across the seam, or hold; crack leaks back if you stop; two seam stages, burst, one reveal per reward with a minimum beat so taps cannot skip it. |
| Capsule pull screen | `artifacts/survivor-616/src/party/CapsulePullOverlay.tsx` | Vertical one-thumb layout: metallic Gold L capsule, widening glowing seam, stage punches and chimes, refraction burst, halves flying apart, confetti, the player's rig in a rarity pillar wearing palettes, hats and capes, cream reward card at thumb height. The capsule is saved as opened before the show starts. |
| Ranked bots | `botSkillsForTier` in `lokDrop.ts` | Bots scale from Iron to 616 Apex with the Solo Blitz tier, one softer bot per match. |

## Built in Slice 3 (v0.42.90)

| Piece | File | What it does |
| --- | --- | --- |
| Board engine | `artifacts/survivor-616/src/party/lokBoard.ts` | Pure seeded Turbo Crown Blitz: item phase, standard 1-10 or Signature Die (Zero Day freeze, Shade cred, Quarry Kid boulder ride, Golden Hour gilded), hops with junction choices, Lok the Owl crown vendor (20 coins, moves after a sale), seven space kinds, five items, glitch traps, ARCHON tax and traps, four board events, day and night every three rounds, three-round Overtime, minigame payouts, two Bonus Crowns, greedy bots. |
| Monroe Loop | `artifacts/survivor-616/src/party/boards/monroeLoop.ts` | 37 spaces with elevation: fire-escape ladder to the rooftops, steel gantry over the Grand River, terrace stairs, boulder-chute slide. |
| Board art | `artifacts/survivor-616/src/party/boardArt.ts` | Golden hour and midnight moods; brick, glass, tile and stucco facades with windows, awnings, water towers, a fire escape and neon signs; river with embankment and shimmer; truss gantry; terrace; chute; lamps, trees, crates, hydrants, promenade; spaces set in street sockets with light spill and original glyphs; Lok the Owl; spinning crown; coin; 3D dice block. |
| Board screen | `artifacts/survivor-616/src/party/BoardScreen.tsx` | Depth-sorted city (buildings, gantry, chute, props, paths, spaces, players, owl), buildings fade see-through when they would hide a player, the owl or a path choice; camera follow with city bounds and a map overview; hop arcs per traversal; player cards with rig portraits; slam-in banners; thumb-height prompts; the Lok Drop as a 30 s minigame. |
| Touchable city | same | Tap windows (lights on or off), signs (recolor), lamps (switch), trees (leaves), crates (wobble), benches and the bus shelter (jiggle), the river (ripples), the night sky (shooting star), spaces (bounce and note), players (hop) and the owl (hoot). Cosmetic only, never a reward. |
| Hub | `LokDropScreen.tsx` | Lok Party opens on a mode picker with live drawn previews; lobby picks 5, 10 or 15 rounds. |

## Built in Slice 4 (v0.42.91): entrance and online

- **Entrance:** a Lok Party door on the hideout main floor (custom crown-and-owl glyph), the hub's third card "Play with friends", and links `?screen=lok-party&party=CODE`.
- **Online (`partyNet.ts`, `PartyLobby.tsx`):** Supabase Realtime broadcast on channel `lokparty:<code>`, the same free relay as the Arena. Host-ordered action log (`apply` with sequence numbers); guests send `act`; bots are decided on the host only. Minigames are async score-attack (`mini-report` to the host, `mini-result` back). Pings every 4 s; a guest quiet for 20 s becomes a bot; a host quiet for 25 s ends the party for guests. Crew invites ride the crew bus (`party-invite`) and show `PartyInviteToast` anywhere in the app.
- **Rule:** bot decisions must never draw from `s.rng` (the host alone runs bots online). A lockstep test replays the host's log on a second engine and requires an identical game.
- **Backend notes:** nothing is stored; results stay unranked online until a server can verify them.

## Online recovery (v0.42.92)

The relay is best-effort, so `partyNet.ts` resends until things land: guest pings carry `have` (the host resends the rest of its action log) and `waiting` (the host resends a minigame result); guests repeat `act` and `mini-report` until answered; a guest still in the lobby keeps sending `join-request` and gets `start` again. The host commits a guest choice only through `actVerdict`, so repeats are dropped. New online messages must follow the same rule.

Still open: the crew invite card's Join button reloads the app, so tapping it mid-run loses that run; and a host who backgrounds the tab for more than 25 seconds ends the party for guests.

## Next slices
- **Next for the board:** Crewmate roving allies, Duel spaces, a second minigame (Ring Run Rush) so rounds vary, the Pawnford board, and a Party Lounge door in the hideout.
- **Slice 4: Cartridge contract.** `LokMinigameCartridge` (mount, getResults, unmount) so Ring Run Rush and Gem Vacuum Frenzy plug in, then iframe cartridges from other repos.
- **Backend (noted, not built):** room codes over Supabase Realtime broadcast, async seeded score-attack, trusted results before any online LP.

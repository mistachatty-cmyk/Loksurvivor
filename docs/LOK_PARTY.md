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

v0.42.94: a hidden page announces `away` in its ping and gets `quietLimitMs` of 90 seconds; saved capsules open from the hub. Still open: no host hand-over. Everything else outstanding is in [LOK_PARTY_NEXT.md](./LOK_PARTY_NEXT.md).

v0.42.93: buttons go through `party/press.ts` (pointerdown plus keyboard), online results are unranked, friends are named on the board, and the invite card asks twice during a run.

## Next slices
- **Next for the board:** Crewmate roving allies, Duel spaces, a second minigame (Ring Run Rush) so rounds vary, the Pawnford board, and a Party Lounge door in the hideout.
- **Slice 4: Cartridge contract.** `LokMinigameCartridge` (mount, getResults, unmount) so Ring Run Rush and Gem Vacuum Frenzy plug in, then iframe cartridges from other repos.
- **Backend (noted, not built):** room codes over Supabase Realtime broadcast, async seeded score-attack, trusted results before any online LP.

## Ring Run Rush (v0.42.95)

`src/party/ringRush.ts` (pure, seeded rules) and `RingRushArena.tsx` (2.5D street). `minigameForRound` alternates it with the Lok Drop: odd rounds Drop, even rounds Rush, worked out the same way on every client. Online uses the same score report as the Drop. Rivals on your screen are bot stand-ins; only final scores are compared.

Owner rule: every minigame shows each player's character doing something, Mario Party style, with real polish. The Lok Party menu also lists the weekly missions.

## Minigame kit and Roof Rumble (v0.42.96)

`minigameKit.ts` is the cartridge contract (blueprint s10): a game supplies seeded rules (`create`, `step`, `results`, scores) plus `render` and `react`, and `MinigameStage.tsx` runs it with the shared entrance and podium from `stageArt.ts` (title slam, character lineup, controls card, 3-2-1-GO, tap to skip; podium with rising steps and confetti), touch/keys (`StageInput`: hold to aim, quick tap, Space), fixed step with hit-stop, camera, particles and popup words. `minigameForRound` (in the kit) rotates drop, rush, rumble.

Roof Rumble (`roofRumble.ts` rules, `roofRumbleArt.ts` look): sumo on a neon rooftop that shrinks from 330 to 150 units. Drag to move, tap to dash (aim assist snaps a tap near a rival onto them). A knockout is +3 when the rival falls within 3.5 s of your hit; falling is -1 and you drop back in. Boom barrels drop every 4.2 s, show their blast zone, blow on a fuse or when dashed into, and chain. Ring Run Rush now uses the shared entrance and podium but keeps its own loop; porting it onto the stage is a later tidy-up.

## Rooftop arenas (v0.42.97)

Roof Rumble's rules take an arena (`RumbleArena` in `roofRumble.ts`); everything else (dash, shove, barrels, knockouts) is shared, and each arena is its own cartridge (`roofRumble`, `roofCollapse` from `makeRumble`) so it gets its own title and its own slot in the rotation (drop, rush, rumble, collapse).

- **sumo** (Roof Rumble): the edge crumbles inward smoothly, 330 to 150.
- **collapse** (Roof Collapse): the floor is rings 330/250/180/120. At 9, 16 and 23 s the outer ring drops; for 1.7 s before, it flashes red with spreading cracks and shakes. Bots treat a cracking ring as off the roof (`safeRadius`).

### Arena plan (next, same rules engine)

Each is a new `RumbleArena` value: a floor shape and a way it gives way, plus a draw function.

1. **Square roof** (corners are death traps; the walls slide in). Edge test becomes max(|x|, |y|).
2. **Tile drop**: the floor is a hex grid; random tiles flash and fall, so holes open in the middle too, not just the edge.
3. **Tilting deck**: a rooftop platform on a crane that tips toward whichever side has more players, so everyone slides.
4. **Conveyor roof**: the floor scrolls one way, toward an open edge, and reverses every few seconds.
5. **Two roofs and a bridge**: a narrow catwalk between two small roofs; a boom barrel can break the catwalk.
6. **Storm night**: wind gusts with an on-screen arrow push everyone the same way for two seconds.

## Roof Collapse, the main event (v0.42.98)

Four rings, 330/245/165/95: drops at 8, 15 and 22 s leave a tiny last ring for the final 8 s. Each drop gets a 2.4 s warning: a "Ring drops in 3, 2, 1" banner with a tick sound and red pulse on every beat (`ringTick`), the ring flashing and shaking with spreading cracks and dust, and a gold dashed safe line on the next seam. On the drop: a slam banner ("RING DOWN!", or "FINAL RING!" for the last one), hit-stop, flash and shake, and the ring shatters into 20 chunks that let go a beat apart and tumble down the building (back chunks behind it, front ones in front). Ring pips under the timer show what is left. The last ring's rim glows gold.

Precision and feel (shared by Roof Rumble too):
- Mouse: the character follows the cursor; a click dashes on press, not release.
- Touch: one finger steers, a quick tap dashes (aim assist onto a rival near the tap), and a DASH button for the second thumb fires on press and shows the cooldown.
- Keys: WASD or arrows, Space to dash; a keyboard or button dash snaps onto a rival in a 37 degree cone.
- Dash buffer: pressed within 160 ms of the cooldown ending, it fires the moment it is ready.
- Snappier walking (accel 3200, brake when you let go), cooldown 750 ms.
- Clutch save: going over the edge gives 240 ms of coyote time; dash back in and you stay up for +1 and a "CLUTCH!" popup. A shoved, stunned runner can still clutch.
- Multi-KO popups (DOUBLE KO, TRIPLE KO) and popups that stack instead of overlapping, for streams.

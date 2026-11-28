# Lok Party: the road to 10 modes (2026-11-27)

**Status (v0.43.6): all ten are built.** Gem Vacuum Frenzy, Strike a Pose, Face Off, Rooftop Relay (2v2) and Tilting Deck joined the rotation, and the Vault shelf shipped. They were built at medium effort; the rules are tested, the art is solid but a higher-tier pass on the entrances, particles and reveals is still worth doing (see "Who builds what"). Registry: `src/party/cartridges.ts`.

Goal from the owner: about 10 modes in Lok Party. "Mode" here means something a party can play: the board plus every minigame in the rotation. Every one follows the owner rule in [LOK_PARTY_NEXT.md](./LOK_PARTY_NEXT.md): a party game with each player's character on screen doing something, polished, seeded and score-attack so online stays cheap.

## Count at the start of the day: 5

1. Turbo Crown Blitz (the board)
2. The Lok Drop
3. Ring Run Rush
4. Roof Rumble (sumo roof)
5. Roof Collapse (the streamer main event)

## Next 5 (to reach 10), in build order

| # | Mode | Shape | What makes it a party game | Rules | Art |
| --- | --- | --- | --- | --- | --- |
| 6 | Face Off | 4 players, 30 s | Doodle on your character's face against the clock, everyone votes; the winner wears it for the match | Sonnet-level (stroke capture, vote, share) | Higher tier (face canvas, reveal, vote stage) |
| 7 | Gem Vacuum Frenzy | 4 players, 45 s | A vacuum on the character sucks gems while rivals steal from you and bombs knock the pile loose | Sonnet-level (kit already has input, hit-stop, toasts) | Higher tier (gem chains, suction, pile pops) |
| 8 | Tilting Deck | 4 players, survive | One roof that tilts toward whoever stands on it; players balance, shove and slide (same rules family as Rumble, new physics) | Sonnet-level (add tilt to `roofRumble.ts`) | Higher tier (tilt, sliding props, storm) |
| 9 | Strike a Pose | 4 players, 5 rounds | A pose card flashes, tap or stick-gesture to match it fastest; characters snap into poses with camera flashes | Sonnet-level | Higher tier (pose rigs, flashes, judges) |
| 10 | 2v2 Relay Rooftops | 2 teams | Pass a baton across rooftop gaps; first team across wins; the first team mode, so it proves the format for later 2v2 and 1v3 | Sonnet-level, needs a team result in the kit | Higher tier |

Then, beyond 10 (from the blueprint): Pigeon Kick Climb, PongFall Panic, Lexicon Lightning, Kinetic Knockout, two 1v1 duels (also unlock board duel spaces), three 1v3.

## Making the whole mode better (not just more games)

Ranked by how much they lift the party:

1. **Vault screen** so Party shards become permanent unlocks (waiting on your A / B / C pick).
2. **Pass-and-play and controller for the board** (minigames already take a controller).
3. **Host hand-over** so a party survives the host leaving.
4. **Streamer view:** a clean spectator screen with a big timer and a crowd vote that picks the next minigame or fires a hazard in Roof Collapse (the streamer main event).
5. **Podium share card and party trophies** (a 1080 x 1920 card, plus a trophy per mode).
6. **Rotation rules:** a party picks modes by space colour, with no repeats until all have played, and the host can pin a favourite.
7. **Duel spaces** on the board using the first 1v1 mode.

## Who builds what

- Rules, tests, input, online and wiring (the kit makes this fast): Sonnet 5.5 at medium effort is enough.
- Art, the entrance and podium for each new mode, and the "insane" feel (particles, shatter, face-draw reveal): do these at a higher tier, from a short brief per mode (what you see on screen, the three juiciest moments, the camera behaviour). Each brief goes into `docs/art-library/lok-party/` with the finished picture.
- Per the visual rule: show pictures of a mode's look before building it.

**Bonus mode (v0.43.11): Red Light, Green Light.** A giant owl, tap to run, freeze on red or be lasered. The first mode where anyone can fail. Rules `src/party/redLight.ts`, art `redLightArt.ts`. Built for four seats; the rules are per-runner, so more players is a seat-count and lane-layout change.

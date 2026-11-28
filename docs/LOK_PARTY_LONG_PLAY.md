# Lok Party board: long-play foundations (v0.43.7)

Why: "play N turns" is not a reason to keep playing for hours. The board needs goals players chase together or
against each other, and it needs to answer back in ways that make sense.

## Built
- Goals (`BoardGoal` in `party/lokBoard.ts`): classic rounds, Crown race (target 3), Relic hunt (target 5). A race
  ends at the end of the round someone hits the target (equal turns). `RACE_CAP_ROUNDS` (40) is only a safety net.
  The goal travels inside the existing `rounds` number (`encodeGoal` / `decodeGoal`), so no network change; older
  clients just play classic.
- Spawns (`spawnRound`): each round the board puts down a cache, beacon or safe house, aimed 2-7 hops ahead of the
  player furthest behind (catch-up that reads as the board being fair, not rubber-banding). Relic hunts keep two relics
  out. Never on players, the owl or start. Cache/relic collect on pass; beacon/safe house on landing.
  Small spawns fade after `SPAWN_LIFE_ROUNDS`; capped at `SPAWN_CAP`.
- Reactions stay calm: spawns are a soft chime and a ring, no banner. Only relics and goal moments get weight.
- Bots head for nearby pickups at junctions (no extra rng draws, so online stays in sync).

## Not built (candidates for the higher-tier pass)
- Online lobby goal picker (solo lobby only for now; the encoding already carries it online).
- Per-spot board personality (a district that rewards a streak, rival-vs-rival bounty on the leader).
- Ambient bed that shifts with progress toward the goal, spawn-ahead audio cue, rate-limited emotes.
- Co-op goals (everyone against the clock) and a persistent multi-hour campaign layer.
- Art is procedural and medium-effort; show visuals before any final art decision.
- Not checked on a real device.

## Added in v0.43.10
- Districts (`BoardDef.districts`): Market Row, The Terrace, Riverside, West Side, The Rooftops. Each round one is hot (landing pays +3, chosen where the trailing player has spaces 1-8 hops ahead, never the same twice in a row). Hot spaces glow amber.
- Streaks: ending a turn on a good space (cred, supply, event, start) back to back builds a streak; cred spaces pay up to +3 more; a bad space breaks it.
- Bounty: the crown leader wears one; a rival who ends a turn on the leader's space takes up to 5 cred.
- Race lengths: crowns 2/3/5, relics 3/5/8. Relic hunts keep three relics out; bots chase relics over crowns in a relic hunt.
- Feel: haptics through the shared SDK, final-five-seconds escalation, final whistle, GO speed lines, hanko seal on the winner.
- `pnpm check:feel` (from artifacts/survivor-616): speed, determinism and finishing checks for every mode and board goal. Run by hand only.
- Split: `LokDropScreen` into `dropShared`, `DropArena`, `LobbyScreens`; `BoardScreen` into `boardShared`, `boardUi`. The big board effect is still one function: next split candidate (events, draw, UI).

## Ideas to make rewards mean more (not built)
- District control: hold a district's three marks to own it for a round (a toll when others land).
- Rivalry streaks: beat the same player in minigames back to back for a duel bonus.
- Comeback crowns: last-place players choose where next round's hot district sits.
- Season goals across matches (relic collection, district tours) tied to the Vault.

## Online lobby (v0.43.10)
- Scan-to-join QR card always visible (host and guests), built on device from the room link. Test: `party invite` in lokParty.test.ts.
- Game options drawer: host picks goal and length online; sent with the seats (`rounds` code). Guests see the same line read-only.
- Wake lock while gathering; haptic when a friend sits down.
- Ideas not built: ready-check per seat, tap-to-change character in the lobby, a short voice-free emote strip, rejoin-after-drop with the same seat, join by scanning from inside the game.

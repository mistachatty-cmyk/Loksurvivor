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

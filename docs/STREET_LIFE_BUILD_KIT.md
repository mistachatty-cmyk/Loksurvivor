# Street Life build kit

One reusable way to add things to the open street. Everything is a record or a small builder call. The kit lives in `artifacts/survivor-616/src/game/data/streetLife/`.

| File | What it holds |
|---|---|
| `pieceKit.ts` | `definePiece`, the context a builder gets, and the builders `trackBuilder`, `arcBuilder`, `lineBuilder` |
| `pieces.ts` | The list of pieces that can appear on a street (`STREET_PIECES`) |
| `milestones.ts` | Block milestone steps and which stats they can raise |
| `index.ts` | `streetLifeForChunk(cx, cy, seed, axis)`, the one function the engine calls |
| `../ringRuns.ts` | Ring kinds and colors, the Victory Token table, and the token roll |

## Add a new ring piece (about 5 lines)

Append to `STREET_PIECES` in `pieces.ts`:

```ts
definePiece({
  id: 'night-sprint', name: 'Night sprint', chance: 0.02,
  build: trackBuilder({ gates: [6, 8], length: 400, sway: [30, 50], salt: 60 }),
}),
```

Rules: give it a unique kebab-case `id`, a share of chunks (`chance`), and a `salt` no other piece uses (salts keep every choice deterministic). Add new pieces at the end of the list so existing seeded streets keep their layout. `streetLifeKit.test.ts` fails if an id repeats, a piece never shows up, or a point lands outside its chunk.

## Add a new shape

Write a builder next to the other three in `pieceKit.ts`. A builder takes `ctx` and returns `{ free }` (loose rings) or `{ track }` (gates plus coins). Use `ctx.roll(salt)` for any choice and `ctx.at(along, across)` to place points relative to the street, so it works on both street directions.

## Add a Victory Token

Add a row to `BURST_TOKENS` in `ringRuns.ts` (color, trim, weight, popup text, effect line) and one `case` in `collectBurstToken` in `engine/world.ts`. The token test checks that every kind can be rolled.

## Tune block milestones

Edit `milestones.ts`. `MILESTONE_STATS` holds each stat and how much one step adds (armor and crit are fractions, so 0.005 is half a percent). `BLOCK_MILESTONES` holds how often they fire (every 5 blocks, and a grand one every 25 with a small token burst).

## Reusing it in other games

The kit has no game-specific imports beyond ring kinds. Another Lok game can copy `streetLife/` and `ringRuns.ts`, and supply its own `World` code for what a ring or token does. The deterministic hash (`ringHash`) means two games with the same seed can show the same street.

# Minigame cartridges

Every Lok Party minigame is a cartridge. The board, hub, lobby and results read one list, so a new game is one new entry and never touches the board.

Files (all in `artifacts/survivor-616/src/party/`):
- `cartridge.ts`: pure contract. `MiniOutcome`, `CartridgeProps`, `minigameForRound` (seeded rotation, never the same game twice in a row), `validResults`.
- `cartridges.tsx`: the registry `CARTRIDGES`. Each entry has id, locale keys, accent color, `soloMs`, `boardMs` and a `Component`.

## Steps to add one
1. Write a pure engine `myGame.ts`: seeded, no Math.random, no wall clock; bots use hashes of (seed, seat, tick), never a shared rng. Export `create`, `step`, `results` (placement 1 to 4 and a banked score each) and a `performance` for the shared meta.
2. Write the screen. It gets `CartridgeProps`: `seed`, `playerId`, `botSkills` (0..1 for the three bots, human is seat 0), `durationMs`, `getAudioContext`, `onDone`. Use `subscribeActions` from lokInput for keyboard and gamepad, plus touch. Use `FrameGovernor` for canvas resolution. React on press, add hit-stop and chimes from `juiceEngine`.
3. Call `onDone(outcome)` exactly once with all four seats.
4. Add the engine file to the import-isolation list in `lokParty.test.ts`.
5. Add locale keys to `en.json` only (title, pitch, hubPitch, controlsKeys).
6. Add the entry to `CARTRIDGES`. Tests for determinism and a bot skill sweep go next to the engine.

## Rules
Procedural art only, no emoji, no new network calls, no runtime LLM calls.

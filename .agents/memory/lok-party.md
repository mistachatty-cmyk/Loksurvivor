# Lok Party (Slice 1, v0.42.88)

Read before touching `artifacts/survivor-616/src/party/` or anything Lok Party pays into 616.

- Design source: Google Doc "GSix / Lok Party Mode ... Blueprint" + Drive folder "Lok Party Visual References". Build notes and gap list: `docs/LOK_PARTY.md`.
- Party progress lives ONLY in `lokparty.meta.v1`. It must never grant combat stats to 616 or Queens N Kings. Only cosmetics (`exportFlex`) and a once-a-day grant leave it.
- The daily grant pays through `claimLokPartyGrant` in metaStore, which calls the hideout reward choke point (`grantWithFallback`). The blueprint's +150 Cred was cut to 15 because the hideout caps cred at 60/day and 15/grant. Never add a second payout path.
- The blueprint names its keys and one swap item with the word CLAUDE.md bans. Here they are **Beacon Keys** and **Swap Relay**.
- `lokDrop.ts` is a pure seeded sim (no `Math.random`, no wall clock). Keep it that way: async online score-attack and ghosts depend on exact replays.
- `juiceEngine.ts` never creates an AudioContext; it takes `getAudioContext` from `useMusicPlayer()`. React on pointerdown/keydown only.
- Online Crew ladder exists in the save but must not be fed until results are server-verified (same rule as 616 Arena).
- Characters are always drawn with our procedural rigs (`drawRig`); reference images guide camera, lighting and HUD only.
- Decided 2026-11-26: Lok Party stays in this repo for now, kept extractable. The four engine files must import only each other (test enforces it); host hooks live in the screens.
- Board depth (Slice 3): never bake buildings, gantry, chute or props into the ground layer; they are sprites sorted with spaces and players by `nodeSortY`/`propSortY`/`y1`. Elevated spaces sort at y + z*100 so they draw above their own roof. City taps are cosmetic only and must never pay out.

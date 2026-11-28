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
- Online (v0.42.92): the relay loses messages. Anything that matters is resent until answered (`createActionSync`, `actVerdict` in partyNet.ts); the host never commits a guest choice directly from the message handler.
- Decided 2026-11-26: Lok Party stays in this repo for now, kept extractable. The four engine files must import only each other (test enforces it); host hooks live in the screens.
- Board depth (Slice 3): never bake buildings, gantry, chute or props into the ground layer; they are sprites sorted with spaces and players by `nodeSortY`/`propSortY`/`y1`. Elevated spaces sort at y + z*100 so they draw above their own roof. City taps are cosmetic only and must never pay out.

- Owner rule (2026-11-27): minigames are interactive party games with every character visible and acting, never filler. Vault screen waits for the owner's pick of layout A/B/C.

- Owner rule (2026-11-27): minigames are interactive party games with every character visible and acting, never filler. Vault screen waits for the owner's pick of layout A/B/C.
- New minigames go through the kit (minigameKit.ts + MinigameStage.tsx): rules file + art file; never hand-roll another entrance or podium. Visuals made in chat go in docs/art-library/lok-party/ with how they were made.
- Owner direction (2026-11-27): Roof Collapse is the streamer showpiece. Rings 4 to 1 with a loud, readable drop each time; controls must be precise and fire on press (mouse follow + click dash, touch DASH button, dash buffer, coyote clutch saves).

## v0.43.6 (2026-11-28): ten modes and the vault
- New kit games: Gem Vacuum Frenzy (`gemVacuum*.ts`), Strike a Pose (`strikePose*.ts`), Face Off (`faceOff*.ts`), Rooftop Relay 2v2 (`relay*.ts`, team = seat % 2, a human's tap jumps their team's runner) and Tilting Deck (a `'tilt'` arena inside `roofRumble.ts`). All are listed in `party/cartridges.ts` (`CARTRIDGES`, `PRACTICE_ORDER`) and in the rotation in `minigameKit.ts`; BoardScreen and the practice menu look games up there, so a new game is rules + art + one line in cartridges.ts and minigameForRound.
- Vault: `VaultScreen.tsx` shelf layout (owner said pick what is best). Cosmetic names are `lokParty.vault.item.<id>` keys in en.json: add one when adding a cosmetic to `PARTY_COSMETICS`.
- Art was done at medium effort; entrances, particles and reveals are candidates for a higher-tier polish pass. Previews: `docs/art-library/lok-party/new-modes-2026-11-27/`.

## v0.43.7 board goals
Goals (crowns/relics race) and per-round spawns live in party/lokBoard.ts; goal rides in the `rounds` number (encodeGoal/decodeGoal). See docs/LOK_PARTY_LONG_PLAY.md.

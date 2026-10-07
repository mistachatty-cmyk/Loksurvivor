# Travel fight styles

Travel encounters can play four ways, chosen per device in Settings
(`survivor616.fightstyle`, read once when the encounter starts):

- `classic` (default): the original card-throw popup, `TravelEncounterOverlay`. Never removed or changed by the new styles; the user asked explicitly that the originals stay.
- `quick` / `duo` / `arena`: one overlay, `EncounterFightOverlay`, on the arena engine through `engine/quickFight.ts`.

Decisions worth keeping:

- The classic popup's rewards, catch chance and flee rules are reused through `buildTravelEncounterResultFromOutcome`, so all four styles pay out identically.
- `quick` and `duo` use depth `quick` (one pet a side, three moves, no finishers, 8-round cap). `arena` uses depth `deep` (every move, finishers, trinkets, Cheer, 20 rounds). A fight is always judged on remaining HP at its cap, with ties going to the player.
- The opponent's next move is chosen by `chooseEnemyMove` and stored as `intent` before the player picks, then played as-is, so the telegraph is never a lie.
- The opponent's free opener (when it is faster) is dropped if it would end the fight; nobody loses before acting.
- Duo's operator assist (punch, a Battle Deck card, or a once-per-fight cover) is applied before the pet's move and scaled by `ASSIST_SCALE` because the classic numbers were tuned for a 50 HP scrap. Cards still burn copies unless the Handheld DigiScope is owned. The operator is never targeted; the pet takes the hits.
- Layout adapts at 640px: phones get one stacked column (log shrinks to the last round), wider screens get stat panels either side and a running battle log. Any new style must keep both layouts.
- The first build used an on/off key (`survivor616.quickfight`); `getFightStyle` still reads it as `quick`.
- e2e forces an ambush by setting `Math.random = () => 0` for one room change and restoring it as soon as the overlay mounts; seed meta needs `version: 5` or it is discarded.

## Team and switching (0.14.3)

Duo and Arena bring the selected team (`travelTeam()` in `data/travelEncounters.ts`,
lead first, capped by `lokPetTeamCapacity`); Quick stays on the lead only.
`createQuickFight` takes `playerPets` + `maxTeam`; `switchQuickFight` costs the
player's turn and the opponent still plays its telegraphed `intent`. The engine
already auto-sends the next teammate when the active pet faints
(`executeMove`/`resolveStatusFaints`), so the fight only ends when the whole team
is down, and `judgeAtCap` compares total team HP. The shared entrance effect is
`ui/LokPetEntrance.tsx` (extracted from `StarterLokPetEncounter`, sound cue
`lokPetEntrance`); fight overlays show it in a banner above the vignette because
`HideoutVignette` is one canvas and cannot animate a single actor in DOM terms.
Arena stays a Settings-only choice (no per-ambush chooser).


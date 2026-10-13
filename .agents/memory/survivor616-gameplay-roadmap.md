# Survivor616 gameplay roadmap and handoff

The player's roadmap serves new, returning, and endgame players. Object cracking and destruction is a standing major priority; see [object-destruction-effects.md](object-destruction-effects.md). Keep future work balanced across players and keep the Mission Briefing / Looks & LokPets controls available from the hideout dock.

## Work in this pass

- Added cumulative deterministic, material-specific prop damage and break presentation, with reduced-motion handling and quality-based debris limits.
- Added a recommended next map based on the first uncleared unlocked standard map. Existing filters remain available below it.
- Added a compact pre-run briefing to Run Setup with the map, operator, selected LokPets, default controls, active run modifiers, and selected optional contracts.
- Added deterministic generated field specimens on the run report and in a Bestiary tab when a player clears a standard district for the first time. This is a discovery/archive seed, not yet a capturable or battle-usable LokPet; see [lokpet-field-specimens.md](lokpet-field-specimens.md).
- Clarified online Arena as a shared-enemy kill race, added connection status, a retry route after a disconnected lobby, and explicit tie handling. Online results no longer pay win tokens because this client relay cannot verify results.
- The Operator Forge already has five designed operators with exclusive signature weapons, including LokPet Master, plus authored enemy/LokPet customization flows. Treat these as existing systems; don't add duplicate rosters. DIGI-Tower now has a playable 100-floor, ten-sector campaign; see [digi-tower-campaign.md](digi-tower-campaign.md) for its save/retry rules and remaining expansion work.
- Existing first-run components include `FirstNightBoard`, the photosensitivity notice, starter LokPet encounter, and the map picker. Revisit them in a fresh profile to ensure the whole route remains optional and understandable.

## Next implementation targets

1. **First-run and briefing:** Walk a fresh profile through character selection, starter companion, first objective, return route, and pre-run summary. Verify the optional Mission Briefing and Looks controls from the top hideout dock do not obstruct a clear, summary, or end-game transition.
2. **Online Arena:** Connection feedback is present, but ready-up, guest presence, host departure/forfeit, safe result cleanup, and reconnection to an in-progress match remain open. Each client still simulates its own world and trusts relayed counters for display. Keep online results unranked and reward-free until a trusted server or host-authoritative simulation validates outcomes.
3. **Player-versus-player:** Still unimplemented. Build as a separate mode with explicit player health, attacks, respawns, scoring, and tie rules, then validate simultaneous knockouts and hostile, delayed, duplicate, and missing messages. Do not label the shared-enemy kill race as PvP.
4. **LokPet trait system:** The first-clear research-trace segment is now playable and archived. Still needed: authored encounter/scan provenance, duplicate keep/release/compare choices, generated visuals, and a deliberate collection-to-battle conversion path with bounded stats.
5. **Masters / DIGI-Tower:** the Tower campaign, authored sector encounters/Masters, persistent checkpoints, retry-safe progression, practice replays, and a first token exchange are implemented. The broad RPG plan's Daily Tower, Vault reward choices, Training Bay, Evolution Cores, Companion Trials, cosmetics shop, Endless Spire and Operator/Duo floors remain future content; do not imply those are shipped.
6. **Sector Command:** Mission selection, prerequisites, run launch, objectives, debrief and completion persistence already work. Check touch input and its objective/reward details on phone, then build the planned Production tier or scripted skirmish if it adds a distinct loop.
7. **Replay rewards:** Link daily jobs, achievements, mastery, pet bonds, and end-game unlocks to a readable next goal. Refresh handoff notes when a design-only feature becomes playable.

## Acceptance route

- Fresh profile: reach the first run without a mandatory lore overlay, understand the objective and return path, open an optional briefing, and complete into summary/endgame.
- Prop effects: test five material families, cumulative stages, break fade, reduced motion, performance graphics, small viewport, and dense combat; confirm physics and rewards are unchanged.
- Arena: multi-client fair scoring, join timing, late/duplicate/lost inputs, disconnect, reconnect, host leave, cleanup, and result validation. Test PvP ties and simultaneous knockouts separately.
- LokPet and progression: follow unlock/find → understand → collect/use → progress → visible archive/run result.

# DIGI-Tower campaign

## Player promise

The DIGI-Tower is a turn-based LokPet expedition with a finite, authored campaign: 100 floors across ten sectors, one named Master at each sector's capstone, and a distinct signal rule per sector. The player brings up to three saved LokPets. Floor condition persists through the climb; a wipe returns the party to the last five-floor checkpoint. Cleared floors can be replayed safely for reduced pet XP without changing the campaign.

The Tower is a progression loop, not just a lore tab or a battle-mode label. It must always answer: what floor is next, why is it available, what will this fight ask of my team, what do I earn, and where will a loss put me?

## Implemented loop

1. Win a LokPet battle and keep at least one pet to open the Boot Sector.
2. Deploy floors in sequence. A saved party of up to three is used; if a selected loadout exists it is honored, otherwise the first three saved pets are used.
3. Encounter structure repeats with authored purpose: sector entry, route/scout encounters, curated story trials on floors 3 and 9, faction squads on floors 4 and 7, a mirror practice encounter on floor 8, a rest vault/checkpoint on floor 5, and the sector Master on floor 10.
4. On victory, save pet HP/energy/status, reward pet growth and CRED, record the floor, and award Tower Tokens once. Master seals unlock the next sector.
5. Rest floors restore all saved party condition, open one free Training Bay visit, and offer a choice between more Tower Tokens or a smaller token payout plus LokPet treats. Clearing a floor divisible by five also commits the checkpoint party condition. Training ranks use level/evolution-earned points; each rest choice also gives 10 Training Data.
6. On a wipe, return to the last checkpoint and retain completed progress. Floors cleared again after a wipe allow the campaign to advance; they award reduced XP/CRED and no duplicate Tower Tokens or Master seal.
7. A player can leave a live floor and resume that same floor later. An interrupted battle never commits partial damage or consumes a floor clear.
8. Any cleared floor can be replayed with full party condition, no expedition risk, no campaign progress and 25% pet XP. It grants no Tower tokens, treats, cards or CRED.
9. After Master Nib, the Boot-Sector exchange can trade 50 Tower Tokens for three LokPet treats.

## Sector and story direction

| Floors | Sector | Master | Distinct identity and field rule |
| --- | --- | --- | --- |
| 1–10 | Boot Sector | Master Nib | First-signal onboarding, Data Goblin scrap shrines; Terra attacks +20%. |
| 11–20 | Packet Alley | Master Dropframe | Broken routes and frame echoes; Glitch attacks +20%. |
| 21–30 | Canopy Stack | Master Rootkit | Living cache and cable roots; Terra attacks +20%. |
| 31–40 | Neon Overflow | Master Cabinet | Arcade loops and high-score ghosts; Light attacks +20%. |
| 41–50 | Lev Spire | Master Overclock | Heat lanes and process timing; Volt attacks +20%. |
| 51–60 | Hollow Cache | Master Hollow | Firefly guides through a quiet archive; Dark attacks +20%. |
| 61–70 | Reel Vault | Master Reel | Alternate takes and a changed ending; Aero attacks +20%. |
| 71–80 | Null Basement | Master Null | Powerless sockets and missing signals; Glitch attacks +20%. |
| 81–90 | Prism Core | Master Prism | Split routes and many-sided truths; Light attacks +20%. |
| 91–100 | Apex Terminal | Grandmaster Apex | Ten-sector remix; Light, Volt, Glitch rotate +20% by turn. Requires the standard-map endgame. |

These names and blurbs are now authored playable Tower content, while the larger Masters ladder in `data/masterLore.ts` remains provisional lore. The Tower's explicit Master records and variant IDs live in `src/game/data/digiTower.ts`; that file, rather than generic Master lore, defines what a Tower encounter actually does.

## Balance and save contracts

- Floor IDs are stable `tower-floor-N` keys. `MetaState.digiTower` is normalized as untrusted local-save data, bounded to 100 floors, ten seals, one million each of Tower Tokens and Training Data, and a small party/status payload.
- Tower writes are sequential: the reducer accepts a campaign clear only when it equals `nextFloor`. Practice never sends a campaign floor result. This prevents forged/out-of-order floor mutation and makes a resumed floor deterministic in progression.
- First-clear status is independent from the current retry attempt. Wiping can require re-clearing floors above the checkpoint without deadlocking progression or paying the first-clear token grant twice.
- A checkpoint stores the party state as it was at its clear. Voluntary battle exit keeps the committed pre-floor state and current floor. Wipe recovery restores checkpoint condition.
- Sector rules affect only attacks of the named element, on both teams. They do not alter healing, damage-over-time, enemy turn scheduling or non-Tower battles.
- Mirror floors copy the player's current party species and levels into opposing generated pets; they are thematic sparring matches, not copies of hidden stats, equipment or condition.
- The rest floor is a deterministic safe choice with full restore and a free Training Bay window before continuing. Training/respec actions validate the active unclaimed rest floor in the reducer; the respec costs 25 earned Training Data. There is no random item roll and no loss of saved pets.
- Token payouts are first-clear only. The initial exchange is intentionally a simple consumable sink; do not let an exchange buy permanent combat power or bypass progression gates.

## Follow-on content (not represented as shipped)

- Endless Spire after floor 100, a daily seeded challenge, Vault choice rewards, Evolution Cores, pet-specific Companion Trials, and the larger Tower token cosmetics shop.
- Operator-only rooms and Operator + LokPet Duo floors. Keep the first campaign pet-only so it can be tuned and completed independently.
- Distinct faction rosters should use the shared faction registry when it exposes compatible LokPet identities. Until then, sector teams are curated from the LokPet battle variant catalog and use sector faction IDs as flavor metadata.
- More than one Master reward style, Master voice lines, sector transition scenes, and optional voice/callout settings.

## Acceptance pass

- Fresh profile unlock: first saved companion + first pet battle exposes the Tower without trapping the player in a modal.
- Floors 1–10: verify enemy teams, material/element rules, Master seal, rest choice, token exchange, and display of exact first-clear rewards.
- Rest floors: spend earned ranks across every training stat, verify starter/non-starter rank caps and point allowance, respec for 25 Data, and verify neither action works after continuing.
- Retry path: clear floors 1–5, clear 6–7, wipe, resume at 6, re-clear through 10, and verify progress advances while tokens/seals are not duplicated.
- Checkpoint path: quit on an active floor and resume with the last committed pre-floor condition; separately wipe and confirm the checkpoint party condition is restored.
- Practice path: replay a cleared Master and a cleared ordinary floor; verify 25% pet XP, no currency/tokens/status carry/progression writes, and no changes to the active expedition.
- Gates: each Master seal opens exactly the next sector; Apex Terminal remains locked until standard-map endgame completion.
- Visual review: test Tower overview and battle screens at desktop and phone widths, with a full 100-floor history, reduced motion, and long names.

## Implementation map

- Content: `artifacts/survivor-616/src/game/data/digiTower.ts`
- Save state and sequential mutations: `artifacts/survivor-616/src/game/types.ts`, `state/metaStore.tsx`
- Battle scaling/rules/rewards: `artifacts/survivor-616/src/game/engine/lokPetBattle.ts`, `lokPetBattleTypes.ts`
- Campaign and replay UI: `artifacts/survivor-616/src/ui/DigiTowerPanel.tsx`, `LokPetBattleScreen.tsx`
- Earlier broad RPG roadmap: `docs/lokpet-rpg-and-digi-tower-plan.md` (still contains future-phase ideas; this note records the v1 implemented boundary).

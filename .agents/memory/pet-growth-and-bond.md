# LokPet growth, bond and names (v0.11.0), plus the Masters lore

**Plan:** `docs/lokpet-rpg-and-digi-tower-plan.md` (phases 0.11.0 to 0.11.8). 0.11.0 shipped Phase 0 plus XP, bond, names, Growth Recap and achievement categories. Everything later (hideout companions, evolutions, handlers, DIGI-Tower, Limit Break) is not built.

**Decisions that are easy to undo by accident.**
- **Thresholds did not change.** `getExpForLevel` is the same curve; the XP *sources* are multiplied by `PET_EXP_SCALE` (10). Nobody's level moves, nothing is retroactive. The curve and `applyPetExp` live in `engine/petExpCurve.ts` so the arena engine and `petGrowth.ts` can both use them without a circular import.
- **Battle XP used to vanish.** `recordLokPetBattleResult` saved the level but not the remainder. `BattleRewards.petResults` now carries final level and exp per team pet; battle pet ids are `battle-<savedId>-<ts>`, matched with `.includes(saved.id)`.
- **Run XP:** the starter partner is always counted and takes 100%, other pets in the loadout 60%, kennel pets nothing. Travel pays only on a win (by design). Stamina cost is applied after growth.
- **Bond** never decreases, caps at 12/day (local day key), ranks at 0/15/50/120/250. **Five name slots:** call (slot 1 = the old `name` field, so old names are untouched), then `names.battle/callsYou/epithet/trueName`. Slot unlocks: call Familiar (starter: free from the start), battle and callsYou Friend, epithet Partner, trueName Soulbound. A slot that already holds a name stays editable. The starter's optional call name is set in the starter encounter's partner step.
- **Evolution stage** has one rule (`getLokPetEvolutionStage`); `world.ts` used to hardcode 33/66 for everyone.
- Arena: burn/shock/corrupt ticks can end a fight now (`resolveStatusFaints`, enemy side settles first, so a double KO is a win).
- **Achievement toasts** are derived in a wrapper around the reducer (complete after, not before). `reset` and `replaceMeta` are skipped, or importing a save would toast everything.
- `META_VERSION` is 22; the new pet fields are optional and `normalizeSavedLokPets` cleans them.
- The save has no kennel-wide naming UI yet; names are edited in Run Setup (pencil) and the starter encounter.

## Masters lore (lore only, not wired)

`src/game/data/masterLore.ts` and `docs/LORE-masters.md`. Six ranks (Master, Sector Lead, Sector Mage, Sector Master, Master Divine, Digi-Master) crossed with nine callings (war, survival, civic, spiritual, commerce, invention, genius, culture, garden) and two realms (city, digi). The owner asked for leaders who are not about war: politicians, spiritual leaders, business people, inventors, geniuses, digi-realm versions of each, and digibeings who water and spread digiflowers ("Digiflowers bloom!"). All names are provisional placeholders and all fictional. One Digi-Master per Tower sector 1 to 10 is checked by a test. Add people as rows.

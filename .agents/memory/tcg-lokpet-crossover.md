---
name: TCG / Lokpet crossover
description: Why 616 Survivor's trading-card layer is a pure derived projection, not new persisted state, and how it connects to spend-ut-all's LokDex/Lokpet system.
---

# TCG / Lokpet Crossover — Key Decisions

**Two unrelated "LokPet" systems exist across the G-Six network -- don't
conflate them.** `spend-ut-all` has a mature "LokDex" trading-card/collectible
system (`game/lokdex-types.ts`, `game/systems/lokdex.ts`,
`integrations/lok/collectibles/pet-generator.ts`) with rarity, editions,
packs, and a credit shop. 616 Survivor's own `data/lokPets.ts` "LokPet"
family (`LOKPET_VARIANTS`, `rollLokPet`) is a same-named but *independent*
in-run companion mechanic with no card/collection/trade concept, predating
this crossover work. They are bridged, not merged: 616 Survivor's LokPet
variants now also get portable card manifests (see below), but the in-run
mechanic itself is untouched.

**Cross-game contract:** `spend-ut-all/docs/LOK_PORTABLE_ASSET_SPEC.md`
defines a `namespace:slug` asset manifest (`LokAssetManifest`) any G-Six game
can adopt to describe portable cards/pets/collectibles without a shared
database. 616 Survivor adopts it under namespace `g6.616-survivor`
(`game/lok/types.ts`, `game/data/cards.ts`).

**Why the types are a hand-kept mirror, not a shared import:** 616 Survivor
and Spend It All are separately deployed apps in separate repos with no
shared build step between them (no monorepo, no published package). Rather
than wait on that infrastructure, `game/lok/types.ts` duplicates the spec's
TypeScript shape by value. `schemaVersion` is the field that exists
specifically to catch drift if the two copies ever diverge -- bump it on
both sides together if the contract changes, never on just one.

**Why card ownership is derived, never separately stored:** `game/data/cards.ts`
computes `LokAssetManifest[]` from the roster/bestiary/crew/LokPet data
records that already exist (`CHARACTERS`, `ENEMIES`, `ALLIES`,
`LOKPET_VARIANTS`), and `isCardOwned(card, meta)` reads *existing* `MetaState`
fields (`unlockedCharacterIds`, `bestiary`, `rescuedAllyIds`, `lokPetCatalog`,
`endlessDiscoveryIds`, `endlessRecordDistancePx`) rather than adding a new
`ownedCards` array to persist and keep in sync. This follows the same
pattern `data/achievements.ts` established (`AchievementDef.isComplete(meta)`
as a pure function, see `achievements-unlockables-plan.md`) and means a card
can never desync from the progression state it represents. If a future pass
adds genuinely tradeable/unique card instances (per-roll LokPet cards with
their own `generationSeed`, matching the spec's "definition vs owned
instance" distinction), that's new persisted state and should live in
`MetaState` the same deliberate way `savedLokPets`/`lokPetCatalog` do --
don't retrofit it into `isCardOwned`.

**Ally cards use `kind: 'companion-profile'`, not `kind: 'card'`:** the spec
reserves `companion-profile` for exactly this case -- a presentation/behavior
asset referencing a character, meant to appear as an advisor in another
G-Six game. Card ownership alone never implies advisor behavior in 616
Survivor itself; nothing here wires ally cards into any in-run system.

**Endless-mode cards are the concrete "TCG × endless mode" link:**
`ENDLESS_BAND_CARDS` (one per `EndlessBandId`, owned once
`meta.endlessDiscoveryIds` contains that band) and `ENDLESS_MILESTONE_CARDS`
(distance thresholds against `meta.endlessRecordDistancePx`) are the reward
surface tying endless-mode progress to the card binder. Both reuse
already-persisted lifetime endless stats -- no new endless-mode state was
added to grant them.

**Endless-mode content expansion:** two new `ChunkVariant`s, `scrapyard` and
`overpass` (`engine/chunks.ts`), reuse only existing `ObstacleDef` kinds, so
none of the cross-cutting checklist in the root CLAUDE.md (`BREAKABLE_HP`,
`PUSHABLE_KINDS`, `OBSTACLE_COLORS`, chunk `sizes` table) applies -- only
`VARIANTS`, `propCounts`, and `kindWeights` needed new entries, plus two new
`ChunkLandmarkKind` values with their own render branches in
`render/draw.ts`'s `drawChunkLandmark`-style function (the *other* landmark
renderer in the same file, used for district setpieces, has an unrelated
`kind` union — `'market' | 'rail-yard' | 'plaza' | 'floodgate'` — and must
not be touched when adding a `ChunkLandmarkKind`; the two "landmark" concepts
share a name but not a type).

**Where the card binder lives:** `ui/ArchivePanel.tsx` gained a "Cards" tab
following the existing Achievements-tab pattern (rarity-colored left border,
owned/locked styling, no new panel component).

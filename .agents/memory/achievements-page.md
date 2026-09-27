---
name: Achievements page (built)
description: The achievements/unlockables system from achievements-unlockables-plan.md, now implemented as a tab inside ArchivePanel.
---

# Achievements Page

Implements `achievements-unlockables-plan.md`'s design, closely: `data/achievements.ts`
holds `AchievementDef`s as pure functions over `MetaState` (`isComplete`/`progress`),
never a stored boolean, so a corrected counter or a changed threshold
retroactively re-evaluates. The plan's one exception still holds: a currency
reward must pay out exactly once, so `MetaState.claimedAchievementIds` and the
`claimAchievement` reducer action (`state/metaStore.tsx`) track that
separately, mirroring how `buyGenerator` settles currency before spending it.

Landed as a tab inside `ArchivePanel.tsx` (the plan's suggested "natural
sibling section" option), not a new screen/route — one more `ACHIEVEMENTS.map`
grid alongside the existing Workshop/LokPets/History/Crew tabs, using the same
`ScreenLayout`/card conventions. `claimAchievement` is exposed through
`useMeta()` next to the other currency-affecting actions (`buyGenerator`,
`spendTokens`).

Every achievement threshold is built from counters `MetaState` already
tracked before this pass (`totalKills`, `bestSurvivalSec`, `clearedAreaIds`,
`rescuedAllyIds`, `bestiary`, `knownRelicIds`, `lokPetCatalog`,
`endlessRecordDepth`, `unlockedEvolutionIds`, `ownedGeneratorIds`,
`unlockedCharacterIds`) — no new engine work, no new lifetime counter. Reward
kind is deliberately restricted to `cred`/`lootTokens` for this pass (not the
plan's `hat`/`runAura`/`celebration`), since granting a cosmetic id needs the
same "add to owned Ids" wiring each cosmetic shop already has per-type; that's
a reasonable follow-up but out of scope for a first pass.

`achievements.test.ts` checks: ids are unique, every reward pays a positive
amount, a freshly created save has zero achievements complete (so an
`isComplete` never has an inverted/off-by-one comparison that's trivially
true), and the claim reducer pays out exactly once and no-ops on an
incomplete or unknown id.

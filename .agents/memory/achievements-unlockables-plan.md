---
name: Achievements/unlockables page (design plan, not yet built)
description: Data model and UI plan for a future achievements page, derived from existing lifetime counters. No engine or UI code exists for this yet.
---

# Achievements / Unlockables Page — Design Plan

Scoped as a plan only (per an explicit "plan for" request in the run-modifiers
expansion) — nothing in this doc is implemented. Read this before building it
so the shape doesn't need to be re-derived.

## What already exists to build on

There is **no achievement/trophy/flag system today**. The only thing named
"milestone" in the codebase (`LOOT_BOX_MILESTONES` in `engine/world.ts`) is
kill-count loot box drops, unrelated to progress tracking.

What `MetaState` (`state/metaStore.tsx`) already tracks that an achievement
list can threshold off of, with zero new engine work:
- `totalKills`, `totalRuns`, `bestSurvivalSec` — lifetime counters.
- `bestiary: Record<enemyId, killCount>` — per-enemy kill counts; `BestiaryPanel.tsx`
  already computes a "caught / total" ratio from this.
- `clearedAreaIds`, `discoveryIds`, `rescuedAllyIds`, `completedEpisodeIds`,
  `unlockedEvolutionIds`, `knownRelicIds`, `completedDailyContractIds` — id lists.
- `lokPetCatalog` — variants/rarities/traits ever seen (see `lokPets.ts`).
- `endlessRecordDistancePx`, `endlessRecordDepth` — endless-mode bests.
- New from this expansion: `ownedGeneratorIds` (passive income), and per-run
  HordeSpin outcomes could be tallied the same way if a lifetime counter is
  added later (e.g. `hordeSpinTiersHit: Record<HordeSpinTierId, number>`).

## Proposed data model

Add one new file, `data/achievements.ts`, plain records (matches the
project's "content is data" rule):

```ts
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  /** Pure function over MetaState -- no stored "unlocked" flag, so a
   *  changed threshold or a corrected counter retroactively re-evaluates
   *  instead of needing a migration. Mirrors how `isUnlocked()` already
   *  evaluates `UnlockRule` against MetaState on every read. */
  isComplete: (meta: MetaState) => boolean;
  /** 0..1 for a progress bar on incomplete achievements; omit for a binary flag. */
  progress?: (meta: MetaState) => number;
  reward?: { kind: 'cred' | 'lootTokens' | 'hat' | 'runAura' | 'celebration'; id?: string; amount?: number };
}
```

Deliberately **not** a stored boolean per achievement: every existing unlock
concept in this codebase (`UnlockRule`, vendor purchase gating) is evaluated
live off `MetaState`, never cached as a separate "already unlocked" flag.
Keeping achievements the same way means no new save-migration surface and no
risk of a counter and its flag drifting apart.

The one exception: a reward that grants something consumable (cred, a loot
token) must fire exactly once. That needs a small persisted set,
`meta.claimedAchievementIds: string[]`, checked/updated the same way
`lootBoxMilestonesHit` guards a one-time drop in `engine/world.ts`.

## UI

A new `AchievementsPanel.tsx` in `src/ui/`, following `BestiaryPanel.tsx`'s
existing "caught / total" layout conventions (grid of cards, locked cards
grayed out per the `LockedCharacterTile` pattern in `CharacterSelect.tsx`).
Entry point: a new hub room button or a tab inside `ArchivePanel.tsx` (which
already aggregates read-only lifetime stats from `MetaState` — an
achievements grid is a natural sibling section there rather than a wholly
separate screen).

## Suggested first achievement set (illustrative, not final)

- Survive a full HordeSpin 666 horde (needs the `hordeSpinTiersHit` counter above).
- Clear an area with every run modifier in this expansion turned on at once.
- Own all three passive-income generators simultaneously.
- 100% Bestiary completion (already computable from `meta.bestiary` today).
- Reach endless-mode tier 10 (`endlessRecordDepth`).

## Why this wasn't built now

Scoped out of the run-modifiers expansion at the requester's explicit
direction ("plan for achievements/unlockables page") to keep that PR
reviewable; the data model above is intentionally small so a follow-up pass
can implement `data/achievements.ts` + `AchievementsPanel.tsx` without
touching the simulation loop.

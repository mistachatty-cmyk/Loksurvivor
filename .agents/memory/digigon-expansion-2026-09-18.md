# The Digigon Expansion — 2026-09-18

"Digigon Expansion" (Digi- + dungeon) is the user's name for the overall
dungeon-content push: more eras, per-era bosses with health bars and unique
attacks/visuals, a DigiBoost/Digi-Flower/Digi-Flower Seed reward economy,
LokSplosion (enemies explode on kill, for a limited time, archivable and
buyable), rare dungeon-exclusive cosmetics, and crystal/pickup explosion
physics — all discussed and pocketed as a written plan, **not yet built**.

The two parts shipped so far are meta-progression foundations the user
explicitly asked to fold into this same initiative, built before any of the
flashier dungeon-specific content above.

## Part 1 — Persistent Player Level (shipped, PR #101)

- `meta.totalLevelUps`: a lifetime count of every level-up across every run,
  ever — never resets. Folded in by `completeRun` as `result.level - 1`.
- `playerLevelProgress(totalLevelUps)` in `state/metaStore.tsx` re-runs that
  count through an uncapped, progressively-harder curve
  (`levelUpsForPlayerLevel`) to derive a persistent "Player Level" distinct
  from the in-run level, which resets every run.
- Surfaced on the Hub (an animated bar widget), a new "Stats" chapter in
  `ArchivePanel.tsx` (unifying previously-scattered lifetime counters), and
  an animated reveal in `RunSummary.tsx`'s highlights section.

## Part 2 — Per-character Mastery (shipped, PR #102)

- `meta.characterLevelUps: Record<characterId, number>` — the same idea,
  scoped per character instead of account-wide. Folded in by `completeRun`
  exactly like `fatigueByCharacter` (same map-per-character shape).
- `characterLevelProgress(meta, characterId)` derives each character's own
  mastery level from a gentler curve (`levelUpsForCharacterLevel`) than the
  player-level one, since a single character accumulates level-ups more
  slowly than the account-wide total.
- `data/characterMastery.ts`: a small, **shared** (not hand-authored per
  character — there are 59 of them) declarative table of permanent stat
  bonuses that scale with mastery level, reusing the exact stacking
  `{ stat, add?, mult?, cap? }` shape `VENDOR_CATALOG` already uses in
  `effectiveStats()`; plus Rookie → Veteran → Elite → Legend → Mythic rank
  titles (`characterRankTitle`).
- Surfaced as a roster-tile `Lv N` badge, a mastery indicator in the
  character detail panel (`CharacterSelect.tsx`), a parallel reveal in
  `RunSummary.tsx` alongside the player-level one, a new "Mastery" chapter
  in `ArchivePanel.tsx` listing every operative sorted by level, and a
  one-time `pendingNotifications` entry when a character's rank *title*
  changes (not every level, to avoid spamming the queue).

## Still pending (design only, not started)

The original dungeon-content backlog this expansion is named for: more
eras, per-era bosses (health bars, unique attacks/visuals, spawns), the
DigiBoost/Digi-Flower/Digi-Flower Seed/LokSplosion reward economy tied into
a unified boss-chest loot pool (including Lock Packs), rare dungeon-exclusive
cosmetics (would need a new `UnlockRule` kind), and pickup/crystal explosion
physics. Do not start any of this without the user explicitly picking a
phase — it was deliberately "pocketed for later."

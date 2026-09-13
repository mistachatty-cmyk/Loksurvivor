---
name: Character mastery, checklists, and milestone prestige skins
description: A per-character prestige level (from lifetime kills) that unlocks fixed Onyx/Ivory/Ascendant skins, plus a completionist checklist and new achievements built on it.
---

# Character Mastery & Milestone Skins

Requested as "more achievements, a checklist per character, per-map
completion, and mastery levels 100/500/1000 unlocking increasingly wild
skins (black+gold, white+gold, then a translucent+gold Ascendant tier),
with a new system for special skins." Built as three small additions on
top of the existing achievements/skins architecture rather than a parallel
system, since both already existed and matched the shape needed.

## Mastery level: a divisor over a new lifetime counter, not a curve

`MetaState.killsByCharacter: Record<characterId, number>` is a new lifetime
counter, incremented in `completeRun` exactly like `totalKills` already is,
just partitioned per character. `data/characterMastery.ts`'s
`characterMasteryLevel()` is `Math.floor(kills / 25)` -- a flat divisor, not
an XP curve, because nothing reads any level other than 100/500/1000 and a
curve would be complexity with no observable effect. Like every other
unlock in this codebase (`isUnlocked()`, `AchievementDef.isComplete`), it is
a pure function over `MetaState`, never a stored level, so a corrected kill
count retroactively re-levels instead of drifting.

`MetaState.clearedAreaIdsByCharacter: Record<characterId, string[]>` is the
per-character sibling of the existing global `clearedAreaIds`, populated the
same way (only on `result.cleared`). It drives both the "clear every
district as X" checklist item and the `one-character-tour`/`borough-hopper`
achievements.

## Milestone skins reuse the existing skin system, not a parallel one

`data/characterSkins.ts`'s `CharacterSkinDef` already had one gate
(`episodeRequired`) and one owner-selected slot per character
(`MetaState.characterSkinByCharacterId`). Rather than build a second
"which skin is active" state, the three new tiers (`onyx`/`ivory`/
`ascendant`) are just three more entries from `getCharacterSkins()` --
skins length went from 4 to 7 (see `customizationCatalog.test.ts`) -- each
carrying a `requiredMasteryLevel` instead of `episodeRequired`.
`isCharacterSkinUnlocked()` is the one place that checks either gate; both
`normalizeMeta`'s skin-restore pass and the `selectCharacterSkin` reducer
call it instead of duplicating the check (they used to duplicate the
episode check inline in two places -- consolidated as part of this change).

Every milestone skin's colorway is fixed (ignores the character's own hue)
so Onyx/Ivory/Ascendant read as the same reward across the whole roster,
unlike the four personal skins which are each derived from the character's
own palette. Each also sets `blendWorldPalette: false`:
`resolveCharacterCosmeticPalette()` checks this flag before applying the
global Artisan world-palette blend, because a prestige reward should never
be re-tinted by whatever palette happens to be active.

## The Ascendant skin's transparency needed no renderer change

The Ascendant (Mastery 1000) tier's `body`/`bodyDark`/`skin` colors are
literal `rgba(...)` strings. `drawPartsSlow` in `render/sprite.ts` does
`ctx.fillStyle = palette[part.color]`, and canvas `fillStyle` accepts any
CSS color -- so this alone renders a genuinely translucent silhouette with
zero engine changes. The tier's `ink` is left fully opaque and bright gold
instead, because `outline: true` fills `palette.ink` behind every part
before the (now translucent) part color -- so the existing outline
mechanism doubles as the "gold trim" the reward is supposed to have, again
with no renderer change. One consequence: `blendSpritePalettes()`'s
`mixColor()` assumes 6-digit hex and would silently produce garbage (white)
if it ever ran on an `rgba()` string -- this is exactly why milestone skins
must keep `blendWorldPalette: false` rather than being an optional nicety.

## Checklist: computed, not a new "is this done" system

`characterChecklist()` in `characterMastery.ts` returns items for: the
character's episode (only if one exists for them), each of the three
mastery tiers, and clearing every district with them. It reads only
existing/new counters -- no new "completed" flags. Surfaced as a new
"Checklists" tab in `ArchivePanel.tsx` (one card per character, all 48
listed, locked ones show their unlock rule instead of checklist items) and
via a compact "Mastery Level N · kills" line plus a "next milestone" hint
in `CharacterSelect.tsx`'s existing skins panel. Crossing a tier mid-run is
reported through `RunResult.newlyUnlockedSkinIds` (computed in
`completeRun` by comparing mastery level before/after that run's kills) and
rendered in `RunSummary.tsx` next to the other "you unlocked something"
cards.

New achievements in `data/achievements.ts` (`made-guard`,
`made-guard-five`, `white-collar`, `ascendant-mastery`, `borough-hopper`,
`one-character-tour`, `model-citizen`, `true-616`) are deliberately *not*
one entry per character x tier (48 characters x 4 would be ~190 entries) --
each is one account-wide achievement built from `CHARACTERS.some(...)` /
`.every(...)` over the same mastery/checklist functions, so the flat
`ACHIEVEMENTS` grid stays a curated list instead of an exploded matrix; the
per-character granularity lives in the Checklists tab instead.

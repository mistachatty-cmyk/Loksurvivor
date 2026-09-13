---
name: Reveal-on-visible catch-up counters
description: Persistent lifetime numbers (bestiary kills, cred, loot tokens, mastery kills) stay frozen at their last-seen value and catch up to the true value the instant they're actually looked at, never on a raw match-end update.
---

# Reveal-On-Visible Catch-Up Counters

Requested behavior: a lifetime stat earned mid-run (bestiary kills, cred,
loot tokens, character mastery kills, ...) should not silently jump the
moment a run ends. Instead it stays frozen at whatever value the player
last actually watched it animate to, and catches up -- via the existing
count-up tween -- the instant it's genuinely looked at again: opening a
page that already shows it, or scrolling one into view. Unwatched deltas
across several runs simply queue up and get animated through in one pass
whenever that finally happens.

## Design: a last-seen ledger, not a delta log

New persisted field `MetaState.revealedStats: Record<string, number>` is
the *only* new state -- one number per tracked stat key, the last value
that stat has actually been shown catching up to. "Pending delta" for any
stat is just `trueValue - revealedStats[key]`; nothing needs to log
individual per-run deltas, which is what makes "stacking" free: the ledger
entry just sits stale while the real counter keeps climbing underneath it.

Key naming: fixed keys for singular stats (`cred`, `lootTokens`,
`skeletonKeys`, `totalKills`, `totalRuns`), prefixed keys for per-id stats
(`bestiary:<enemyId>`, `mastery-kills:<characterId>`, `mastery-level:<characterId>`).
Normalization (`normalizeRevealedStats` in `metaStore.tsx`) does *not*
validate keys against a real enemy/character id set the way `bestiary`/
`killsByCharacter` do -- unlike those, this field has zero gameplay
meaning, so an orphaned key is inert. It only bounds shape/size (500-entry
cap, key length cap) against a corrupted or hand-edited save.

A brand-new key (a save from before this shipped, or a stat added later)
defaults to the stat's *current* true value the first time it's read,
never 0 -- otherwise every existing save's whole stat sheet would "catch
up from zero" in one big reveal wave the moment this shipped.

**Never read by game logic.** `isUnlocked()`, achievement `isComplete()`,
`buyVendorItem`'s affordability check, and the mastery-skin unlock check
all keep reading live `MetaState` fields. This system only decides what
gets painted this frame -- worst case is a stale display, never a wrong
game state. Currency shown next to an actual spend decision (Vendor item
costs, achievement Claim buttons) deliberately bypasses this system
entirely and always renders the live value -- see `VendorPanel.tsx`, left
untouched on purpose.

## Mechanism: `useRevealingStat` wraps the existing `useCountUp`, unchanged in spirit

`useCountUp` (`src/hooks/useCountUp.ts`, from the RunSummary count-up pass)
already tweens a displayed number from wherever it sits to a new `target`
whenever `target` changes, in either direction. `useRevealingStat` feeds it
`meta.revealedStats[key] ?? trueValue` as that target, and attaches a
single shared-pattern `IntersectionObserver` (one per stat instance, not
literally shared, but the same lightweight setup each time) to the
consuming element; the instant the element is >=40% visible, it dispatches
`revealStat(key, trueValue)`, which updates the target and persists the
catch-up. This covers "opened the page" (already-visible elements fire
immediately, since `IntersectionObserver` always calls back once with
current state right after `observe()`) and "scrolled it into view"
identically, on desktop and touch alike -- no separate hover/tap logic
needed. A plain hover still counts too, incidentally, since the element is
already visible by the time a pointer could reach it.

`RevealingNumber.tsx` is the JSX wrapper, same relationship `AnimatedNumber`
has to `useCountUp`. Swapped in at: `HubScreen.tsx` (cred, totalRuns,
totalKills, both loot-token banners, both skeleton-key banners),
`BestiaryPanel.tsx` (per-enemy kill count), `CharacterSelect.tsx` (mastery
level and kills). `VendorPanel.tsx`'s currency display is the one
deliberate exception (see above).

## Bug found and fixed while building this: `useCountUp` could get stuck silently

`useCountUp`'s tween only called `setDisplay` from its `update` callback.
Under real load right at mount -- exactly the scenario this feature hits
constantly, since it animates the instant a page mounts rather than after
the page has settled -- anime.js's very first scheduled animation frame
can land so late that the whole tween's elapsed time already exceeds its
duration, so it fires `complete` directly without ever calling `update`.
`display` then stays stuck at its initial value (0) forever, even though
the underlying tweened value did reach `target`. Fixed by also calling
`setDisplay(target)` from `complete` -- a no-op in the normal case, a
guaranteed correct final value in the starved-first-frame case. This was
latent in the original RunSummary usage too (it just never mounted a
`useCountUp` instance competing with a page's own initial load), so the
fix benefits both call sites.

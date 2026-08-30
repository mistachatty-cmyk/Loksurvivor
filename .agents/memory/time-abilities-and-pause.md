---
name: Time abilities, timeless runs, and the pause read model
description: Why run speed is one clamp, why the pause menu owns no clocks, and why track identity rides the beat bus.
---

# Time abilities and the pause read model

**Run speed is decided in exactly one place, and clamped once.**
`resolveTimeMultiplier` in `world.ts` multiplies the base scale by the active
time ability and clamps the *product* into `[MIN_TIME_SCALE, MAX_TIME_SCALE]`
(0.5–1.5). This mirrors the endless-mode difficulty caps: a new time modifier
composes inside that single clamp, it is never a second multiplier layered on
the result. `stepWorld` scales its `dt` by the resulting `w.timeMultiplier`
and nothing else reads the raw frame delta, so every timer, cooldown and
animation in the run bends together.

**Time abilities have no cooldown of their own.** Slack Time (0.7x) and
Overdrive (1.4x) are ordinary `UpgradeDef` records whose `timeScale` effect
sets `w.timeAbilityMult`; the ability is live only while the character's
ultimate is, and its `ultimateCooldown` effect tunes that one existing
cooldown. Adding a parallel cooldown would give the player two recharge bars
meaning the same thing.

**"Timeless" locks composition, not difficulty.** The contract holds
`cycle.phase` where it stood and pins wave-window selection to
`w.timelessAtSec`, and in endless mode pins the band's *enemy pool*. The
distance-driven tier — and so the capped spawn rate and hp — keeps escalating,
because freezing the hour is a change of flavour, not a way to farm a
stationary run.

**Contracts are unlocked through the shared evaluator.** `isUnlocked` moved
into `state/unlocks.ts` (re-exported by `metaStore`) purely so content modules
like `data/vendor.ts` can reach it without importing the store that already
imports them. There is still one implementation of "unlocked", and the
development all-unlocks switch reaches contracts exactly as it reaches
characters, areas and hub rooms.

**The pause menu runs no clocks.** Every entry in `HudSnapshot.playerEffects`
reports `remainingMs` from the timer that already owns the effect —
`ultActiveUntil`, `stealthUntil`, `rumorSpeedUntil`, a fluid tile's
`expiresAt`. The menu reads the live snapshot the run loop keeps publishing
rather than a copy taken when the pause opened, so nothing goes stale and
nothing drifts against the simulation. The player deliberately still has no
persisted status-effect list of its own; adding one would duplicate state that
these timers already hold.

**Track identity rides the beat bus.** `AudioFrame.track` is published by the
music player on every track change, so the now-playing cue learns about a new
track from the same seam it would read a beat from — there is no second
detection path. The cue is render-only: it subscribes at UI rate and never
touches the simulation, and the run loop's single `beatBus.read()` per frame
is unchanged.

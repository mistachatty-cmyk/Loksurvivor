---
name: Run presentation layer -- pickups, enemy scale, new silhouettes
description: Value-tiered XP gems, the EnemyDef.sizeClass render hook, and the arachnidRig/serpentRig factories -- plus the palette-collision check every new "themed" character needs before it ships.
---

## Value-tiered XP gems (`draw.ts`)

`drawPickups`'s `'xp'` case used to render one fixed cyan diamond regardless
of `pickup.value` -- a 2xp drop and a 140xp boss drop looked identical. Fixed
with `XP_GEM_TIERS` / `xpGemTier(value)`: four tiers (spark/shard/gem/prism)
by value threshold, each with its own size, color, glow blur, and idle pulse
amplitude. `shard` (value 4-9) intentionally reproduces the original look
exactly, so most normal-enemy drops are visually unchanged; only genuinely
big drops (10+, 20+) escalate. `prism` (20+, e.g. the Boss's 140xp) also gets
two orbiting sparkle pixels, reusing the same satellite-dot idiom the
`'sweep'` pickup already used.

Every pickup also gets a ~180ms grow-in ("pop") on spawn now, keyed off
`pickup.bornAt`, so appearing doesn't feel inert. There's no fade-on-despawn
counterpart -- pickups never expire (`updatePickups` only ever removes them
by collection), so "fade" doesn't apply here; it would if a future pickup
kind ever gets a lifetime.

This system is XP-only by design decision, not oversight -- `cred`/`health`/
`coin` pickups keep their original flat look.

## `EnemyDef.sizeClass` (render-time scale, not balance)

`sizeClass?: 'mini' | 'standard' | 'elite' | 'giant'` feeds `SIZE_CLASS_SCALE`
in `draw.ts`, applied as a multiplier alongside the existing
`radius / baseRadius` term in the sprite's draw call. It is **purely visual**
-- it does not touch `hp`/`xp`/`radius`/collision, all of which stay
hand-authored per enemy exactly as before. Before this field existed, only
`family === 'Boss'` got a hardcoded +55% scale bump (`sizeClassScale()` keeps
that exact fallback for any enemy that never sets the field, so all
pre-existing content renders identically). Setting `sizeClass: 'giant'` also
now grants the outline treatment that used to be Boss-only.

Not every enemy needs this tagged -- only set it where the intended visual
size clearly reads as mini/elite/giant (see `ring-runner`/`belfry-bat` for
mini, `crypt-bouncer`/`smoke-horn` for elite, `the-sire` for giant). A
mid-sized enemy with an unremarkable radius doesn't need a class at all.

## New rig factories: `arachnidRig`, `serpentRig` (`sprites/rigs.ts`)

Both are built entirely from the four existing limb `PartKey`s
(`legL`/`legR`/`armL`/`armR`) -- **no new `PartKey` was added to `types.ts`**.
The trick: `SpriteRig.parts` is an array, and `drawRig` looks up each part's
animation delta by `part.key`, so multiple `SpritePart`s can share one key
and all receive the same per-frame transform. `arachnidRig` pushes N leg
pairs onto just `legL`/`legR` (so `legPairs: 4` still only needs the walk
clip to know about two sides, not eight legs); `serpentRig` alternates body
segments across `legL`/`legR` as two phase groups so opposite segments bob
oppositely -- a real slither, not a rigid block. This pattern is the
reusable answer to "I want a silhouette with more than two limbs": extend
key reuse before reaching for a new `PartKey` and touching every switch that
already exhaustively matches the union.

`arachnidRig` reuses `baseAnims()` unchanged (its stock walk cycle already
alternates `legL`/`legR`, which is exactly what a multi-legged scuttle
needs). `serpentRig` overrides `idle`/`walk` with a custom two-frame
undulation.

## Palette-collision check -- do this before authoring a "themed" character

When `hoarfrost` and `sleet` were first authored (a "cold biome" themed
pair), both used saturated ice-cyan palettes and both weapons carried
`statusEffectId: 'freeze'` -- without checking the existing roster first.
Turned out **two characters already own that exact niche**: `glacierwarden`
(default-unlocked, cyan/blue humanoid, staff, freeze) and `glass-eel` (teal,
freeze on its blink). Four characters all reading as "blue ice guy with
freeze" would have directly undercut the entire point of a themed content
pass -- distinctiveness.

Fixed by re-grepping `characters.ts` for the theme's obvious keywords
(`frost|glacier|winter|snow|blizzard|ice|freeze`, case-insensitive) *before*
finalizing, then deliberately diverging: `hoarfrost` moved to bone-white/
silver (rime frost is white, not blue -- also just a truer reference for the
name), `sleet` moved to electric violet and dropped `freeze` entirely (a
third crowd-control source would have been redundant; it's now a pure
high-damage burst weapon instead, which is also a distinct mechanical niche
from both existing ice characters).

**The lesson, generalized:** before authoring any new character (or enemy,
or area) around a stated theme, grep the relevant data file for that theme's
keywords first. Silhouette and mechanics can be planned in isolation; palette
and status-effect identity cannot -- they only collide with what already
exists, so the existing roster has to be checked, not just the new record.

## Cold-biome roster, wave one

`hoarfrost` (arachnidRig, 6 legs, bone-white, `wave`-kind AoE crowd-lock,
`kills: 120` unlock) and `sleet` (serpentRig, violet, `laser`-kind burst
damage, `kills: 190` unlock) are the first two characters in what's meant to
be an eventual cold-biome area's cast -- no area/biome data shipped yet,
this pass was silhouettes and mechanics only. The next pass (an actual cold
biome `AreaDef`, its own enemy roster, ground/sky treatment) should read
this file's palette-collision section again before adding a third
character to the set.

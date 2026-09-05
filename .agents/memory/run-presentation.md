---
name: Run presentation layer -- pickups, enemy scale, new silhouettes, weapon design
description: Value-tiered XP gems, the EnemyDef.sizeClass render hook, the arachnidRig/serpentRig factories, the palette-collision check every new "themed" character needs, and three new weapon mechanics -- multi-node hazard rings, elemental-synergy bonus damage, telegraphed sky strikes, and a draggable cycling-element cloud companion.
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

`hoarfrost` (arachnidRig, 6 legs, bone-white, `hazard`-kind ring-of-anchors,
`kills: 120` unlock) and `sleet` (serpentRig, violet, `laser`-kind wet/arc
combo, `kills: 190` unlock) are the first two characters in what's meant to
be an eventual cold-biome area's cast -- no area/biome data shipped yet,
this pass was silhouettes and mechanics only. The next pass (an actual cold
biome `AreaDef`, its own enemy roster, ground/sky treatment) should read
this file's palette-collision section again before adding a third
character to the set.

## Weapon design pass: three new mechanics, not skins

A follow-up request explicitly asked for better *weapon design* (mechanics,
FX, telegraph) rather than cosmetic skins, and for `hoarfrost`/`sleet`'s
original weapons specifically to be reworked as part of it. Two lessons and
three new systems came out of it.

**Niche-collision check applies to weapon mechanics too, not just palette.**
The first draft of a "meteor from the sky" character was an astronomer --
until a grep of `characters.ts` turned up `orbitanchor` ("a compact
astronomer with a pocket-sized sky", gold-violet, `expressiveRig('astral')`)
already owns that exact archetype. Rebuilt as `foreman`, a demolition
foreman who drops debris from an unseen crane instead -- same weapon
mechanic, unrelated lore and silhouette. The rule from the palette section
above generalizes: grep for a concept's obvious keywords before committing
to it, whether the collision risk is color, status effect, or archetype/lore.

### Hoarfrost's redesign: hazard rings + `web` connector effects

`hazard`-kind weapons (`fireWeapon`'s `case 'hazard':`) now read
`runWeapon.count`: `count` 1 (the default, and every pre-existing hazard
weapon -- Emberback, Acid Botanist, the Crystal Lattice relic evolution --
is unaffected) places a single field at the player's feet exactly as
before; `count > 1` spreads that many fields into a ring around the player
instead of stacking them on top of each other, and connects adjacent nodes
with new `'web'` effects (a thin ambient line, `EffectKind` -- `x`/`y` is
the start point, `angle`+`radius` gives the end point, same convention
`'laser'` already uses). `rime-web` sets `count: 3` for exactly this: three
freeze anchor nodes linked by visible strands, "lays a web across the
block" made literal. Any future ring/web-style hazard weapon gets this for
free by just setting `count`.

### Sleet's redesign: elemental-synergy bonus damage

New `Effect`/`WeaponDef` fields: `bonusVsStatusId` + `bonusVsStatusMult`.
Applied in the single shared hit-application block in `updateEffects` (the
one that already handles `slash`/`wave`/`laser`/`impact` — see
`damageEnemy()`'s status as the *other* single choke point noted in
`types.ts`'s header comment) — if the target already carries
`bonusVsStatusId`, the hit's damage is multiplied by `bonusVsStatusMult`
before `damageEnemy` is called, and a white spark burst marks the proc.
`arc-sleet` applies `wet` on hit *and* checks `bonusVsStatusId: 'wet'`
(mult 1.9): the first hit on a dry target just wets it, a hit on an
already-wet target detonates. This is a real elemental combo instead of a
flat status tag, reads as "electricity conducts through water" without any
narrower special-casing, and doesn't compete with Hoarfrost's freeze --
distinct crowd-control niches on purpose.

### `'meteor'` weapon kind -- telegraph, then a strike from off-screen

New `World.pendingMeteors: PendingMeteor[]` (`{ x, y, telegraphAt, impactAt,
radius, damage, impactIntensity, statusEffectId, color }`). `case 'meteor':`
in `fireWeapon` picks a target (a random enemy in range, or a point near the
player if the block is empty -- never a no-op) and queues a strike;
`updateMeteors` (called from `stepWorld` alongside `updateEffects`) resolves
it once `w.now >= impactAt` via the existing `novaDamage`/`damageBreakable`
helpers, same as any other AoE. The entire visual -- ground reticle, then a
falling comet streak for the final 260ms -- is derived purely from those
timestamps in `drawPendingMeteors`; there's no separate visual entity to
desync. `foreman`'s `drop-zone` weapon uses it. A character's `ultimate`
cannot spawn meteors the same way: `activateUltimate` is 100% generic
(every character's ultimate uses only the shared `effect` shape --
`damageMult`/`speedMult`/`cooldownMult`/`invulnerable`/`novaDamage`/
`novaRadius`, no character-id branches anywhere in it) and adding a
special case there would break that invariant, so `foreman`'s ultimate is
a standard nova+buff instead of a literal "meteor shower."

### `CharacterDef.stormCloud` -- a draggable, auto-cycling companion

The one genuinely new *input* surface this pass, not just a new weapon
case. `StormCloudConfig` (`grabRadius`, `effectRadius`, `tickMs`, `cycleMs`,
`rainDamage`/`fireRainDamage`/`acidRainDamage`) is an opt-in `CharacterDef`
field; `World.stormCloud` is the runtime instance (`null` for every
character that doesn't set it). Two independent halves:

- **Passive (always works, every input method):** `updateStormCloud`
  cycles `rain -> fire-rain -> acid-rain` automatically on `cycleMs` --
  *not* by tap count, deliberately, so it behaves identically on
  keyboard-only play as on touch. Each mode ticks its own status
  (`slow`/`burning`/`acid`) and damage into anything under the cloud on
  `tickMs`. When not being dragged, the cloud drifts in a lazy Lissajous
  orbit near the player (`sin`/`cos` of `w.now` at different periods) so it
  reads as floating, not clamped to a fixed offset.
- **Active (optional, precision play):** `RunScreen`'s pointer handling
  gained a fourth `PointerMode`, `'cloud'`, alongside the existing
  `'none'`/`'stick'`/`'object'`. `handlePointerDown` checks -- *before* the
  movement-stick fallback, using the same screen-to-world conversion the
  physics-object-priming branch already does -- whether the pointer landed
  within `grabRadius` of `world.stormCloud`'s current position; if so it
  sets `dragging = true` and mode `'cloud'` instead of starting the
  movement stick. `handlePointerMove` then writes `targetX`/`targetY`
  directly onto `world.stormCloud` (mutating the ref'd world object is the
  established pattern here -- `dashPlayer` already does the same); the
  cloud's position always *lerps* toward that target in `updateStormCloud`
  rather than snapping, so a drag never teleports it and releasing leaves
  it drifting smoothly from wherever it was let go.

`storm-chaser` is the first character to use it. Any future character
could opt in by setting `stormCloud` on their `CharacterDef` -- the whole
mechanic is generic, not hardcoded to this one character.

#### Follow-up pass: manual mode control, `frost-rain`, and ground painting

A later request wanted the player to actually *control* what the cloud is
doing rather than only wait on the auto-cycle timer, wanted a third
element (frost/snow, alongside fire/acid), and wanted the weather to leave
something behind on the ground -- paintable, and washable -- rather than
being a pure instant-tick-to-whatever's-underneath effect. Three additions,
all layered onto the existing two-half design above rather than replacing
it:

- **Manual override, not a replacement for auto-cycle.** `StormCloud` grew
  `autoCycle: boolean` (starts `true`). `setStormCloudMode(w, mode)` is a
  new exported `world.ts` function that sets the mode, resets
  `modeStartedAt`, and flips `autoCycle` permanently `false` -- manual
  choice always wins, for the rest of the run, once taken. `updateStormCloud`
  only advances `STORM_CLOUD_MODE_ORDER` on `cycleMs` `if (cloud.autoCycle)`.
  `RunScreen` renders a small HUD button cluster (`STORM_CLOUD_OPTIONS`:
  Wash/Fire/Acid/Frost, `data-testid="storm-cloud-picker"`), visible only
  when `hud.stormCloud` is set (i.e. only for Storm Chaser), each button
  calling `setStormCloudMode` directly -- a plain DOM button click, so it
  behaves identically across mouse, touch, and keyboard focus+Enter, the
  same input-parity goal the original auto-cycle comment was protecting.
  Players who never touch the picker get the exact original auto-cycling
  behavior; touching it hands over permanent manual control.
- **`frost-rain`:** a fourth `StormCloudMode`, added to
  `STORM_CLOUD_MODE_ORDER` between `acid-rain` and wrapping back to `rain`.
  Applies the existing generic `freeze` status (already used by several
  other weapons/relics -- status effects are shared building blocks, not
  per-character identity, unlike palette/archetype/lore niches) rather than
  inventing a new status. `StormCloudConfig` grew `frostRainDamage` to match
  the existing `rainDamage`/`fireRainDamage`/`acidRainDamage` fields.
- **Ground painting, built on the pre-existing `FluidTile` system** (the
  ground-hazard puddles that already spawn from breaking a fire hydrant,
  car-wreck, ac-unit, or dumpster -- `water`/`oil`/`burning-oil`/`coolant`/
  `runoff`). `FluidKind` gained three modes-as-stains: `fire-storm`,
  `acid-storm`, `frost`. Every `updateStormCloud` tick now *also* paints
  (or refreshes) a matching tile at the cloud's current position via
  `STORM_CLOUD_PAINT_KIND` -- `rain` paints `water`, the other three paint
  their matching stain. The paint step first looks for an existing tile of
  that kind within `tile.radius * 0.5` of the cloud and refreshes its
  `expiresAt` instead of stacking a duplicate; holding the cloud in one
  spot is therefore *how the player controls how long a stain (and the
  damage anything standing in it keeps taking) lasts* -- keep painting it
  and it keeps refreshing, move on and it decays on its own `FLUID_LIFETIMES`
  entry like every other fluid kind. This is also what makes the stain
  outlive the cloud: an enemy that wanders into a scorch mark two seconds
  after the cloud moved on still catches fire, with no cloud tick involved
  at all -- `updateFluids`' existing per-tile enemy loop handles it exactly
  like it already handled `burning-oil`/`coolant`/`runoff`.
- **Washing.** `water` already stripped `chilled`/`irradiated`/`burning`
  off any enemy standing in it (the pre-existing "water washes away other
  ground effects" comment on `fluidSpeedMultiplierAt`) -- that filter list
  grew `acid` and `freeze` too, so painting `rain` over an afflicted enemy
  strips whichever of the three new statuses they're carrying. That only
  cleans the *enemy*, not the *ground* -- so `updateFluids` grew a second
  pass after its main per-tile loop: every `water` tile erases any
  `fire-storm`/`acid-storm`/`frost` tile it overlaps, splicing it out of
  `w.fluids` outright. Deliberately a separate pass rather than folded into
  the per-tile tick loop above it -- it isn't gated behind `FLUID_TICK_MS`
  or a live enemy standing in the stain, so washing the ground works even
  when nothing is there to notice, and it isn't scoped to `oil`/`runoff`
  (those keep their existing, unrelated behavior; only the three new
  weather-stain kinds are washable this way).

`HudSnapshot.stormCloud` (`{ mode, autoCycle }`) is the new read model the
picker UI needs; `StormCloudMode` moved from `engine/world.ts` to
`types.ts` (alongside `StormCloudConfig`) so `HudSnapshot` could reference
it without `types.ts` reaching into the engine layer -- `types.ts` has zero
engine imports anywhere else, and this shouldn't be the first.

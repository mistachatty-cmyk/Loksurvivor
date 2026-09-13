# Zero Day: freeze -> RTS drag-select -> throw

## Why this exists
A request for a character who freezes enemies into inert "stone" objects,
then lets the player drag-select a group of them RTS-style and throw the
whole group at other enemies. Three prior investigations established this
needed genuinely new engine work (not a data record): no box-selection UI
existed anywhere in the codebase, `DashSkillDef` and `UltimateDef.effect`
were both a poor fit (see below), and there was no mechanism for an enemy to
become a carryable/throwable object. Built as a new, self-contained
subsystem following the `stormCloud` precedent (an optional `CharacterDef`
field + dedicated `World` runtime state + its own `PointerMode` branch in
`RunScreen.tsx`), the same shape Storm Chaser's cloud already uses.

## Why not `DashSkillDef` or `UltimateDef.effect`
- `DashSkillDef` (`pulse-shield`/`directional-wall`) models instantaneous,
  autonomous, dash-triggered AoE effects. Freeze-then-throw is a multi-step
  *targeting mode* (cast, then drag, then a second distinct tap) -- nothing
  in that family's contract supports holding state across player input like
  that.
- `UltimateDef.effect` is a flat multiplier/flag bag (`damageMult`/
  `speedMult`/`cooldownMult`/`invulnerable`/`novaDamage`/`novaRadius`),
  always centered on the player and radial. A directional cone that flags
  N enemies as frozen (not damaged) doesn't fit that shape at all. Zero Day
  keeps its own separate `ultimate` (Root Access, a normal invulnerability+
  damage buff) *and* `freezeThrow` as two independent slots.

## The engine pieces (all in `engine/world.ts` unless noted)
- `types.ts`: `CharacterDef.freezeThrow?: FreezeThrowConfig` (coneRangeUnits,
  coneAngleDeg, maxFreezeTargets, freezeDurationMs, castCooldownMs,
  throwDamage, throwSpeed) -- opt-in, same pattern as `stormCloud?`.
- `EnemyActor.frozenUntil`/`selectedForThrow`, `Projectile.carriedEnemyUid?`,
  `World.freezeThrow: FreezeThrowState | null` (lastCastAt, selecting,
  selectionStart/End, selectedUids) -- all new fields, same family as the
  existing `ghostUntil`/`invisibleUntil`/`stormCloud` transient-state fields.
- `castFreezeCone(w)`: cooldown-gated cone query reusing the exact angle-diff
  trig the `'wave'`-kind effect hit-test already uses (`Math.atan2` + wrap
  to `[0, PI]` + compare to half-spread), and the `p.facing > 0 ? 0 : Math.PI`
  direction convention from `directional-wall`'s dash skill -- both copied
  rather than re-derived. Bosses (`enemy.def.family === 'Boss'`) are exempt.
- `updateFreezeSelection(w, startX, startY, endX, endY)`: recomputes which
  frozen enemies fall inside an axis-aligned world-space box every frame
  during a drag; `endFreezeSelectionDrag(w)` ends the drag without clearing
  the selection (the player can still throw it after releasing).
- `throwSelectedFrozenEnemies(w, targetX, targetY)`: converts each selected
  enemy into a `Projectile` with `carriedEnemyUid` set, aimed at the target.
  The source `EnemyActor` stays in `w.enemies` (not deleted mid-iteration)
  but is made inert and unrendered by setting *both* `frozenUntil` and
  `invisibleUntil` far into the future -- reusing the existing
  wraith-hidden render/damage guards instead of inventing a third "in
  flight" state.
- `updateProjectiles`' loop has a dedicated `carriedEnemyUid !== undefined`
  branch, fully separate from the generic pierce/split/evolution machinery
  (none of which applies to a thrown enemy) -- checked first, `continue`s
  past the generic path entirely.
- `resolveThrownEnemyImpact(w, carriedUid, granted, atX, atY)`: on a hit,
  repositions the carried enemy to the impact point (so its death animation/
  particles/loot land where it actually hit, not back at the freeze spot)
  and calls the existing `killEnemy()` -- full normal kill rewards, chosen
  as the "clean combo kill" default. On a miss/expiry, it's spliced out of
  `w.enemies` directly with no kill credit, so flinging enemies into empty
  space can't be farmed for free kills.
- `damageEnemy()` gained one more early-return guard (`frozenUntil`),
  alongside the existing `invisibleUntil` one -- frozen "stone" enemies are
  untargetable by normal weapon damage.
- `updateEnemies()`'s per-enemy loop skips all AI/movement/contact-damage
  for `frozenUntil > w.now` enemies via an early `continue`, zeroing
  `vx`/`vy` first so there's no residual drift.

## Rendering (`render/draw.ts`)
- "Stone" tint reuses `drawRig`'s existing `tint: {color, alpha}` option
  (no new render machinery) -- flat green while frozen, plus the anim clock
  passed to `drawRig` is pinned to `0` so it holds a static pose instead of
  continuing to idle-animate.
- Selected-for-throw enemies get an extra pulsing dashed ring, a second
  conditional draw call alongside the existing `freeze`-status ring.
- A `carriedEnemyUid` projectile renders as the carried enemy's own rig in
  flight (a `drawRig` call using that enemy's def/palette) rather than a
  normal weapon-projectile sprite; falls back to a plain colored circle if
  the enemy record can't be found (defensive, shouldn't happen in practice).

## Input (`RunScreen.tsx`) -- mouse and touch from day one
- New `PointerMode` value `'freezeSelect'`, following the exact `'cloud'`
  precedent: a character-specific block checked early in `handlePointerDown`
  (right after the storm-cloud grab check), which takes priority over the
  default virtual-movement-stick and physics-object-click paths, the same
  way grabbing the storm cloud already does.
- Because the existing handlers already use the Pointer Events API
  (`onPointerDown`/`onPointerMove`/`onPointerUp` on a div already carrying
  `touch-none`), mouse and touch input were unified for free -- no separate
  touch-event wiring was needed. `touch-none` disables the browser's default
  touch gestures (scroll/zoom) on that surface without blocking custom
  pointer-driven drags.
- Flow: the "Freeze" button (new, next to the Ultimate button, shown only
  when `character.freezeThrow` is set) calls `castFreezeCone`. Once frozen
  enemies exist, the next pointer-down enters `'freezeSelect'` instead of
  starting the movement stick; drags update the box (both the world-space
  selection via `updateFreezeSelection` and a screen-space DOM overlay div
  for the visible marquee, sized in `handlePointerMove`); pointer-up locks
  the selection in via `endFreezeSelectionDrag`. A held selection changes
  the *next* pointer-down's meaning entirely: instead of starting another
  drag, it throws at the tapped point via `throwSelectedFrozenEnemies`.
- The selection box itself is a plain `pointer-events-none absolute` div
  (screen coordinates), not a canvas draw call -- confirmed cheap and
  correct by the investigation, since `RunScreen.tsx` already layers several
  such overlay divs over the canvas.

## Scope decisions (recorded, not silently assumed)
- Thrown enemy dies on a hit, full kill rewards. A whiff grants none.
- A frozen-but-unthrown enemy that simply times out just resumes normal AI
  from wherever it is -- no penalty, no bonus, matching how other transient
  traits (e.g. `ghostMs`) already just expire.
- Bosses are exempt from freezing entirely.
- Cap of 7 is enforced nearest-first in the cone query.
- **Cooldown bug caught by the test suite, not by hand**: the initial
  implementation stored `lastCastAt: 0` and checked
  `w.now - lastCastAt < castCooldownMs`, which made the very first cast at
  `w.now === 0` read as "still on cooldown" and silently do nothing --
  `castFreezeCone` returning 0 in a test that expected 1 caught this
  immediately. Fixed by initializing `lastCastAt: Number.NEGATIVE_INFINITY`.
  Worth remembering: any new cooldown-style gate needs a "never yet fired"
  sentinel distinct from a legitimate zero timestamp.

## Tests
`world.test.ts` gained a `freezeThrowTestCharacter()` helper and four cases:
cone freezing (ahead/behind/boss exemption), cooldown + cap enforcement,
selection-box hit-testing, and the hit-vs-miss kill-credit branching. Per
CLAUDE.md's existing warning, the shared `addEnemy()` fixture in that file
needed `frozenUntil`/`selectedForThrow` added -- both fields are only
type-checked in the excluded `**/*.test.ts` scope (see `tsconfig.json`), so
a fixture gap here would have silently misbehaved exactly like the
`invisibleUntil` gap CLAUDE.md already documents, not been caught by
`pnpm typecheck` or `pnpm test` (the `tsx` loader doesn't type-check).

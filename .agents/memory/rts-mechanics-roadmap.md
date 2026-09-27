# RTS-mechanics roadmap: reusable infrastructure and future character ideas

## Why this exists
Zero Day (see `zero-day-freeze-throw.md`) introduced the game's first
RTS-style interaction: cast an ability, drag-select a box over the result,
then issue a follow-up command at a target point. That work built real,
reusable infrastructure — this doc records what's reusable and brainstorms
where else it could go, so a future character doesn't have to re-derive the
pattern from scratch or (worse) re-investigate whether `DashSkillDef`/
`UltimateDef.effect` can do it (they can't — see that doc's "why not"
section, which still applies to any future ability shaped like this).

## The reusable pieces, and where they live
- **`PointerMode` extension pattern** (`RunScreen.tsx`) — adding a new mode
  value and a priority-ordered check near the top of `handlePointerDown`
  (character-specific modes are checked before the generic movement-stick/
  physics-object paths, same tier as the `stormCloud` grab and Zero Day's
  `freezeSelect` check) is the proven way to give one character a bespoke
  control scheme without touching anyone else's input.
- **World-space box selection** (`updateFreezeSelection`/
  `endFreezeSelectionDrag` in `world.ts`) — the box-containment test against
  `w.enemies` is generic; a future ability could reuse the exact same
  shape (min/max X/Y containment) against a different filter predicate
  (e.g. "my summoned allies" instead of "currently frozen enemies").
- **Screen-space DOM overlay for the marquee** (`RunScreen.tsx`, the
  `freezeSelectBox` state + a `pointer-events-none absolute` div) — cheap,
  proven, no `draw.ts` changes needed for the box itself. Reusable verbatim
  for any future drag-select ability.
- **Optional `CharacterDef` field + dedicated `World` runtime state** — the
  `stormCloud`/`freezeThrow` shape (opt-in field, `null` for every other
  character, initialized in `createWorld`) is the established pattern for
  "one character gets a whole bespoke subsystem." Prefer this over adding
  a new `DashSkillDef` kind or widening `UltimateDef.effect` whenever the
  ability needs multi-step state across frames/input, not just an
  instant-cast multiplier or AoE.
- **Enemy-state-as-object conversion** (`frozenUntil` + reusing
  `invisibleUntil` to hide the "carried" original while a `Projectile` with
  `carriedEnemyUid` represents it in flight) — the general trick is:
  don't invent a third entity type for "enemy temporarily acting as
  something else"; give it a new transient-state field in the same family
  as `ghostUntil`/`invisibleUntil`/`frozenUntil`, and reuse an existing
  entity (here, `Projectile`) with one new optional field to carry the
  reference.
- **Mouse+touch parity for free** — every one of the above already worked
  on touch without extra plumbing because `RunScreen.tsx`'s pointer
  handlers use the Pointer Events API (`onPointerDown`/`onPointerMove`/
  `onPointerUp`) on a `touch-none` surface. Any future drag-based ability
  gets this for free by construction; don't add a parallel `onTouchStart`
  path.

## Concrete future directions (not built, brainstormed only)

1. **Rally-point commands for summoned units.** A character whose signature
   weapon or ultimate spawns persistent allies/turrets (there's already a
   `Follower` entity type, used by some `WeaponDef.follower` configs) could
   let the player drag-select their own followers and right-click/second-tap
   a destination to relocate them — same selection/command shape as Zero
   Day, aimed at `w.followers` instead of `w.enemies`.
2. **Control groups.** Once more than one character has a "select some of
   my things" mechanic, a shared `1`-`9` key binding to save/recall a
   selection (classic RTS control groups) becomes worth it — store as
   `Record<number, number[]>` (uids) on `World`, keyed generically rather
   than per-character, so any future selection-based ability benefits.
3. **Drag-to-designate a zone**, not just a point — e.g. a "turret covers
   this rectangle" or "allies patrol this box" ability. The box-math already
   exists (`updateFreezeSelection`'s min/max containment); the new part
   would be *persisting* the box as an ability's operating area instead of
   consuming it in one throw.
4. **Formation movement** for a multi-summon character: selected units move
   toward a clicked point while preserving their relative offsets, instead
   of all converging on one spot. Reuses the existing `formationPositions`
   geometry helper in `world.ts` (already used for enemy wave spawns) run
   in reverse — space the destinations, not the spawn points.
5. **Shift-click queued commands.** A second modifier state on the same
   pointer-down check (e.g. a HUD toggle or a held key, since there's no
   shift-click equivalent on touch) that appends to a command queue instead
   of replacing it — useful once any character has more than one
   controllable unit type at once.
6. **A "capture" ability instead of "throw."** Same freeze-cone-then-select
   shape as Zero Day, but the follow-up command converts selected enemies
   into temporary allies (there's already a `convertedUntil` field on
   `EnemyActor`, used elsewhere for the ally-maker weapon) rather than
   projectiles — reuses the selection infrastructure with a completely
   different payoff, worth keeping distinct from Zero Day rather than
   overloading one character with both.

## The one rule worth restating
None of the above should touch `DashSkillDef` or `UltimateDef.effect` to
make it fit — both are proven poor fits for multi-step, stateful,
player-driven targeting (see `zero-day-freeze-throw.md`). A new RTS-shaped
ability is a new optional `CharacterDef` field + `World` state, every time,
until enough of them exist that a genuinely shared `RtsAbilityConfig`
family is justified — don't build that abstraction speculatively before a
second real character needs it.

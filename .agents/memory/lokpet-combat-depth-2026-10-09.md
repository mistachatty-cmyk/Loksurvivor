# LokPet combat depth pass — 2026-10-09

User ask: "flesh out combat in lokpets so stats matter, different enemies are
more complex, along with variants, and exp/leveling up and fighting matter
more and grow and feel worth it." Five independent, additive workstreams
landed on top of the existing turn-based battle engine
(`engine/lokPetBattle.ts`, `engine/quickFight.ts`, `data/lokPetBattles.ts`)
and the main real-time run (`RunScreen.tsx` / `engine/world.ts`). None of
this touches `stepWorld`'s simulation loop, `data/lokPets.ts`'s base stat
sheets, or any already-saved pet's persisted roll — see each section for the
non-retroactivity argument specific to it.

## 1. Leveling now scales the real-time run, not just the arena

`docs/lokpet-rpg-and-digi-tower-plan.md` section 3.2 already specified the
fix; this pass just built it. `engine/petExpCurve.ts`'s new
`runPowerScale(level, starter?)` returns a bounded multiplier (+45% by level
50 for non-starters; starters taper on to +70% by level 99) applied only at
`RunScreen.tsx`'s `startingLokPets` construction — a fresh roll-shaped object
built per run, scaling `stats.health`/`stats.damage` before the sim ever sees
it. `engine/world.ts`'s `spawnLokPet` and the sim loop are untouched; a
brand-new chest-granted pet (`world.ts`'s own `rollLokPet(w.rng)` call) has
no level yet and is correctly left alone. The starter 50→99 taper formula is
this pass's own linear interpretation of the plan doc's prose target, not a
literally sourced constant — flag that if it's ever revisited.

Non-retroactive by construction: `SavedLokPet.roll` (the persisted on-disk
roll) is never mutated, only read; the scaled stats live in a throwaway copy
built fresh each run.

## 2. Street enemies in quick/duo/arena fights are no longer one flat opponent

Previously every street `EnemyDef` opponent in a travel-encounter fight
collapsed to the same fixed pseudo-variant (`'street-enemy'`) and got its
element by hashing its *name string* through the card-variable system. Now
`data/lokPetBattles.ts`'s `enemyBattleElement()` derives the element from the
enemy's own `role` first (a closed 10-value union, the strongest signal an
`EnemyDef` carries — `sniper`→volt, `heavy`→terra, `boss`→dark, etc.), falling
back to `family`/`faction` keyword matching, then `'none'`. A role also keys
into a distinct move pool: `quickFight.ts`'s `buildQuickOpponent` passes
`` `street-${role}` `` into `assignBattleMoves`, which now has one branch per
role (`street-sniper`→`dive-talon-strike`, `street-disruptor`→
`sloth-dilation-wave`, etc.), all reusing existing `BATTLE_MOVES` — no new
move content. An enemy with no `role` still falls through to the old generic
pool, so nothing regresses for content that predates this.
`ResolvedTravelEncounterOpponent` grew `enemyRole`/`enemyFamily`/
`enemyFaction` fields to carry this through from `travelEncounter.ts`'s
resolver to `EncounterFightOverlay.tsx`'s element computation.

## 3. Ordinary LokPet variant rolls lean elementally, by family

`rollLokPet()` used to pick rarity/attackKind/element fully independently of
which of the 78 variants got drawn, so e.g. a Moss Pouncer and a Rain Jelly
rolling "rare fire" were stat-identical. `data/lokPets.ts`'s
`FAMILY_ELEMENT_BIAS` table now weights `pickElement`'s candidate list by the
drawn variant's `family` (animal leans terra/aero, ghoul leans dark/glitch,
etc.) — a *lean*, not an override: every element stays reachable for every
family, confirmed by a statistical test in `data/lokpetsExpanded.test.ts`
that checks both an elevated share for the biased elements and that at least
one other element still shows up over many rolls. This only touches ordinary
rolls; the `fixedVariantId`/`SPECIAL_LOKPET_LOADOUTS` branch (the ~33
hand-curated legendary variants) is untouched and unaffected.

`assignBattleMoves` also gained family-keyed fallback branches (checked after
the existing per-variant allow-list, before the final generic
`barrier-shield`/`hyper-beam`), so families that previously had zero
step-3/step-4 coverage (mote, blob, ghoul, bat, mechanical, animal) get a
thematically real move instead of the fully generic default.

**Breaking signature change, landed in one commit**: `assignBattleMoves` now
takes `family: LokPetFamily` as a required parameter. Every call site
(`convertSavedPetToBattlePet`, `generateOpponentPet`,
`calculateBattleRewards`'s level-up reassignment, `buildQuickOpponent`'s
LokPet branch) was updated together — `pnpm typecheck` is the fastest way to
confirm no site was missed if this function's signature changes again.

Non-retroactive: only affects the *next* `rollLokPet()` call going forward;
`SavedLokPet.roll` for already-owned pets is never touched.

## 4. Previously-dead status effects now have real mechanics; speed matters all fight

Before this pass, `freeze`/`slow`/`stun`/`leech` were applied by moves
(duration/value set on the target) but nothing ever consumed them, and
`empower` ignored the move's own `value`, always applying a hardcoded 1.3x.
`speed` was checked once (who opens the fight) and then ignored for the rest
of the turn-order.

- **stun**: `executeMove` now intercepts at the top — a stunned attacker's
  move never resolves; the effect clears and the turn flips.
- **freeze/slow**: read via a new `effectiveSpeed(pet)` helper
  (`pet.speed` minus any `freeze`/`slow` effect's `value`, floored at 1),
  used both for the speed-differential check below and for status display.
- **leech**: `applyEndOfTurnEffects` gained a branch alongside the existing
  `burn`/`shock`/`corrupt` DOT ticks — drains the afflicted pet, heals the
  pet whose name matches the stored `sourcePetName` (a field `
  BattleStatusEffect` already carried, previously unused for this).
- **empower fix**: the bonus is now `1 + effect.value / 100` instead of a
  flat `1.3`, so the move data's own 20/25/30 values finally matter.
- **speed-differential extra turn**: rather than a full turn-order/speed-queue
  rewrite (bigger blast radius against `quickFight.ts`'s telegraphed-intent
  system and `chooseEnemyMove`'s one-move-per-side-per-round assumption), a
  capped chance (0 below a 1.15x effective-speed ratio, capping at 25% around
  ~1.8x+) lets a notably faster side act again immediately instead of the
  turn flipping. Symmetric, bounded, and defaults to exactly today's behavior
  below the threshold. This is this pass's own proposed mechanic, not
  sourced from the design doc — the doc doesn't prescribe how speed should
  matter beyond the existing first-strike check.

Tests for all of the above live in the new `engine/lokPetBattle.test.ts`,
using a zero-power always-hit fixture move (`NOOP_STRIKE`) specifically so
each assertion isolates the mechanic under test from the move-roll
randomness (crit chance, accuracy roll, damage variance) that a real move
would otherwise introduce. One gotcha hit while writing these: `createBattle`
decides `currentTurnActor` from the two pets' *starting* speeds — overriding
`pet.speed` after `createBattle()` returns does not retroactively update
`state.currentTurnActor`, so a speed-differential test must also set
`state.currentTurnActor` explicitly before calling `executeMove`.

## 5. `specialAbility` (legendary variants' named trait) now hooks into battle

`specialAbility` was real but overworld-only (the companion loop in
`engine/world.ts`) — zero references anywhere in the turn-based battle
engine. `data/lokPetBattles.ts`'s new `SPECIAL_ABILITY_BATTLE_PASSIVE` lookup
maps a subset of the ~35 existing ability-id strings (partial coverage is
intentional and additive — an unmapped ability simply does nothing extra in
battle) to one of three passive kinds, consumed in `executeMove` right after
damage/crit resolution:
- `leech-on-hit` — the attacker heals a % of the damage it just dealt, every
  hit (`null-consume`, `singularity-drain`, `abyss-crush`, `mite-swarm`).
- `empower-on-crit` — a crit grants the attacker its own `empower` status
  (duration 2, magnitude from the passive, not a move) if it isn't already
  empowered (`tri-laser`, `thunder-claw`, `plasma-orbit`, `kirin-thunder`).
- `shield-on-low-hp` — the defender raises a `shield` status once it drops
  below a threshold (`silicon-shield`, `firewall-curl`, `seraph-radiance`,
  `rebirth-burst`), using the same 0.3/0.35 fractions `chooseEnemyMove`'s own
  panic-mode AI logic already uses, so the AI and this passive read the same
  "low HP" the same way.

`BattlePet.specialAbility?: string` (new field, `lokPetBattleTypes.ts`) is
populated from `roll.specialAbility` at the three stat-generation call sites
that already move together for Workstream 3's `family` threading
(`convertSavedPetToBattlePet`, `generateOpponentPet`, `buildQuickOpponent`'s
LokPet branch) — street enemies have no `specialAbility` and are correctly
left `undefined`.

## Deliberately not done in this pass

- The full Vigor/Fury/Guard/Pace/Spirit trainable-stat system from the plan
  doc's section 3.3 (new currency + unbuilt "Training Bay" UI) — Workstream 1
  already answers "leveling should matter" for the run without it.
- Retroactively rebalancing already-caught pets — every workstream here only
  affects future rolls/runs, per the plan doc's own stated rule.
- A full speed-order-queue rewrite of turn order (see Workstream 4's rationale
  above).
- Touching `engine/world.ts`'s simulation loop beyond the one
  `RunScreen.tsx`-side read in Workstream 1.
- Authoring new `BATTLE_MOVES` or `data/enemies.ts` content — every
  workstream here is a logic/wiring pass over existing content.

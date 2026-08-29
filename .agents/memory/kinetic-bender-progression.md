# Kinetic Bender: planning doc for the gyroscope/shop/weapon-tier backlog

**Status: plan only, nothing in this doc is implemented yet.** This records a
large voice-dictated feature request (branch `claude/kinetic-bender-progression`)
broken into buildable systems, with the ambiguous parts turned into concrete
decisions so an implementing agent doesn't have to re-derive them. Canon/naming
calls are marked **Decision**; open mechanics the user asked to "figure out
later" are marked **Proposal** — pick a value, don't leave the field vague.

Read `tilt-steering.md`, `impact-physics.md`, `studio-engine.md`, and
`music-reactivity.md` first — every system below extends one of them rather
than starting fresh.

## 1. Kinetic Bender — the ability-tree umbrella

**Decision:** *Kinetic Bender* is the in-fiction name for the whole class of
run-altering special abilities (gyroscope object control, time-warp, and
future entries like Timeless Mode toggles). It is a Quartermaster/Roster shop
category, not a weapon — its unlocks change *how the game is controlled and
paced*, not raw stats. It reads as a themed skill tree in `VendorPanel.tsx`,
gated by the tiered currency system in §2.

### 1a. Gyroscope object control (extends `tilt-steering.md` + the existing
clickable-prop prime mechanic in `impact-physics.md`)

Today: tilt steers the *character* (`mapTilt` in `input/gyro.ts`); a
click/tap on a movable prop primes a one-shot launch on the next player hit
(`impact-physics.md`). The ask is to let tilt drive *props* too, with tiers
that change who tilt controls and how.

Proposed tier ladder (each tier is one `VendorItemDef`-shaped purchase in the
Kinetic Bender category, each independently toggleable off and refundable —
see §1d):

1. **Tilt Grip** (already shipped) — tilt steers the character. Reclassify
   the existing always-on tilt steering as tier 1 of this tree so the tree
   has a visible starting node instead of the feature seeming to appear from
   nowhere.
2. **Kinetic Reach** — tilt also drives primed/movable props: the gravity
   vector from `mapTilt` (do not re-derive Euler angles — reuse the same
   gravity-space vector `tilt-steering.md` already computes) applies a
   steering force to props flagged pushable, on top of their existing
   physics. Tapping a prop still primes it per the current one-shot design;
   this tier adds continuous tilt nudging *between* primes so props drift
   toward the tilt direction and can be walked into enemies.
3. **Split Grip** — adds simultaneous finger control: a touch-drag anywhere
   on screen drives the character (like the existing tap-to-move/joystick
   input) *while tilt independently drives props at the same time*. This is
   the tier that answers "control the character either via gyroscope or by
   clicking, but tilt always still moves the character unless Split Grip is
   bought" — before this tier, tilt owns the character exclusively; after
   it, touch takes the character and tilt is freed for objects only.
4. **Full Sync** — character and every tilt-eligible prop on screen move as
   one system: moving the character one direction flings synced props the
   same direction into enemies. Implement as a shared steering vector
   (`w.kineticSync.vector`) that both the player's tilt-steering integrator
   and the prop-physics integrator read, rather than two separate systems
   that happen to agree — a shared source avoids the two drifting apart
   frame-to-frame.

Each tier is a real settings-level toggle (`meta.kineticBenderTiers: Record<tierId, boolean>`)
independent of purchase — "turn off or refund" means: owning a tier keeps
its currency spent, but a settings switch can disable its *behavior* per
run (for players who own Full Sync but want plain tilt-steering back), and a
separate one-time "refund" action (from the shop, at a currency penalty
matching however other refunds in this codebase are priced — check
`VendorPanel.tsx` for an existing refund pattern before inventing a new one)
returns the currency and re-locks the tier.

**Sub-branch: mini-gyro durability nodes.** Small percentage upgrades
attached under Kinetic Reach: props tilt-controlled or synced lose 15% / 30%
/ 75% / 100% less durability while being steered (100% = never breaks from
tilt-steering specifically; it can still break from taking weapon/enemy
damage normally). These are §2's "gems," not separate tree nodes.

**Proposal — the balance knob the user flagged ("objects break too fast" /
"still bounce but not everywhere"):** give every tilt-eligible prop a
`kineticMode: 'free' | 'locked'` state, player-togglable per run from the
HUD once Kinetic Reach is owned. `free` = full bounce physics (current
one-shot launch behavior, extended to continuous tilt). `locked` = the prop
holds its position under tilt and only translates when explicitly flung
(prime + hit, as today), never drifts on its own — this is the answer to
"they can still bounce, but they won't be bouncing everywhere." Durability
loss should scale with impact speed, not a flat per-hit cost, so a gently
tilted prop surviving many small taps and the 15/30/75/100% nodes actually
matter (implement in `damageBreakable`, gated behind the existing physics
settings toggle mentioned in `impact-physics.md`).

**Object regeneration + spawn-animation store:** broken/despawned props on a
kinetic-enabled map slowly repopulate (reuse the endless-mode chunk
obstacle-refresh pattern from `endless-mode-engine.md` rather than inventing
a second spawn system). The *animation* used when a prop re-enters — drop
from above, slide in from a screen edge, rise from a "gravity pool" — is a
cosmetic choice sold in a small "Prop Animation" store section, `render/`-
only (no simulation effect), following the same render/sim split
`music-reactivity.md` already establishes for visual-only content. Treat
"we'll need an animation engine to streamline this" as a **later** ask, not
part of this phase — ship 3 hand-authored animation curves first
(`drop`, `slide-in`, `rise-pool`) as plain easing functions in `draw.ts`
before building a generic authoring tool nobody has designed the UI for yet.

### 1b. Time abilities

**Decision:** two Kinetic Bender nodes, **Slack Time** (slow-mo) and
**Overdrive** (speed-up), both implemented as bounded multipliers on `w.now`'s
advance rate in `stepWorld` — the same place `endless-mode-engine.md`'s
difficulty multipliers compose, so this needs its own `Math.min`/`Math.max`
clamp rather than stacking unbounded on top of endless-mode's existing caps.
Player-triggered, cooldown-gated (an ultimate-style resource, reusing the
`ultimateCooldown` effect kind already in `UpgradeEffect` rather than adding
a parallel cooldown system).

**Decision — "Timeless Mode":** a run modifier/challenge (same shape as
`ChallengeContractDef`), not a rewrite of endless mode: time-of-day
(`World.cycle.phase`) stops advancing and enemy spawn composition locks to
whatever it was at activation. Positioned as a late-run or achievement
unlock per the user's "tied to things you have to do to unlock, like in-game
content" — model it as an `UnlockRule` keyed to a specific achievement/
discovery record, the same unlock evaluator every other locked surface in
this game already uses (`dev-mode-unlocks.md` explains that evaluator).

### 1c. Performance target

Raising on-screen enemy counts is a prerequisite for Full Sync being
readable (lots of synced flying props + lots of enemies). Concrete target
to write acceptance criteria against: **no regression below 50 fps on the
existing endless-mode enemy-density cap** (`hpMult ≤ 1.7`, spawn rate
`≤ 3.2/s`, per `endless-mode-engine.md`) after this feature set ships.
Profiling levers, in likely-impact order: (1) the spatial hash grid cell
size in `engine/math.ts` — verify it's tuned for the higher prop-interaction
count Kinetic Reach adds, not just enemy-vs-enemy; (2) batch `draw.ts`
canvas calls for tilt-synced props (they'll move every frame instead of
only on launch, so per-prop `save()/restore()` overhead now matters);
(3) only if 1–2 aren't enough, a distance-based LOD that skips shadow-caster
polygons for off-screen-adjacent props. Measure before optimizing — don't
pre-emptively add LOD if the grid retune alone clears the target.

### 1d. Refund/on-off semantics (applies to every tree in this doc)

Every purchasable node in Kinetic Bender (and the shop tiers in §2) needs:
- a stored owned-flag in `metaStore` (survives resets, like other unlocks),
- a per-run or global settings toggle to disable its *effect* without
  losing ownership,
- a refund action that returns currency at a fixed rate and clears the
  owned-flag.

Build this as one shared helper/schema, not three independent per-tree
implementations — every tree below (gyroscope, weapon fusion recipes, gem
attachments) needs the identical three behaviors.

## 2. Shop tier & currency economy

**Decision — tier bands** (apply to Kinetic Bender nodes and any future
tree that wants "expensive but not endgame-expensive" pricing):

| Band    | Rung 1  | Rung 2   | Rung 3            |
|---------|---------|----------|-------------------|
| Low     | 2,000   | 8,000    | —                 |
| Medium  | 50,000  | 250,000  | 750,000–1,000,000 |

A tree picks a band per node based on how run-altering it is (Tilt Grip →
low band since it's foundational; Full Sync → medium band top rung). Extend
`VendorItemDef` (`types.ts:1074`) with an optional `tierBand`/`tierRung` pair
purely for shop UI grouping — don't invent a second pricing field that
duplicates `cost`; `cost` stays the source of truth, the band is metadata for
sorting/display and for validating that new content lands on-scale.

**Decision — gems.** A gem is a small percentage modifier attachable to an
*owned* node (not a standalone purchase): 5% / 10% / 15% / 25% / 100%
increments, node-specific meaning (durability reduction for Kinetic Reach,
damage-scale bump for a weapon slot, etc.). Model as:

```ts
interface GemDef {
  id: string;
  hostId: string;        // the VendorItemDef / node id this attaches to
  pct: number;            // 5 | 10 | 15 | 25 | 100
  cost: number;
  effect: 'durability' | 'damage' | /* extend per host */ string;
}
```

Gems are the mechanism for the durability nodes in §1a and for any future
"upgrade an upgrade" ask — don't build a separate bespoke system per tree.

## 3. Weapon tier rework: 1–13, tier 14, and fusion

Today every weapon caps at level 8 (`Math.min(8, weapon.level + ...)` at
`engine/world.ts:2623/2722/2733/2860`). This is the one item in the whole
brief with a concrete, unambiguous target, but it is **not** a safe
find-and-replace: every `WEAPONS` entry's `levelDamageScale` (`data/weapons.ts`)
was tuned assuming 7 level-ups (1→8), and enemy HP curves were tuned assuming
weapons cap out at level 8. Bumping the constant to 13 without re-deriving
`levelDamageScale` per weapon (or the enemy HP scaling curve) will make the
back half of every run trivial or, if enemy HP is also bumped blind, make
the early game unbeatable. This needs a balance pass, not a constant change —
flag it for the phase in §9 that has room to playtest, not a drive-by edit.

**Decision — naming.** Tier 14 (the evolution slot) is called **Mastercraft**
in-fiction (the user's placeholder "hacked/mastercraft" — Mastercraft reads
better next to "Freestyle Mic," "Boombox," etc. than "Hacked"). A weapon
reaches Mastercraft the same way evolutions already trigger today (level +
required passive, see `EVOLUTIONS`/`requiredPassiveId` in `data/evolutions.ts`
and the `recipe.minWeaponLevel` check at `world.ts:2611`) — just re-pointed
at level 13 instead of 8.

**Decision — fusion.** Two Mastercraft-tier weapons can combine into a new,
stronger weapon via a **Recipe Book**: a collectible/unlockable list (mini-
game-gated, per the user's ask) of valid `(masterCraftIdA, masterCraftIdB) →
fusedWeaponId` pairs. Model as a new `FusionDef` alongside `EvolutionDef` in
`types.ts`, resolved through the same single choke point pattern the rest of
this codebase uses (`damageEnemy()` for damage, one bus for music) — one
`resolveFusion()` function, not fusion logic scattered across the level-up
reel and the vendor and the recipe-book UI independently.

## 4. HavenOfTheBubs — canon

**Decision, made canon per the request:**

- **Map:** *HavenOfTheBubs* — a new `AreaDef`. Every surface, obstacle and
  ambient prop reskinned in a blue-tinted bubble texture (bubble ducks,
  bubble-inspired street furniture); this is a palette/`ObstacleDef` content
  pass, not an engine change, per the data-driven rule in `types.ts`'s header.
- **Factions:** the **Bubblenaughts** (blue) are the map's native population;
  the **Bubbleteers** (pink) are the invading faction. The player starts in
  the middle of that war. Model as two new enemy factions in `data/enemies.ts`
  with 3–4 named variants each forming a rank hierarchy (grunt → elite →
  named lieutenant), not a flat reskin of one enemy.
- **Leaders / late-game allies:** two unlockable leader characters, one per
  faction, both eventually recruitable as allies (`AllyDef`) after a
  storyline unlock (`UnlockRule`), not available from the start. The pink
  leader is **Bulbosa** (the user's own naming — "plink Bubbles (Bulbosa)").
  Canon: the Bubblenaughts are the original family — generations of a bubble
  kingdom built on exploration and discovery of "the bubble realms"; the
  Bubbleteers under Bulbosa earned their name and rivalry by challenge/combat
  ("earned their name by weight") rather than birthright, and the two
  leaders' fathers fought before them — a generational rivalry, not a fresh
  one. Blue leader needs a name before implementation — treat as an open
  content slot, not a blocker for the rest of the map.
- **Bubble weapon/character:** a weapon and/or character whose signature is a
  translucent bubble trail. Render as semi-transparent (alpha-blended,
  reduced opacity relative to normal sprites) — this is the one place in the
  renderer that should deliberately break from the fully-opaque procedural
  rig look, so keep it scoped to this content rather than adding a global
  transparency parameter to `drawRig`.

This is a large content drop (new area + two enemy factions + two allies +
one weapon/character) — treat it as its own phase (§9), not something folded
into the Kinetic Bender mechanical work.

## 5. Studio / level-up music reactivity

The in-game DAW (`studio-engine.md`) and the beat bus (`music-reactivity.md`)
already exist — **do not build a second studio or a second slider page.**
What's missing, concretely:

- A `BeatReaction`-driven particle/ambiance layer that activates specifically
  on the level-up screen, reusing the existing render-only reaction path
  (`musicVisual` in `draw.ts`) rather than adding level-up-specific music
  code.
- A "stopped" transition state: when a run/level-up pause halts the beat,
  crossfade in a slight reverb send and a small tempo ease-down on the
  soundtrack player, rather than a hard stop. This lives in the soundtrack
  player, not the studio engine — the studio only ever hands off a finished
  track (`studio-engine.md`'s "reaches the game through the soundtrack, not
  directly" rule) and must not grow a second live connection into pause
  state.
- The "slider on the same page" ask is already satisfied by the studio's
  existing mixer/pad UI; if what's wanted is a *lighter-weight* quick-mix
  view outside the full studio, scope that as a small follow-up, not a
  rebuild.

## 6. Pinball Beacon character

**Decision — character:** a rare-tier rabbit, red-and-blue magnet-hand,
goggles; built from `humanoidRig` (per `sprites/rigs.ts` — no new rig
factory needed, this is parameter variation: ears via an existing
silhouette option or a small rig addition, goggle/magnet-hand as palette +
accessory params).

**Mechanic, made concrete:**
- Drops a **Pinball Beacon** periodically while moving (not on a fixed
  timer alone — "every few steps" reads as distance-traveled, e.g. every
  N world units walked), up to a beacon cap that starts at **4** and
  increases with character level.
- Passive small pinballs spawn from screen edges at intervals, seek the
  nearest beacon, and on entering a beacon's radius: (a) bounce off in a new
  direction weighted toward *other* beacons (so they chain rather than
  scatter randomly), (b) deal contact damage to enemies along the bounce
  path (route through `damageEnemy()`, per the single choke-point rule),
  (c) flip the beacon's color to mark it as recently hit.
- At weapon/ability level **13**, bounces gain an on-impact explosion
  (small AoE, reuse the impact-burst pattern from `impact-physics.md` rather
  than a new explosion system) — this is the natural place to hang the
  "level 13 = special" rule from §3 onto a *character ability* rather than
  a weapon, so the two systems reinforce the same number instead of
  competing conventions.

## 7. "Multiple Chattanooga" — parallel dispatch

Best-guess reading of the request: this backlog is too large and too
interdependent (multiple systems touch `world.ts`, `types.ts`, and
`draw.ts`) for one Claude session to build safely in one pass — the ask is
for a set of self-contained prompts that can be handed to **separate**
Claude Code sessions/agents to build in parallel without stepping on each
other's edits. Suggested split, ordered so the shared-file-touching phases
land before the purely additive ones:

1. **Shop tier/gem economy** (§2) — touches `types.ts` (`VendorItemDef`) and
   `VendorPanel.tsx` only. Land first; everything else's currency costs
   depend on the band table existing.
2. **Weapon 13/14 + fusion, with a real balance pass** (§3) — touches
   `world.ts`'s level-cap constants, every entry in `data/weapons.ts`'s
   `levelDamageScale`, `data/evolutions.ts`, and enemy HP curves in
   `data/enemies.ts`. Needs playtesting via `pnpm dev`, not just typecheck.
3. **Gyroscope object control tiers + Kinetic Bender tree UI** (§1a, §1d) —
   touches `input/gyro.ts`, `world.ts`'s prop physics, and the new shop
   category from phase 1. Do this after phase 1 lands so the tree has
   somewhere to live.
4. **Time abilities + Timeless Mode** (§1b) — small, isolated to `stepWorld`'s
   time-advance and one new `ChallengeContractDef`-shaped record. Can run
   parallel to phase 3.
5. **Performance pass** (§1c) — do this *after* phases 2–4 land, profiling
   against what they actually cost, not against guesses.
6. **HavenOfTheBubs content drop** (§4) — purely additive data (`AreaDef`,
   enemy factions, allies, one weapon). Safe to run fully in parallel with
   everything above; the only shared touch point is `data/enemies.ts`, so
   coordinate only if phase 2's enemy HP rebalance is landing at the same
   time.
7. **Level-up music reactivity + soundtrack reverb-on-pause** (§5) — isolated
   to `draw.ts`'s reaction layer and the soundtrack player. Fully parallel.
8. **Pinball Beacon character** (§6) — isolated new character + ability;
   only touches `damageEnemy()` as a caller, same as any other weapon. Fully
   parallel, but land after phase 2 if its level-13 hook should match
   whatever the balance pass settles on for what "13" means numerically.

Each of these is sized to be a complete, mergeable PR on its own — hand each
list item to a session as its prompt verbatim (it already names the exact
files and the relevant memory docs to read first).

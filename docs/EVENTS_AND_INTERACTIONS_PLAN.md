# Events, crew interactions, specials, resources and physics — plan

Status: **plan only, nothing here is built.** Drafted 2026-10-09 from a "make events
and things that happen feel alive" request. Every item respects the existing
contracts; read the linked notes before building one.

## Guiding rules (do not break)

- Data-driven: a new event, resource or crew moment is a record in `data/*.ts`, not
  an edit to the `stepWorld` loop. Add one small hook per *kind* of thing, once.
- All payouts go through existing choke points: `damageEnemy()` in a run,
  `engine/hideoutRewards.ts` in the hideout (daily caps, rare limits). No new
  reward path, no duplicate XP/cred/loot/kill counts (`impact-physics.md`).
- Seeded and deterministic: use the run seed / `quirkHash`-style hashes, never
  `w.rng`, so tests and replays do not shift (`enemy-quirks-and-surge.md`).
- Optional, interruptible, recoverable: warning -> active -> complete/failed
  phases, safe to skip, pause or die in (`district-setpieces.md`).
- Idle things are a chip, never a pop-up (`hideout-interactables.md`).
- Endless-mode difficulty stays inside the existing `Math.min()` caps
  (`endless-mode-engine.md`).
- Follow the naming rule in CLAUDE.md. Use beacon / pulse / relay / static / frequency.
- New player text goes in `locales/en.json`; bump the changelog every release.

## 1. In-run events: a "Director" that tells a story

Today: waves, Quirk Surge (one 20s window), landmark setpieces. Gap: runs feel
like a smooth ramp with few memorable beats.

**Event Director** (`data/runEvents.ts` + one hook in `world.ts`): each run seeds a
short schedule of 3-5 *beats* picked from a table, spaced so they never overlap.
A beat is `{ id, warnMs, activeMs, weight, minMinute, tags, effect }`.

Starter beats (each reuses existing spawns/effects):
- **Blackout block** — lights drop to a radius around the player, lanterns/server
  racks become the only light; enemies get `invisibleUntil` flicker. Reward: a
  guaranteed cache at the end. Reuses the day/night `cycle.phase` renderer.
- **Rush-hour stampede** — a `file`/`wall` formation crosses the map in a straight
  line; a marked safe lane gives bonus XP for standing in it.
- **Block party** — a crew-ally beacon spawns a short-lived stage; staying in the
  ring buffs fire rate (crew moment, see section 2).
- **Supply drop** — a flare marks a landing point, a crate falls on a timer, and
  enemies converge on it. Greed vs safety.
- **Tremor** — scheduled shake; light props slide, medium props tip, enemies in
  the path stagger (physics, section 4).
- **Relay storm** — a roaming static field that scrambles aim for the player *and*
  enemy spitters. Tells with a screen-edge frequency hiss.

Tests: a seeded run produces the same beat list; beats never overlap; a beat that
is interrupted by death or pause cleans up and pays out nothing twice.

## 2. Crew: they take part, not just stand there

Today: rescued allies stand in hideout rooms with seeded lines (`CREW_CHATTER.md`).

- **Crew assists in runs (opt-in loadout slot).** One equipped ally gives a
  *call-in* on its own cooldown: Vee marks a target for crit, Pippa drops a
  healing pulse, Theo throws a decoy. Data: `AllyDef.callIn: { cooldownMs, effect }`
  with `effect` reusing existing ability kinds only.
- **Relationships.** Pairs of allies get a tiny bond table (`data/crewBonds.ts`).
  Both equipped = a small passive and a shared line in the run-start banner.
- **Hideout scenes.** Allies walk between props on a schedule (kitchen at dusk,
  rooftop at night) instead of standing still; two allies who are bonded sit
  together. Driven by the same clock as the strip scenery, no new state.
- **Crew reacts to the run.** Run summary quotes a crew line keyed to what
  happened (clutch survive, big combo, died to a boss) using the Rant-style
  expander's reserved `special` slot.

## 3. Specials and game effects (juice that carries information)

- **Per-character ultimate flourish:** a short canvas-only intro per ultimate
  (palette flash, ring, ground crack) as data on `UltimateDef.flourish`, so
  ultimates read at a glance without engine changes.
- **Hit-stop and screen punch tiers** keyed to impact 0-5 (`impact-physics.md`):
  tiny freeze on heavy kills, none on chaff. Hard cap per second to protect
  frame pacing (`frame-pacing-2026-09-20.md`).
- **Combo language:** kill-streak tiers change the music mix via `beatBus`
  (add a stem layer at tier 3, drum fill at tier 5) — reuse `music-reactivity.md`.
- **Status readability:** every status (burn, static-stun, slow) gets one distinct
  shape + color, drawn by a single table in `draw.ts`.
- **Weather in runs** already exists (`sky-ambiance.md`); let a beat *force* rain
  or fog for its duration so events change the look, not just the numbers.

## 4. Physics (small, bounded, fun)

Build on the prop-launch and dash-impulse rules; do not add free-for-all physics.

- **Tremor and shockwave** (from beats and some bosses): apply the existing
  impact value to props/enemies in a radius; fixed props stay fixed.
- **Chain reactions:** a launched prop that hits an explosive/gas prop detonates
  it once (guarded by the per-prop velocity budget so it cannot recurse).
- **Crowd pressure:** dense hordes push slow movers aside (soft separation using
  `hordeField.ts`), so a wall of enemies visibly flows around a pillar.
- **Hideout toys:** the Ball already exists; add a second movable prop (stack of
  crates the pets knock over) as a *cosmetic* only — pays nothing, so nothing to
  cap.

## 5. Resources that appear (and why you chase them)

Today: XP, cred, loot, chests, supply blocks (`endless-block-supplies-2026-10-04.md`).

- **Temporary pickups with a verb**, spawned by beats or elites, each a record in
  `data/pickups.ts`: *Overclock cell* (10s fire rate), *Magnet coil* (pulls XP),
  *Patch kit* (small heal), *Bounty token* (banked toward a crate).
- **Streetlight economy:** standing in a lit zone slowly charges a meter that
  converts to a one-time boost — rewards moving between safe pockets, pairs with
  the Blackout beat.
- **Salvage from props:** breaking a destructible prop can drop a small resource
  by prop kind (server rack -> chip, vending machine -> snack heal). Add the drop
  table beside `OBSTACLE_WEIGHT_PROFILES`, not in the engine.
- **Hideout side:** idle events keep paying only via `hideoutRewards.ts` caps.
  Add 5-6 new choice events tied to crew bonds and weather (rain = roof leak
  repair, fog = lost-pet search).

## 6. Hideout life (continues the strip scenery work)

- Time-of-day tint on the painted backdrops from the wall clock.
- Window silhouettes of crew moving behind lit windows.
- Pets react to the new beats: after a run with a stampede they are jumpy for a
  minute; after a block party they dance (a `HideoutEmote` + a mood field).
- A per-room leitmotif that locks to `beatBus` tempo when the player's own music
  plays (see `hideout-scenery-and-melody.md` "Ideas not built").

## Suggested order

1. **Event Director + 2 beats** (Supply drop, Rush-hour stampede) — the framework
   and a visible win. One hook in `world.ts`, rest is data and tests.
2. **Temporary pickups** — small data table, immediately makes beats rewarding.
3. **Crew call-in** for 3 allies — biggest "characters matter" payoff.
4. **Tremor + chain reaction physics** — reuses the impact contract.
5. **Hit-stop tiers and combo music layers** — pure juice, low risk.
6. **Hideout crew schedules, bonds, choice events.**

Each step is its own release: one changelog bump, `pnpm typecheck && pnpm test`,
a playtest note, and the matching `.agents/memory` entry.

## Open questions for the owner

- Should events be on by default or an opt-in "Chaos" setting at first?
- Should crew call-ins cost the player an equip slot, or be free and weaker?
- How much screen shake / hit-stop is too much for the audience (kids, motion
  sensitivity)? Reduced-motion must disable all of it.
- Any events that are off-limits for tone (PG-13 / kid-safe rules in
  `crew-dialogue-rant.md` apply to all new text).

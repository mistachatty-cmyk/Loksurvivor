# Events, crew interactions, specials, resources and physics — plan

Status: **plan; shipped so far: Event Director + Supply drop + Rush-hour (v0.22.5), Magnet coil, Tremor (v0.22.7), crew call-ins (v0.22.9), Block party (v0.23.0), Blackout + Relay storm + 5 hideout choice events (v0.23.1), see `.agents/memory/run-events-director.md`. Everything else is unbuilt.** Drafted 2026-10-09 from a "make events
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

## 7. Unlock as you play (nothing arrives all at once)

New features must not dump on a new player or surprise a returning one. Use the
existing unlock machinery (`UnlockRule`, `MetaState` counters, `endgameUnlocks.ts`
gating) instead of a new system.

- **Run beats unlock in tiers by maps cleared** (`mapsCleared(meta)`): 0 maps = none
  (the base loop stays calm), 2 = Supply drop, 4 = Rush-hour stampede, 6 = Block
  party and Tremor, 9 = Blackout block, 12 = Relay storm. Each beat record carries
  `unlock: { kind: 'clearArea' | 'kills' ... }`, the same rule type areas use.
- **Pickups appear as you meet their source:** a pickup joins the pool the first
  time its elite/beat/prop kind is seen (tracked in the existing bestiary-style
  `Record<id, count>`), and the first one you collect shows a one-line tooltip.
- **Crew call-ins unlock per ally:** rescuing the ally unlocks the *slot*; using
  their call-in 10 times unlocks an upgraded version. Bonds unlock when both allies
  are rescued and have shared a run.
- **Hideout extras follow bond rank and rooms** (pet bond ranks, rooms unlocked),
  never the clock.
- **A "New this update" check:** when a save loads on a newer `CURRENT_VERSION`,
  the unlocks it is already eligible for are granted silently and listed once in
  the update dialog, so veterans see the new content without grinding. Tested the
  same way `changelog.test.ts` guards versions.
- **Off-switches stay:** every beat family has a Settings toggle (like quirks), and
  reduced motion disables shake, hit-stop and screen flashes.

## 8. Achievements (added after each system lands)

Achievements stay pure functions over `MetaState` in `data/achievements.ts`
(`isComplete` / `progress`, never a stored boolean; rewards are `cred`, `lootTokens`
or `cardCredits`, claimed once via `claimedAchievementIds`). Each system adds only
the counters it needs, then its achievements in the *same release*.

New counters (all concrete numbers, so `effectiveStats`-style arithmetic never
sees `NaN`): `beatsSurvived`, `beatsByKind`, `pickupsCollected`, `callInsUsed`,
`chainReactions`, `bondsFormed`, `hideoutEventsSeen`.

Starter list, one per system, tiered (3 / 25 / 100 style) where it makes sense:
- **Events:** *Rain Check* (survive a Supply drop), *Lane Discipline* (stand in the
  safe lane through a stampede), *Lights Out* (finish a Blackout block untouched),
  *Weather the Weather* (survive every beat kind).
- **Crew:** *Plus One* (use a call-in), *Best Friends* (form a bond), *Whole Crew*
  (all call-ins used in one run), *Plenty of Hands* (100 call-ins).
- **Pickups:** *Pocket Change* (collect 50), *Overclocked* (kill 100 with one cell).
- **Physics:** *Domino Effect* (a chain reaction), *Wrecking Crew* (three-cycle heat
  hazard created), *Hold the Line* (a tremor with no prop damage taken).
- **Hideout:** *Regular* (every room's idle event seen), *Good Dog* (max bond with
  every pet on the strip).

Rules: achievements are never required for core progress, never name the Surge's
cause, and use `beacon` / `pulse` / `relay` / `static` wording per the naming rule.
`achievements.test.ts` already checks unique ids, positive rewards and a zero-state
save; extend it to cover each new counter's default.

## 9. Review of the recent additions (hideout scenery + melody, v0.22.4)

Checked after the build: typecheck and all 882 tests pass; no naming-rule words in
new files; reduced motion renders a still frame. Follow-ups worth doing:
- **Cache the static backdrop.** The cellar brick wall and the skyline are redrawn
  every frame with fresh color strings. Render the static layer once to an
  offscreen canvas (re-render on resize / room change) and draw only lamps, windows
  and dust live. Matters most on low-end phones.
- **No Settings toggle for the melody.** It is gated by the existing
  Hideout ambience switch, but a separate "Room melody" toggle would let players
  keep the bed and drop the notes.
- **Add a test** for `BedProfile` melody (every non-snow profile has notes, notes
  are positive frequencies) and for `dustColorFor` covering every `HideoutBiome`.
- **No visual playtest yet.** Screenshot all five rooms at phone and desktop widths
  before the next release.

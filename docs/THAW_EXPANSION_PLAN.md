# The Thaw: expansion and Street Life plan

Status: plan only. Nothing here is built. Branch: `claude/thaw-expansion-plan`.
Rules this plan follows: procedural art only, no runtime AI, no new network calls, no emoji (docs/LOK_COST_DISCIPLINE.md, docs/LOK_DESIGN_STANDARD.md). Everything is data-driven: new records, not engine rewrites, except where a section says otherwise.

## 1. The pitch

Grand Rapids in the week the river ice breaks. The winter froze the digital city in place; now it thaws and everything starts moving at once. The expansion has two halves that feed each other:

- **The Thaw**: four new areas and a run-long Thaw meter (sections 2 to 4).
- **Street Life**: random prefabs, world events, power states and block milestones that make every street, in every mode, worth exploring (sections 5 to 9).

Design goal: add, never take away. Nothing existing gets weaker. Every new system is an extra reason to leave the safe spot, grab something, and feel a spike.

## 2. The Thaw meter (run-long mechanic)

A meter that rises during a run (kills, time, block crossings) through four stages:

| Stage | Look | Effect |
|---|---|---|
| Frozen | white, hard edges | Ice patches slow everyone. Enemies are tougher but stand still more. |
| Cracking | blue seams in the ground | Ice breaks under heavy hits, opening shallow water. Chilled enemies take bonus damage. |
| Running | water on the streets | Wet status spreads on contact. Wet enemies take bonus damage from lightning/spark-type hits. The player moves faster on water. |
| Flood | rising pulses of water every 20s | Pulses shove everything toward the edge and soak it. Big payouts for surviving each pulse. |

Combos reward the new cast without hurting the old: Lake Effect and Rink Rat feed Frozen and Cracking, Upstream Fenn feeds Running, Pier Beacon lights flood pulses so they hit harder. Existing characters get the combos too, just with fewer triggers.
Tuning rule: every difficulty effect is composed inside the existing endless caps (hpMult 1.7, spawn rate 3.2/s), never stacked on top.

## 3. Areas

1. **River Walk (frozen)**: long straight boardwalk, ice sheets, benches and lamp posts as cover. Teaches Frozen.
2. **The Dam and fish ladder**: stepped lanes, water pulses on a visible timer, leaping fish enemies. Teaches Running.
3. **The Pier at dusk**: dead-end lanes, the beacon sweep reveals hidden enemies for a moment. Teaches light and dark.
4. **Flooded Underpass (finale)**: narrow tunnels, constant water, the boss.
Each unlocks by clearing the one before it, as with existing areas.

## 4. New faction: Melt Choir

A roster registered in factions.ts so squadWave() can spawn it whole. Ideas (names are placeholders): Drip (small chaser that leaves a puddle), Icicle Drop (falls from above after a telegraph), Floe Ram (charger that shatters into two slow chasers), Eddy (orbits the player like the ringer behavior), Surge Caller (buffs nearby Melt Choir during Flood). Boss: **The Dam Warden**, a three-phase fight tied to the Thaw stages (Frozen shell, Cracking armor, Flood burst).

## 5. Street Life: random prefabs on the open streets

Goal: the grass and sidewalks are never just filler. Each endless block rolls from its seed (never w.rng, so seeded runs stay deterministic) for zero to two street prefabs from a weighted table. Prefabs are small authored scenes placed in the open, not inside buildings, so they do not touch the building/door system.

Starter catalog (all procedural art):

| Prefab | What it is | Payoff |
|---|---|---|
| Boulder (two kinds, section 6) | big rock on the grass | roll-damage or slow-break loot |
| Dumpster Fire | burning bin, enemies spawn near it in small groups | burn damage zone, rare resource drop |
| Rogue Vending Machine | already exists as an obstacle; make it a prefab with a "kick it" interaction | random snack buff for 60s |
| Busker Stage | a looping act in the open | standing near it grants a small regen or haste aura |
| Pothole Garden | a cluster of potholes with a loose chest in the middle | risk and reward |
| Street Race Gate | two arches 400 units apart | beat the timer for a chest, feeds speed runs |
| Glitch Puddle | a patch of corrupted ground | step in for a 10s random mutation, good or bad |
| Wishing Fountain | pay a few cred | random stat nudge or a joke curse |
| Parade Float | slow roaming platform with guards | destroy it for a big drop |
| Tipped Garbage Truck | big movable cover, breaks into loot | tactical cover plus loot |
| Pigeon Flock | a large flock lands and idles | scatter it with a hit for a speed burst |
| Lost Pet | a LokPet-style creature stuck somewhere | rescue for a pet card or ally boost |

Implementation: one new `data/streetPrefabs.ts` record list (id, footprint, weight, district tags, min block distance) plus one placement pass in chunk generation that respects the existing door lanes and crossings, with the same generation test used for supplies (checks the spot is clear across sample seeds).

## 6. The Boulder (your idea, specified)

A big rock that spawns now and then on open grass. The player runs into it and hits it; hits give it momentum. Two seeded variants:

- **Roller**: stays a big boulder for a long time. Every hit sends it rolling in the hit direction; it deals damage to enemies it touches, stronger at speed, and bounces off obstacles. Good for crowd control. Despawns when far behind.
- **Crumbler**: every hit and every enemy it rolls through shaves it smaller. As it shrinks it gets faster. When it reaches the smallest size it breaks and pays a random drop from a table: a chest, a power state (section 7), or a resource. A small chance gives an extra rare reward.

Telegraph: a faint dust ring and a cracking sound cue so players can find it. Reduced motion: no screen shake. Both are driven by a small physics record (mass, friction, damage per speed) and use the existing damageEnemy() choke point so crits and passives apply.

## 7. Power states (the "golden Mario" idea)

Time-limited states that change how the character plays, not just numbers. Original names and art, no copying of any existing game.

- **Gilded**: gold glow, a short window of invulnerability to contact damage, kills burst into coins, a bonus to damage. The "golden" state. About 12 seconds.
- **Supersonic**: big speed boost with a trail, dashes cost nothing, and anything you run through takes small damage. About 10 seconds.
- **Heavy**: slow, huge and hard to push; shock waves under each step.
- **Magnet Storm**: pickups from across the screen fly to you.
- **Ghost Lane**: pass through enemies and obstacles briefly.
- **Giant Mode**: a short growth burst that makes weapons larger.
Each state is a record (id, durationMs, stat multipliers, visual rig overlay, an end-of-state warning flash so it is fair). They can also become character kits: a future character could start the run with a charged state, or an evolution could trigger one. States stack only by refreshing duration, never by multiplying.

## 8. Block milestones (every 5 blocks)

Each time the player has crossed 5 more new blocks, they get a small bonus to one random stat, with a short, clear pop-up and a counter on the minimap. Spec questions to settle before building:

1. Is the bonus 0.5 flat points, 0.5 percent, or a 0.5 step on the multiplier scale the stats already use? The plan assumes a small multiplier step per stat (for example +0.5 percent damage, +0.5 percent speed), not a flat number.
2. A cap on total milestone stacking so runs stay inside the endless difficulty caps.
3. Whether the milestone roll is seeded, so a seeded run gives the same bonuses.
4. Every 25th block gives a bigger pick-one choice, so long runs feel like they are going somewhere.
Also: a "block streak" display and a district name card as you cross into new areas.

## 9. More random events (digital world, nothing off the table)

Added to the existing run events (supply-drop, rush-hour, tremor, block-party, blackout, relay-storm). Each is a record plus one case in updateRunEvents, seeded:

- **Gravity Hiccup**: gravity flips for 6s; knockback goes the other way.
- **Reskin**: every enemy swaps to a harmless goofy palette and gets half health for 8s.
- **Free Fall**: floors drop out in a ring; fall in for a bonus room.
- **Duplicate Player**: a delayed ghost of you repeats your last 5 seconds and attacks.
- **Loading Screen**: the world freezes except you for 3s.
- **Patch Notes**: a random enemy trait is nerfed and a random weapon buffed, announced in a banner.
- **Lag Spike**: enemies teleport in short hops for 8s.
- **Free Trial**: a random weapon is maxed for 15s.
- **Traffic Jam**: cars appear as moving walls.
- **Ad Break**: a harmless billboard demands a quick tap for a reward.
- **Heist**: a fleeing target carries a chest; chase it down.
- **Crowd Cheer**: stand in a ring marker to fill a meter for a drop.
Events escalate in frequency with distance, but a hard cap keeps them from overlapping more than two at a time.

## 10. High-dopamine loop checklist

- Every 30 to 60 seconds, something new pops (prefab, event, milestone, state).
- Big payouts come with a clear, short warning and a clear, short payoff (no waiting).
- Near-miss rewards: grazing a hazard fills a small bonus meter.
- Speed-run support: a timer per area, a ghost-free best-time record in local save, and prefab-skipping routes.
- Variety guard: the seed shuffles which prefab and event appear, so two runs differ.

## 11. Backend notes (not built, save for later)

- Shared best-time leaderboards per area and daily Thaw level.
- Daily seed shared by all players, plus a friends list ghost.
- Cloud saves for milestone and prefab discovery progress.
These need a backend and an account check, so they stay as notes until the owner approves hosting cost.

## 12. Phases

1. **Prefab framework + Boulder**: streetPrefabs.ts, the placement pass, the two boulder variants, tests.
2. **Power states**: state records, the render overlay, drops from boulders and chests, tests.
3. **Block milestones**: counter, bonus roll inside caps, UI, tests.
4. **New events batch 1** (Gravity Hiccup, Reskin, Loading Screen, Patch Notes, Free Trial).
5. **Thaw meter + River Walk + Melt Choir (first 3 enemies)**.
6. **Dam, Pier, Underpass, boss.**
7. **Events batch 2, remaining prefabs, speed-run timers.**
Each phase ships on a side branch with its own changelog bump, ASSETS.md regeneration and test pass. No deploy tags until the owner says.

## 13. Risks

- Too many pop-ups at once: cap simultaneous events and prefab prompts.
- iPhone performance: boulder physics and flood effects must stay in the existing spatial-hash budget; test on a real device.
- Seeded determinism: all rolls use the run seed, not w.rng.
- Balance: milestone and power-state bonuses must compose inside the endless caps.
- Accessibility: reduced motion removes shake and strobe; states and events always have text as well as color.

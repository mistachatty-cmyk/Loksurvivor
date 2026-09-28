---
name: Data Goblins and the Rapid pressure-room rescue
description: Canon and implementation notes for raw data breakage, the cut-off Rapid shelter, failed Digi-Arches, and Data-Gob behavior.
---

# Data Goblins / Data-Gobs

Data Goblins are small roaming creatures that feed on **raw data breakage**.
They are not ordinarily trying to hurt the player. Their first target is an
exposed piece of the world: pipes, pressure doors, Digi-Arches, vehicles,
crates, watches, brick seams, or any other object whose rendered surface has
started revealing raw data underneath. If no edible object remains, they can
chew the survivor because people in this world are data-bearing too.

`EnemyDef.traits.dataChew` owns that preference. The engine sends a Data-Gob
toward the closest live breakable prop, adds visible `rawDataBreakage`, and
deals structural damage on the authored bite cadence. Defeating a member of
the faction releases swallowed packets and reduces nearby breakage. This keeps
them mechanically distinct from a normal chase faction while preserving the
existing enemy and obstacle simulation.

Raw data breakage is universal setting canon: everything in 616 trends toward
it when not maintained. The first playable implementation is data-driven via
`AreaDef.rawDataBreakage` and lives in the Rapid pressure wing. The value is
visible on `BreakableObstacle.rawDataBreakage`; it produces green/yellow raw
pixel gaps and makes the prop more vulnerable to further damage. Future maps
may opt into the same rule without hard-coding another area id.

# The cut-off Rapids

The Rapid faction's handcrafted emergency teleport routes are **Digi-Arches**.
Their portable emergency exits remain **Digi-Watches**. The arches stopped
working during an evacuation, leaving part of the faction isolated in sealed
emergency-pressure rooms. Data-Gobs followed the failing arch code and nested
in the pressure wing, chewing the remaining conduits and door data.

The authored area `rapid-pressure-rooms` unlocks after GRPD Station. Clearing
it grants `rapid-pressure-rooms-cleared` and opens the `rapid-shelter` hub
location. Repeat clears use the existing rescue-route mechanism to free three
named Rapids in order: Patch Mercer, Mara Vance, and Latch Brooks. This is a
plural rescue without widening the save or run-result schema: one person is
freed through the established rescue interaction per successful run, while
the first clear reconnects the whole shelter for travel and story purposes.

The four-member enemy roster is registered as the **Data Goblins** faction:
Data-Gob Nibbler, Pipechewer, Brickbiter, and the Arch-Gnawer. "Data-Gobs" is
the ordinary street-shortened name; both forms are canonical.

# Director archive completion

The GRPD Digital Archive has three selectable personalities after they are
defeated: Take Two (`take-two`), the Warden (`the-warden`), and the Promoter
(`the-promoter`). Before the player has selected an unlocked personality, any
one of the three can invade a run so none is progression-locked behind its own
selection. The Warden increases hostile health and arrival rate throughout a
run. The Promoter favors High Roller Syndicate waves. Take Two preserves the
original neutral ruleset.

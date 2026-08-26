# Endless City Map

## Block grammar

Endless Streets is a deterministic grid of 640-world-unit blocks. The player
moves through connected street space, while each block contributes:

- a stable coordinate and perimeter
- a horizontal or vertical street spine
- four tall, non-walkable building footprints around the route
- a block identity such as storefronts, residential, parking, industrial,
  park, bridge, or river-edge
- authored props, foliage, hazards, and optional building doors

Block coordinates are generated from the run seed and grid coordinate. The same
seed produces the same block identities, footprints, doors, dungeon entrance
locations, and river crossings on every run. Chunks outside the five-by-five
streaming window are unloaded, but their coordinate-derived content can always
be rebuilt.

## River crossings

Every sixth city row contains a persistent horizontal river band. River banks
are collision obstacles, with one bridge-sized opening at the block center.
The crossing remains aligned as neighboring chunks stream in, so the river
reads as a boundary rather than a random obstacle field. River-edge blocks
retain their normal building and prop composition around the water.

## Building interiors

Marked doors trigger a short transition into a bounded 420×320 interior. The
interior is centered on the door and has a single exit. The street return
coordinate is stored separately from the interior coordinate, so leaving a
building returns the player to the same block without a camera/world
teleport. Building visits do not consume dungeon visits.

## Minimap

The run HUD minimap is driven by the current world snapshot. It shows the
loaded block grid, river bands and bridge gaps, building doors, the player
center, the current block identity, and dungeon room progress. It stays compact
on desktop and moves below the top HUD on narrow touch screens.

## Dungeons

Dungeon entrances are one-use markers in the streamed city. Each visit has
exactly three bounded rooms. Reaching the exit in room one or two loads the
next deterministic room; reaching the final room spawns The Sire with
`1000 × current player level` effective health. The final-room chest remains
locked until the boss is defeated and grants three existing loot prizes once.
Returning through the final exit restores the street obstacle set and the
stored street return position.
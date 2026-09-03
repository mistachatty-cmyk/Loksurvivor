# Endless map: structured city pass

This is the next-map plan, not part of the current customization release. The existing Digital District road remains a biome rather than being discarded.

## Design target

Make Endless read as a navigable place while preserving its unstable digital character. A player should be able to name where they are, anticipate danger from the block shape, and make route decisions without opening a full-screen map.

## World grammar

- Build the city from authored block modules: intersections, alleys, courtyards, storefront rows, parking lots, overpasses, parks, and dead ends.
- Join modules with rules that guarantee a readable main route, optional risk loops, and recovery spaces.
- Treat the current abstract road as the Digital District, with glitches and visual corruption increasing toward its center.
- Add the Forest Fringe as a second biome with trails, clearings, creek crossings, ranger structures, and obscured shortcuts.
- Use transition blocks—rail corridors, service roads, and drainage channels—so biome changes feel physical rather than instantaneous.

## Play structure

- Give each block a threat budget and a readable identity: swarm, ranged pressure, pursuit, elite holdout, rescue, resource, or quiet landmark.
- Tie enemy families to districts, then add controlled incursions so difficulty changes without becoming random visual noise.
- Telegraph entrances, exits, hazards, and locked routes through lighting and landmark silhouettes.
- Reserve large celebration, chest, and level-up presentation for safe pockets; keep combat-route notifications compact.
- Keep the pause map as the detailed planning view and show only the next intersection plus objective direction during live play.

## Delivery slices

1. Block-module renderer and deterministic route seed.
2. City landmark set and intersection navigation.
3. District enemy ecology and encounter budgets.
4. Forest Fringe modules and biome transitions.
5. Map readability, mobile performance, and encounter pacing audit.

## Acceptance checks

- A new player can identify their route at a three-way intersection in under two seconds.
- No required route is hidden behind scenery or an overlay.
- Every generated segment has a reachable exit and an off-route reward or tactical choice.
- Enemy density has deliberate peaks and recovery valleys rather than a continuous wall.
- The Digital District still feels recognizably like the current Endless road.

---
name: Endless mode engine
description: Durable architectural decisions for the unbounded endless world.
---

# Endless Mode Engine — Key Decisions

**Why dungeons are centred on the player's world-space entry position:**  
No coordinate system switch is needed. All dungeon obstacles, the exit zone, and the arena clamp bounds are offsets from `(dungeonCenterX, dungeonCenterY)` — which equals the player's position at entry. Moving the dungeon around the player (rather than teleporting the player into a separate space) eliminates camera jumps and keeps the world model flat.

**Why chunk obstacles lose their `kind` field:**  
`w.obstacles` is `Aabb[]` (plain collision rects). Storing visual kind there would require touching the collision type for a purely aesthetic concern. Instead, `draw.ts` infers the kind from dimensions via `inferObstacleKind`. This is good enough at game zoom levels; improve with a proper visual layer if kinds need to be exact.

**HP cap on endless difficulty:**  
`hpMult = Math.min(1.7, 1 + tier * 0.07)` — without the cap, HP grows without bound as tier climbs, making the run arbitrarily impossible. Spawn rate is separately capped at 3.2/s.

**Block grammar for streamed city content:**  
Endless city chunks are 640-unit blocks with a deterministic street spine, four blocking corner footprints, a block identity, optional river row with a centered crossing, and optional enterable doors. Keep these features coordinate-derived so unloading/reloading cannot change the route.

**Why:**  
The block mechanic makes unbounded travel legible and gives the minimap a stable unit of navigation instead of exposing a noisy prop field.

**How to apply:**  
New endless districts should vary block identity and dressing without changing the shared grid, crossing alignment, or player return-coordinate behavior.

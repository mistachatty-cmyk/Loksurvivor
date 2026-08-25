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

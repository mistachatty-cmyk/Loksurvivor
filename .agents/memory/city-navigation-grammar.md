---
name: City navigation grammar
description: Durable rules for readable endless-mode river crossings and landmark blocks.
---

# City navigation grammar

River rows are intentionally not uniformly crossable: deterministic bridge columns provide the safe route, while the intervening river-edge blocks remain impassable. Named landmark metadata is shared by the world snapshot, canvas renderer, minimap, and entry cue so navigation tells one consistent story.

**Why:**  
Long endless runs need a route the player can recognize before reaching it, without adding a separate navigation system or pausing combat.

**How to apply:**  
When adding a new streamed district, preserve the bridge/edge distinction and expose any new landmark through the same snapshot metadata rather than creating renderer-only special cases.
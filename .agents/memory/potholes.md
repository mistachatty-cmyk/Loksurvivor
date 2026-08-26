---
name: Pothole impact contract
description: Durable rules for the lethal pothole hazard and its interaction with impact physics.
---

Potholes must be activated by an explicit authored stomp or ground-shock trigger; impact intensity alone is not sufficient. They remain separate from solid obstacles so they never block actor movement or projectiles.

**Why:**  
The hazard needs predictable authoring and must not make ordinary bullets, melee hits, or incidental prop impacts unexpectedly lethal.

**How to apply:**  
Prop-impact plumbing should carry the trigger metadata end to end, and world/room/chunk replacement should resolve old pothole records before creating the next set.
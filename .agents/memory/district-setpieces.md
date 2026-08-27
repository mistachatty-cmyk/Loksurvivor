---
name: District setpiece contract
description: Durable design constraints for authored landmark encounters in 616 Survivor.
---

District landmark encounters should be optional, selected from the run seed, and modeled as phases inside the shared world simulation rather than as separate combat loops.

**Why:**  
The base bullet-heaven loop must remain replayable and safe when an encounter is skipped, failed, paused, or interrupted by the normal run outcome.

**How to apply:**  
Use authored warning/active/complete/failed phases, existing enemy/prop/effect/reward paths, bounded idempotent payouts, explicit cleanup, and serialized HUD/result state for any future district setpiece.
---
name: Development unlock mode
description: Rules for the development-only all-unlocks switch.
---

The all-unlocks switch is development-only and persisted with the local save. It affects unlock evaluation for characters, areas, and hub rooms without rewriting normal progression records, so turning it off restores the player's real progress.

**Why:** Designers and collaborators need to reach every game surface quickly, while ordinary progression data must remain trustworthy and reversible.

**How to apply:** Keep the switch behind the Vite development check, expose it from the hideout, and derive unlockable collections through the shared unlock evaluator.
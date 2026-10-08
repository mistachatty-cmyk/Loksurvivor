---
name: Enemy quirks and the Quirk Surge
description: Why quirks roll from a hash, how they are gated, and the Surge/Everywhere/Take-it-on rules.
---

Quirks (`data/enemyQuirks.ts`) are random per-enemy effects. The roll uses `quirkHash(seed, uid, salt)`, never `w.rng`, so seeded runs and deterministic tests do not shift when quirks exist.

**Gating:** quirks are the `enemyQuirks` end-game (Victory Lap) feature with a master switch and one switch per quirk (stored in `survivor616.quirks.v1`, see `state/quirkStore.ts`). Each quirk counts kills in `meta.quirkKills`: 1,000,000 unlocks Everywhere (every enemy, bosses included), 2,500,000 unlocks Take it on (the player gains the effect). Both default off and are ignored until earned.

**Quirk Surge:** one 20s window per run, 90 to 210s in. Off below 14 cleared maps, a 25% chance per run at 14+, every run in the end game while the `quirkSurge` switch is on. It works without the quirks feature. Survivors get a bonus drop and `meta.quirkSurgesSurvived` goes up.

**Lore** (`data/quirkSurgeLore.ts`) is deliberately vague and kept out of `lore.ts` so it does not need the gsix.online hub sync. Never name a cause for the Surge.

**Not done:** the quirk UI strings are hardcoded, not in `locales/en.json`.

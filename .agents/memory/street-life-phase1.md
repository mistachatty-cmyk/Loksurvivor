# Street Life phase 1 (boulders and power states)

- Boulders are obstacle kinds (`boulder`, `boulder-crumbler`), not a new actor: they reuse prop physics (like `ice-block`) so existing weapons, knockback and moving-prop damage apply. Roller never breaks; crumbler has hp, shrinks its w/h as hp falls (WeakMap of base size in world.ts) and pays `crumblerReward` on break.
- Placement is deterministic from chunk coords and prop index in chunks.ts, with no extra rng() calls, so existing chunk generation did not shift.
- Power states live in `World.powerState` (Gilded: no contact damage, damage x1.35; Supersonic: speed x1.6). One at a time, refreshing never stacks. A character can grant one on its ultimate with `ultimatePowerState`.
- LokPet Collectors get an extra chance at a Lock Pack from every crumbler (floorPackChance scaled).
- Still to do from docs/THAW_EXPANSION_PLAN.md: more prefabs, block milestones, events, Thaw meter and areas.

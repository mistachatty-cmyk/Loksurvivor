# Weapon milestones (0.42.52)

A weapon can carry `milestones` (types.ts `WeaponMilestone`): a data-only growth path. At the listed weapon levels it adds effects instead of only raw numbers (extra count, surge, hit burst, echo, every-Nth-cast slam, potholes).

- Logic lives in `engine/milestones.ts` (`reachedMilestones`, `milestoneEffects`, `claimMilestones`, `surgeActive`, `everyNth`). `world.ts` only hooks them: `syncWeaponMilestones` each frame, `updateOrbiters` (surge, hit burst) and the wave case of `fireWeapon` (echo, casts, slam, potholes).
- `claimMilestones` adds a milestone's `bonusCount` exactly once and stores `RunWeapon.milestoneLevel`; never re-add on each frame.
- Only `spoke-halo` and `jean-quake` (data/creatorPair.ts) have milestones so far. To give another weapon a path, add `milestones` to its record; no engine change is needed unless it needs a new effect kind.
- `CharacterSelect.tsx` lists the path (`data-testid="weapon-path"`); level 8 tints the wheel in draw.ts.

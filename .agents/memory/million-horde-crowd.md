# Million Horde crowd layer

## Contract

- `engine/hordeField.ts` stores the crowd as typed arrays (x, y, kind): ten bytes per member, no objects, nothing allocated while playing. Capacity is device-tiered (`performanceProfile.millionHordePopulationCap`, 2M phone to 10M desktop).
- Members are real: individual positions, individual kills. There is no "represented count"; the old per-spawn 2048x credit on kills was removed.
- The crowd never touches combat. Members walk to a shell just inside the camera edge and are *promoted* into ordinary `EnemyActor`s as live-actor slots free up (`updateHorde`), so every weapon/status/kill still flows through `damageEnemy`. Live actors stay capped by `millionHordeActorCap`.

## Performance contract

- `HordeField.sweep` visits a fixed member budget per step (whole 1024-member blocks, round-robin), so cost is flat from 1M to 10M. A block visited less often just strides further (stamped per block, capped at 6 s). Members within +/-40 units of their shell radius are left alone, which is why the camera margin in `setHordeView` is wider than that slack.
- The shell is an ellipse (`hordeView.ky` stretches y) hugging the camera box; `RunScreen` reports the camera via `setHordeView`. Spawns are deliberately not clamped to the arena: in a small arena the shell sits past the walls.
- Spawn cost per step is bounded (`HORDE_FEED_BUDGET_PER_STEP`); excess spawn credit is throttled, never hoarded.
- Drawing is a bounded sample of in-view members (`field.visible` ring, validated at draw) in two batched paths, plus a constant-cost screen-edge glow that scales with population.
- The sweep must stay deterministic: only sim clock and player position, never wall-clock time.

## Measuring

- `pnpm exec tsx scripts/bench-sim.ts 60 million|unleashed|normal` -- headless sim cost per step (avg/p99/max).
- `node scripts/bench-render.mjs million 600 1` -- engine plus `renderWorld` in headless Chromium (JS draw cost is meaningful; the raster flush is software and only relative). `SHOT=path.png` saves the canvas.
- Baselines at 1,000 live actors (desktop tier): sim 1.95 -> 0.8 ms/step; million mode with 10M members ~2.0 ms/step; draw JS 14.1 -> 8.0 ms avg, p99 68 -> 30 ms.

## Related engine changes made alongside

- `engine/cellGrid.ts` replaces `Map<number, T[]>` for the enemy and obstacle grids (open-addressed, bucket arrays recycled on clear).
- Crowd separation sweeps each occupied cell against itself and four forward neighbours (`separateEnemies`); bosses/giants (radius > `SEPARATION_SMALL_RADIUS`) take a wider per-actor scan.
- `drawRig` blits a baked frame with no save/restore/transform (mirrored variants are baked), and the death dissolve batches each part's surviving cells into one path. Verified pixel-identical to the previous renderer across ~15k rig/anim/facing/scale/option combinations.
- Still open: 120 Hz rendering runs the sim at a fixed 60 Hz step with no render interpolation, so a 120 Hz screen shows 60 distinct frames. Fixing it means interpolating or sub-stepping and was left alone because it affects gameplay tuning.

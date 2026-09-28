# Million Horde performance contract (2026-09-28)

Million Horde represents up to 10,000,000 enemies without creating one JavaScript actor per enemy.

## Architecture

- Fully simulated enemies are the near-field combat layer. They retain collision, attacks, drops, status effects, animation, and normal targeting.
- Every Million Horde spawn also adds an aggregated population cell. The aggregate is numeric state plus a constant-cost density drawing pass.
- Defeating a live actor removes its matching aggregate cell, but virtual members never generate duplicate XP, loot, or achievement credit.
- Spawn cadence is 16x and overrides the 2x, 4x, and Unleashed cadence choices rather than multiplying with them.

## Device budgets

Runtime tiering is capability-based so newer phones inherit sensible defaults without a model-name list.

| Tier | Performance | Balanced | High |
| --- | ---: | ---: | ---: |
| Compatibility phone | 120 | 180 | 240 |
| Standard phone / browser | 220 | 320 | 420 |
| iPhone 17 Pro-class | 300 | 480 | 720 |
| Desktop browser | 420 | 700 | 1,000 |

Challenge density may fill a budget faster but never raises its hardware ceiling. Projectile and enemy-effect budgets remain bounded during the mode.

## Navigation repair

Authored Odd Routes are the Bonus Maps category. Standard, Bonus, 2x, and Infinite classification is mutually exclusive. The category row owns horizontal overflow so narrow phone layouts scroll the tabs instead of widening the page.

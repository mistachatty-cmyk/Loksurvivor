# Damage numbers

The number that floats off an enemy when you hit it. Chosen in **Settings -> Damage numbers**
and saved per player (`MetaState.damageNumberStyle`, default `classic`). Display only: the style
never changes damage, difficulty or rewards.

## Styles

| Style | What it does |
| --- | --- |
| `classic` | The original popup: one number, 700 ms, yellow (red for a crit), drifts down. In dense swarms only crits and about one hit in eight show. |
| `cascade` | Lives 1.5 s or longer, rises above the enemy, stacks with that enemy's recent numbers, and changes color and size with the size of the hit. |

More styles are expected. Add one by extending `DamageNumberStyle`, adding it to
`DAMAGE_NUMBER_STYLES`, and giving it a `settings.damageNumbers.<id>` string in `en.json`
(other languages are filled in by the Auto-translate action).

## Cascade tiers

Tiers come from the damage actually dealt (after crit and beat bonuses). A crit counts as one tier
higher and gets a `!`. The table lives in `src/game/data/damageNumbers.ts` (`DAMAGE_TIERS`); change
numbers there, not in the engine or renderer.

| Tier | Damage from | Color | Size |
| --- | --- | --- | --- |
| 0 | 0 | `#e2e8f0` white | 12 |
| 1 | 8 | `#fde047` yellow | 13 |
| 2 | 20 | `#fb923c` orange | 14 |
| 3 | 45 | `#f87171` red | 16 |
| 4 | 90 | `#f472b6` pink | 18 |
| 5 | 180 | `#c084fc` violet | 20 |
| 6 | 400 | `#22d3ee` cyan | 22 |
| 7 | 1000 | `#fffbeb` gold-white | 25 |

Tiers 4 and up draw a colored glow (`GLOW_FROM_TIER`). Every number is outlined and pops in at 1.45x
for its first 140 ms, then fades over the last third of its life.

## Stacking and budgets

- Lifetime is `cascadeLifeMs(tier)`: 1500 ms plus 90 ms per tier.
- A new number on an enemy pushes that enemy's older numbers up 13 px. Each enemy keeps at most 6
  (`CASCADE_STACK_PER_ENEMY`); the oldest is dropped.
- Screen budget is 110 numbers, or 60 when the run is dense for the player's graphics quality
  (`isDenseForQuality`). When dense, only tier 3+ hits, crits and one in three of the rest are shown.
- The renderer's own visual-budget limits still apply (18 numbers on minimal, 28 on reduced), and the
  glow is skipped on minimal.

## Where it lives

- `src/game/data/damageNumbers.ts`: styles, tier table, helpers.
- `engine/world.ts`: `pushCascadeNumber` (called from `damageEnemy` when the style is `cascade`),
  `Popup.tier/lifeMs/ownerUid`, popup expiry in the step loop.
- `render/draw.ts`: `drawCascadePopup`, called from `drawPopups` for any popup that has a `tier`.
- `state/metaStore.tsx`: the setting. `ui/SettingsPanel.tsx`: the picker. `RunScreen.tsx` passes it to the world.
- Tests: `data/damageNumbers.test.ts`, plus a stacking test in `engine/world.test.ts`.

## Not built yet (ideas for later styles or tiers)

- Crit and top-tier bursts: a shockwave ring, sparks or a screen-space flash behind the number.
- Number merging for rapid ticks (burn, acid, splash) into one growing total.
- Per-element colors (fire, acid, shock) layered over the tier color.
- Number shake or a sway path for the highest tiers; font-weight and outline variants.
- A player-facing preview in Settings, and a third style selectable the same way.
- Player-hit numbers (these only cover damage dealt to enemies).

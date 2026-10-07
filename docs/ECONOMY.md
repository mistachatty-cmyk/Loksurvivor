# Economy

What the player earns and spends, and the rules that keep it from inflating. Numbers here were read from the code on 2026-10-07; when code and this file disagree, the code wins and this file needs a fix.

## Currencies

| Currency | Scope | Earned | Spent |
|---|---|---|---|
| Cred | Device save (`meta.cred`) | Per run, hideout generators, small hideout rewards | Quartermaster, Relic Workshop, most rooms |
| Loot tokens | Device save (`meta.lootTokens`) | Runs | Customization Shop (palettes, run auras). Hideout rewards never touch it |
| Skeleton keys | Device save (`meta.skeletonKeys`) | Rarer drops | Quartermaster items cred alone cannot buy |
| LokTokens | Account, shared across the Lok ecosystem | Server-side earn rules | Managed from Account. Palettes are LokToken-only |
| Card credits, LokPet treats, pet elixirs | Device save | Small hideout rewards | Card shop, LokPet care |

Player-facing wording lives in `ui/CurrencyGlossary.tsx`; keep it in step with this table.

## Hideout reward policy

Every hideout payout (props, pet play verbs, choice events) goes through `engine/hideoutRewards.ts#grantSmallReward`. Nothing else may write these rewards to `meta`.

| Reward | Daily cap | Per-grant max |
|---|---|---|
| cred | 60 | 15 |
| cardCredits | 3 | 2 |
| lokPetTreats | 2 | see code |
| petElixirs | 1 | see code |
| skeletonKeys | 0 | see code |
| petExp | 300 | see code |

- Rare finds: at most one a day and one per item cooldown. A blocked rare pays the authored fallback.
- At most three choice events a day.
- Bond growth is capped at 12 a day (`growPet`).
- Rare chance scales with bond (up to 2x at Soulbound); everyday payouts never scale.
- Claims are replay-safe through `hideoutClaims` timestamps.

## LokToken earn rules (`survivor616`)

Granted by the shared `lok-earn` edge function, never by the client. The function forces `trusted: false`, so it can only prove a signed-in user made the request.

| Event | Tokens | Daily cap |
|---|---|---|
| run_complete | 15 | 15 |
| area_cleared | 40 | 10 |
| boss_kill | 60 | 10 |
| arena_match_win | 50 | 10 |
| daily_login | 25 | 1 |

Live prices and rules in the shared `lok_catalog` and `lok_earn_rules` tables win over seed values in this repo. Details: `.agents/memory/lok-economy-integration.md`.

## Endless-mode difficulty caps

`hpMult` is capped at 1.7 and spawn rate at 3.2 a second. Any new difficulty multiplier is composed inside those `Math.min()` calls, never stacked on top. See `.agents/memory/endless-mode-engine.md`.

## Rules for changing the economy

1. A new source of cred, tokens or keys needs a cap, a place in the tables above and a test.
2. Every `BaseStats` field is a concrete number or `effectiveStats()` produces `NaN`.
3. Store items name a `currency` (`cred` default, or `skeletonKeys`). Refunds return the same currency.
4. No pay-to-win and no hidden odds. If a roll can pay out, the preview and the payout use the same seed.

## Open questions

- No sink balance sheet exists yet (income per hour against the price of the full Quartermaster list). Worth building before adding more sources.
- Skeleton keys have a hideout daily cap of 0, so the only source is runs. Confirm that is intended.

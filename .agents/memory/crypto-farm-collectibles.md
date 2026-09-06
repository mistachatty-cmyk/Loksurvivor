# Crypto farm & collectible cast cards

The hideout's crypto farm (`data/cryptoFarm.ts`, wired into `state/metaStore.tsx`,
UI in `ui/CryptoFarmPanel.tsx`) is a passive Digital Essence generator plus the
essence-pack shop and cast-card binder it feeds. Read this before touching any
of it.

## The meter is a pure function of elapsed wall-clock time, not a ticking timer

`replenishCryptoFarm(meta, now)` recomputes `cryptoFarmCharge` /
`cryptoFarmBankedCharges` from `cryptoFarmUpdatedAt` and the owned rate/capacity
tiers every time it's called — exactly the `replenishPetElixirs` idiom already
in this file, generalized from discrete batch grants to a continuous rate.
Nothing periodically ticks the store: `cryptoFarmLiveState()` (exported for UI)
can be called with `Date.now()` from a polling render loop for a smooth bar,
and every mutating action (`collectCryptoFarm`, `buyCryptoFarmCapacity`,
`buyCryptoFarmRate`) settles progress under the *old* rate/cap before applying
the change and resetting the timestamp to `now`. This is also why "rate
upgrades that work while you're gone" needed zero extra code: offline time is
just a longer `now - cryptoFarmUpdatedAt` gap, handled the same way a
5-minute gap is.

**Do not add a `setInterval` that dispatches ticks as the source of truth.**
`refreshCryptoFarm` exists only so other code that reads `meta.cryptoFarmBankedCharges`
directly (not through the live selector) sees a reasonably fresh value; it's a
convenience commit, not what makes the math correct.

## The tank caps out on purpose

Once `cryptoFarmBankedCharges` hits the owned capacity tier's max, `charge` is
pinned at 0 and stops accumulating (see the `isFull` check in
`replenishCryptoFarm`). This is deliberate, per the original ask ("stack up to
4 before you have to empty") — it's the idle-game "grandma is asleep" pattern:
running the tank dry is the cost of never coming back to collect. Don't let a
future "quality of life" pass make it accumulate past the cap; that removes
the entire reason capacity upgrades exist.

Reaching the last capacity tier (`CRYPTO_FARM_MAXED_LEVEL`) additionally
unlocks a chance for a collected charge to also drop a free essence pack
(`resolveCryptoFarmCharge` in `metaStore.tsx`) — this is what "allow purchase
of higher max ... which can drop essence packs" meant in the original request.

## Card art is always the live `RigPortrait`, never stored art

`OwnedCollectibleCard` stores only `characterId` + `rarity` + `variant`, never
an image. The binder (`CryptoFarmPanel.tsx`) resolves the character at render
time and draws its real procedural rig via `RigPortrait` — the same
"reference art is never shown raw in a card/panel" rule as
`survivor-616-art-assets.md`, just automatically satisfied here since there
was never an image to accidentally leak in the first place. Cards are rolled
from the *entire* `CHARACTERS` roster, including characters the player hasn't
unlocked yet, on purpose — a "collect the whole cast" incentive independent of
run unlocks (same idea as `let's spend it all`'s LOKdex letting you discover a
companion before playing it).

## The essence-pack ladder is the literal 1000/2000/3000/5000 ask

`ESSENCE_PACKS` in `data/cryptoFarm.ts` is Copper/Silver/Gold/Platinum at
exactly those cred costs, escalating essence yield, per-roll card odds, and a
rarity floor on the gold/platinum tiers' first roll. Keep the four fixed
prices if this table ever grows — don't quietly renumber them, the request
was specific about the ladder.

## Naming the "meter fills, then flows into the balance and counts up" effect

Asked what this pattern is called: the number rolling up to its new value is a
**count-up** (or "roll-up") animation — `useCountUp` in `CryptoFarmPanel.tsx`
does the same exponential chase as the run HUD's live cred counter. The small
particle that travels from the meter to the balance before the count-up lands
is a **flyout**. The sibling `spend-ut-all` repo already has a whole system
built around exactly this pairing — `game/micro-animation-types.ts`'s
`MicroMotionEvent` (`flyoutsEnabled` + `counterCountingEnabled` preferences)
and `app/components/MicroAnimationLayer.tsx` — and calls the umbrella concept
**"micro motion"**. That's the term to reuse if this pattern gets pulled out
into a shared helper for other reward moments in this game.

## Future direction: TCG / physical-style collectibles

The eventual trading-card-game / "pop out and collect physical cards or caps"
idea from the original request is *not* implemented here — it's a
recommendation-and-plan doc instead, at
`docs/CRYPTO_FARM_TCG_ROADMAP.md`. Read that before starting any of it; it
points at `spend-ut-all`'s existing LOKdex/Card Shop system
(`game/lokdex-types.ts`, `game/card-shop-types.ts`,
`integrations/lok/collectibles/`) as the cross-game backbone this game's cards
should eventually plug into, rather than inventing a second, incompatible
rarity/variant/ownership model.

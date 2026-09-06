# From crypto-farm cards to a cross-game TCG — plan & recommendation

This is the "eventually" half of the crypto farm request: a real trading card
game connected to 616 Survivor, with "popping out" cards as a celebration
moment and/or bottle-cap-style collectibles, rarity, and trading. It is a
recommendation and phase plan, not implemented code — the farm, essence packs
and local card binder shipped in this same change are Phase 0 below and are
already live.

**Bottom line recommendation: don't build a second card/inventory system.**
Two things already exist elsewhere in this account's repos that are exactly
the missing pieces, and using them is materially less work than it sounds:

1. `spend-ut-all` already has a complete card **data model** — rarity,
   print-variant, editions, releases, acquisition source, per-instance
   ownership — built for exactly this (`game/lokdex-types.ts`,
   `game/card-shop-types.ts`, `docs/LOKDEX_CARD_SHOP_ROADMAP.md`).
2. `Gsixhub` already has a **cross-game account + ledger plan** ("GSix
   Network": one sign-in, one balance, one save across every Lok game —
   `PLAN.md`, `README.md`) with a Postgres schema in `Lok-EcoSystsem` that
   already lists `lok_catalog`, `lok_inventory`, and `lok_entitlements`
   tables — i.e. cross-game item ownership was already scoped, just not
   built yet.

A 616-Survivor-only card system would end up duplicating both, badly, and
would need to be thrown away the moment the GSix Hub's shared ledger ships.
Building toward the shared model from day one costs little now and avoids
that rewrite.

## Phase 0 — done in this change (local, single-game)

- `artifacts/survivor-616/src/game/data/cryptoFarm.ts` — the crypto farm,
  essence packs, and a local `OwnedCollectibleCard` roll table.
- Fields (`characterId`, `rarity`, `variant`, `value`, `acquisition`-shaped
  `source`) are already named and shaped to match spend-ut-all's
  `LokDexOwnedCard` closely on purpose — see "Phase 1" below.
- The reward-reveal banner in `ui/CryptoFarmPanel.tsx` (essence count-up +
  card flyout) is the seed of the "popping out cards" celebration moment —
  it just isn't shareable across games yet because it's a local component,
  not a package.
- Cards are local to this game's `localStorage` save, not tradeable, not
  synced anywhere. This is fine for now and matches how every other Lok game
  currently works (see `Gsixhub/PLAN.md` finding #4: every game keeps its own
  points in the browser).

## Phase 1 — one card taxonomy, still local per game

Goal: 616 Survivor's cards and spend-ut-all's LOKdex cards become *the same
shape*, tagged by which game minted them, before either one talks to a
server. This is a data-modeling change only, no backend work.

- Extract a shared, dependency-free `@lok/cards` package (new workspace
  package, same pattern as `Gsixhub/packages/lok-skins`) defining:
  - `LokCardRarity` (`standard`/`uncommon`/`rare`/`legendary` — already the
    same values as this game's `CollectibleCardRarity` and spend-ut-all's
    `CustomizationRarity`)
  - `LokCardVariant` (`standard`/`foil`/`holo`/`gold`/… — union the two
    games' variant sets; spend-ut-all has more, e.g. `negative`/`glitch`,
    which is fine, this game just doesn't roll them yet)
  - `LokOwnedCard` = spend-ut-all's `LokDexOwnedCard` shape, generalized:
    `instanceId`, `characterId`, `editionId?`, `variant`, `rarity`,
    `sourceGame` (`'survivor-616' | 'spend-it-all' | ...`), `acquiredAt`,
    `acquisition`, `tradeLocked`, `transferCount`.
- Point both games' local types at it: 616 Survivor's `OwnedCollectibleCard`
  and spend-ut-all's `LokDexOwnedCard` become thin aliases (or are replaced
  outright) instead of two hand-maintained near-duplicates.
- Each game keeps its own character roster as the *card pool* — 616
  Survivor's `CHARACTERS`, spend-ut-all's `LOKDEX_CHARACTERS` — `sourceGame`
  on the owned card is what disambiguates when both pools eventually render
  in one binder.
- No server, no auth, no schema change yet. **Done when** a card pulled in
  either game round-trips through the same TypeScript type without a mapper.

## Phase 2 — cross-game ownership, riding the GSix ledger

Do this only after `Gsixhub/PLAN.md` Phase 1 (Lok Passport / shared sign-in)
and Phase 2 (ledger deployed) land — the plan already exists, this just
consumes it instead of inventing a parallel account system.

- Reuse the already-scoped `lok_inventory` / `lok_catalog` / `lok_entitlements`
  tables (see `Lok-EcoSystsem`'s schema, referenced from `Gsixhub/PLAN.md`)
  for card ownership instead of a new `cards` table. A card is just an
  entitlement row: account id, catalog item id (the `characterId`+`variant`
  combination), serial/instance id, source game, acquired-at.
- Ownership writes go through the same append-only-ledger discipline the
  token economy already uses (`lok_grant`/`lok-spend` edge functions,
  `lok_reconcile()`) — a card pull is a ledger event, not a mutable row
  update. This is what makes "someone duped a legendary card" structurally
  impossible instead of something to detect after the fact.
- Each game's local save (this game's `meta.collectibleCards`,
  spend-ut-all's `CardShopState`) becomes an **optimistic local cache**: keep
  writing locally first (so the game stays playable offline, matching
  spend-ut-all's own "Spend It All remains playable without an account"
  principle in `integrations/lok/account-sync.ts`), then reconcile against
  the server ledger when a session is signed in — same shape as
  `mergeRunIntoWallet` already does for the LOK currency balance, just for a
  list of owned instances instead of a number.
- **Done when** a card pulled in 616 Survivor while signed in shows up in
  spend-ut-all's `/cards` binder without either game's code knowing about the
  other directly — only the shared ledger.

## Phase 3 — trading

Spend-ut-all's own roadmap already flags this correctly
(`docs/LOKDEX_CARD_SHOP_ROADMAP.md`, "Auction House — future server phase"):
**do not build peer-to-peer trading as a local or per-game feature.** It
needs, at minimum: authoritative ownership (Phase 2, above), listing locks so
a card can't be listed twice, a transaction history, anti-duplication checks,
rate limits, and fraud controls. Build this once, in `Gsixhub` (it already
owns the shared ledger and account model), as a service every game's UI calls
into — a `POST /trade/offer`, `POST /trade/accept` pair backed by the same
Postgres instance, not a per-game trading screen. 616 Survivor's and
spend-ut-all's card binders become read/list UI over that one service.

Trade *value* (what a rarity/variant is "worth") should stay a display
convenience computed from the catalog's own base value and variant
multiplier (this change's `cardValue()` in `data/cryptoFarm.ts` is already
that function) — never a live market price. Keep spend-ut-all's existing
principle: don't promise real-world monetary value, and don't let a card's
rarity affect either game's actual simulation numbers.

## Phase 4 — the "pop out" celebration, and Snapple caps

Once Phase 1's shared card package exists, promote the reveal UI itself into
a shared, zero-dependency package alongside `Gsixhub/packages/lok-skins` —
call it `@lok/card-reveal` or fold it into `lok-skins` if that package is
already the home for "earnable cosmetic followed the player across apps."
It should own:

- The **count-up** number animation and **flyout** particle (see this
  change's `useCountUp` / flyout `motion.div` in `ui/CryptoFarmPanel.tsx`,
  and spend-ut-all's own prior art for the same idea:
  `game/micro-animation-types.ts`'s `MicroMotionEvent` +
  `app/components/MicroAnimationLayer.tsx`, which already calls this whole
  category "micro motion"). Standardize on that name across the ecosystem so
  it's one shared vocabulary, not "flyout" in one game and "micro motion" in
  another.
- A **pack-opening reveal** sequence (card flips/slides in, rarity-tinted
  glow, "NEW!" badge on a first-time character) — spend-ut-all already lists
  this under "keep rare pulls exciting through art, animation, provenance"
  as a principle; this is where that principle gets a shared implementation
  instead of two bespoke ones.

**Snapple caps**: model these as a second, lower-friction collectible tier in
the *same* inventory system from Phase 2, not a parallel one. Concretely: add
`kind: 'card' | 'cap'` to the shared catalog/entitlement row. Caps are cheap,
common, awarded far more often (e.g. every essence pack, or a small chance on
every farm collect regardless of rarity), carry no gameplay stat dormancy
concern the way LOKdex cards do, and exist mainly as a chunkier, more
frequent "number/collection count goes up" hook. They still ride the same
ledger, the same trade service (Phase 3), and the same reveal package (this
phase) — a cap is just a `kind: 'cap'` row with its own small rarity/value
table, reusing every mechanism above instead of re-deriving one.

## Summary table

| Phase | What ships | New infra required |
|---|---|---|
| 0 (done here) | Farm, essence packs, local card binder in 616 Survivor | None |
| 1 | Shared `@lok/cards` type package | A new workspace package, no backend |
| 2 | Cross-game card ownership | GSix Hub Phase 1 (passport) + Phase 2 (ledger) from `Gsixhub/PLAN.md` |
| 3 | Trading | One trade service in `Gsixhub`, built on Phase 2's ledger |
| 4 | Shared pop/reveal animation + Snapple caps | `@lok/card-reveal` package; caps as a `kind` on the Phase 2 catalog |

Each phase is independently shippable and none of them require redoing an
earlier one — Phase 0's local cards keep working unmodified through every
later phase, they just gain a server-synced twin once Phase 2 lands.

# The 616 Roster and tiered custom slots (2026-10-10)

## What this is

The Operator Forge's Operators tab got a browsable roster (`OperatorRoster.tsx` +
`game/data/characterForgeRoster.ts`): every one of the 69 hand-authored characters is
reinterpreted through the Forge's own procedural engine (`operatorForge.ts`,
unmodified) and shown below the creator, with the player's own saved custom operators
on top. Picking a card loads that `OperatorDesign` into the creator as an editable
starting point. Nothing about a `CharacterDef` -- stats, weapon, ultimate, in-run rig
-- is ever touched; this is purely a Forge preview/starting-point, same as picking a
species or flavor preset already was.

Alongside it, the Forge's custom save-slot ceiling grew from 5 to a tiered system:
8 slots earned purely by play (`CUSTOM_SLOTS` in `endgameUnlocks.ts`), then three paid
tiers layered on top, each slot still gated by its own play milestone *in addition to*
owning the tier:

- `LOKPASS_SLOTS` (6 slots, 9-14): needs **LokPass**, a one-time purchase.
- `PASSPORT_SLOTS` (10 slots, 15-24): needs an active **Lok Passport** subscription.
- `LIFETIME_SLOTS` (an initial batch toward 100, 25+): needs the **Lifetime Lok
  Passport**, a one-time purchase. Only an initial batch of milestones is hand-authored
  so far -- extend it by continuing the same four-category scaling formula used for the
  existing rows (+50,000 kills / +10 allies / +10 discoveries / +20 LokPet wins per new
  slot, cycling through the categories), not by inventing a fifth category.

Why milestone-only tiers weren't enough: the player explicitly wanted the *existing*
play-milestone pattern (5 slots, each earned its own way) extended all the way to 100,
but gated behind the Lok ecosystem's own purchase tiers above a free baseline -- so a
slot needs both to be earned *and* for its tier to be unlocked. These are deliberately
two independent conditions (see `SlotTier` on `CustomSlot`), not one combined gate,
so a slot a player already milestoned-out stays visibly "theirs" once they later get
the tier, rather than needing to re-earn it.

## Why there is no real payment processing here

This session's repository access was scoped to `loksurvivor` only. The user's own
answer named the services that should actually own LokPass/Lok Passport purchasing --
**lok lingu**, **kinetic souls**, **lokbook** -- and asked that a real Stripe
integration be wired up or the gaps filled in. None of those are reachable from this
repo or this session: no credentials, no deploy target, no way to verify a charge
actually happened. Building a "working" Stripe flow under those conditions would mean
fabricating something unverifiable, which is worse than being honest about the gap.

So this pass builds the `loksurvivor`-side half of the contract only, and documents
exactly what the other side needs to implement.

## The contract

- **State**: `MetaState.lokPassOwned` / `lokPassportActive` / `lokPassportLifetime`
  (`game/types.ts`), three independent booleans, default `false`, persisted with the
  rest of the save (`survivor616.meta.v1`).
- **Granting a tier**: call the `setLokPassportTier(tier, enabled)` action from
  `metaStore.tsx` (`'lokPassOwned' | 'lokPassportActive' | 'lokPassportLifetime'`,
  `boolean`). Today this is gated behind Dev Mode (`devModeAccessUnlocked`) purely so
  the tiered slots can be tested; **that guard is exactly what a real integration needs
  to replace** with "the Lok platform confirmed a purchase/active subscription for
  this account."
- **Reading a tier** (for anything outside React, e.g. `operatorForgeStore.ts`, which
  can't import `metaStore` without a cycle): read the raw `survivor616.meta.v1`
  localStorage key the same way `devModeForgeAccess()` already does, rather than adding
  a new import path.
- **UI surface**: `LokShopScreen.tsx` has a `Lok Passport` section, visible only once
  `useAuth().session` is truthy (login-gated, per the user's instruction). Its "Get"
  button calls `requestLokPassportPurchase(tier, devModeAllUnlocks, grant)`
  (`src/lib/lokPassportPurchase.ts`) -- **this one function is the integration point**.
  Replace its body with a real call to whichever Lok platform service ends up owning
  checkout/subscription state, then call `grant(tier, true)` on success. Until that
  exists, it only grants through Dev Mode and otherwise reports purchasing isn't live.
- **Slot gating**: `operatorForgeStore.ts`'s `earnedSlots()`/`earnedSlotCount()`/
  `isSlotTierUnlocked()` already combine "milestone reached" (pure, from
  `endgameUnlocks.ts`) with "tier unlocked" (reads the flags above) -- nothing else
  needs to change once the flags are set correctly by a real purchase flow.

## What NOT to do

Don't fabricate a working checkout flow, Stripe keys, or webhook handling inside this
repo -- there is nowhere for them to actually run, and claiming otherwise would be
worse than leaving the gap documented. Don't silently make the entitlement flags
player-togglable outside Dev Mode "to unblock testing" -- that would let anyone grant
themselves paid slots for free, defeating the entire point of the tiers.

## Cross-repo survey (2026-10-10): where each Lok app actually stands

The user pointed this session at four sibling repos (`Gsixhub`, `Lok-EcoSystsem`,
`LokLingu`, `LokBook`) and asked whether a real Stripe/Passport bridge already exists
somewhere to connect to. It does not -- here is the actual state of each, read
directly from their code and docs rather than assumed, so this doesn't need
re-deriving:

- **Lok-EcoSystsem** (`LokToken EcoSystem/LOK_ECONOMY.md`, `01_schema.sql`): the
  authoritative *design* for a shared, cross-app entitlement ledger. `lok_entitlements`
  already has the exact shape this needs -- `sku` values `'lokpass:<app>' |
  'lokpassport' | 'lifetime'`, a `source` column defaulting to `'stripe'`, a
  `stripe_ref`, `granted_at`/`expires_at`/`active`. But its own roadmap (section 8)
  marks this "Phase 4 -- Commercialize: wire the existing Stripe webhook to mint
  `lok_entitlements` rows," and only Phase 1 is marked "ready now." **Phase 4 has not
  shipped.** There is no deployed shared Supabase project backing this schema that
  this session could find or reach.
- **LokLingu** (`artifacts/lok-lingu/src/lib/entitlements.ts`): independently arrived
  at the identical stub pattern this repo uses -- a `TierId = 'free' | 'pass' |
  'passport' | 'lifetime'` model, a single `beginCheckout()` seam, and a code comment
  stating outright: *"Payments are deliberately not wired here... Nothing wired
  today, so this reports back that checkout is unavailable rather than pretending a
  purchase succeeded."* This cross-confirms the approach taken here (honest stub,
  one integration seam) rather than suggesting survivor-616 should have done more.
- **LokBook** (`supabase/functions/stripe-webhook/index.ts`): the one REAL, working
  Stripe webhook in the ecosystem -- but it is entirely siloed to LokBook. It verifies
  a Stripe signature and inserts into `lok_pass_purchases`, a LokBook-only table in
  LokBook's *own* dedicated Supabase project (its `.env.example` names a specific
  project ref). Its schema has no `lok_entitlements` table at all. This is almost
  certainly "the existing Stripe webhook" Lok-EcoSystsem's Phase 4 note refers to --
  but connecting it to the shared ledger is exactly the unshipped work that note
  describes, not something already done.
- **Gsixhub**: not investigated this pass (the survey above already answered the
  question that prompted it -- whether a bridge exists anywhere).

**Net conclusion**: every app in the ecosystem, this one included, is at the same
honest stopping point -- a documented seam, no live cross-app entitlement flow. Making
survivor-616's `lokPassOwned`/`lokPassportActive`/`lokPassportLifetime` flags backed by
real money requires, at minimum: the shared `lok_entitlements` schema actually
deployed somewhere live, this repo given real credentials to read it, and someone
deciding whether LokBook's live payment webhook gets modified to also write to that
shared project (a production-payment-system change with real blast radius, out of
scope for this pass -- the user asked for this cross-repo state to be documented, not
acted on). Until then, Dev Mode is the only grant path, by design, everywhere.

## Update (2026-10-10, later same day): the Passport tiers are real now -- just not via Stripe

The survey above is about *real-money* billing, which is correctly still unwired
everywhere. But it missed something already live in **this** repo:
`src/state/lokEconomyStore.tsx` is a real, working, server-authoritative LokToken
economy (`@workspace/lok-client`'s `spendLokTokens`/`fetchCatalog`/`fetchOwnedSkus`
against a real Supabase project), already used to sell palettes, auras, hats,
celebrations and drop packs for LokTokens. LokTokens are *earned in-game*, not bought
with real money anywhere in this codebase -- so a LokToken purchase needs no Stripe
bridge at all to be genuine.

So the three tiers are now sold exactly like every other LokToken-only cosmetic:
- `lokStoreCatalog.ts` gained `'passportTier'` as a `StoreItemKind` (added to
  `LOKTOKEN_ONLY_KINDS`) and `PASSPORT_TIERS: PassportTierDef[]`, mapping each tier to
  a `skuId` (`lokpass`/`lokpassport`/`lifetime`), its `metaFlag`, and a placeholder
  price (2000/5000/12000 tokens -- live `lok_catalog` prices win once seeded, same
  rule as everything else).
- `lokPassportPurchase.ts` now calls `useLokEconomy().spend(catalogSku('passportTier',
  tier.skuId))` for real and grants the meta flag on success (or on `already_owned`,
  for an account that bought it elsewhere) -- no more Dev-Mode-only gate. The
  `setLokPassportTier` reducer in `metaStore.tsx` dropped its dev-mode check
  accordingly; both the real purchase and the Dev Mode testing panel call the same
  action, each gated at their own call site.
- `LokShopScreen.tsx` mirrors `PaletteGalleryPanel.tsx`'s established pattern exactly:
  shows the live LokToken balance, disables "Buy" when signed out or unaffordable, and
  syncs `ownedSkus` back into the meta flags on mount so a tier bought on another
  device follows the account.
- `scripts/export-lok-registry.ts` now emits `survivor616.passportTier.*` rows into
  `survivor616.catalog.sql` with their real prices -- still needs applying to the live
  `lok_catalog` table by whoever administers it (same as any other catalog change;
  this script has never had DB credentials and still doesn't).

**What's still genuinely unwired**: real-money billing (Stripe, a subscription that
auto-renews, "Lok Passport" as an actual recurring charge) -- everything the survey
above found missing across the ecosystem is still missing. What changed is that the
tiers don't need any of that to be real purchases *today*: they're LokToken sinks,
same as a theme or a drop pack, and LokTokens are already real.

## Backlog: other things worth selling for LokTokens

The player asked for a plan, not just the three named tiers. Candidates, roughly
ordered by how directly they reuse what already exists:

1. **The three `LOKSHOP_STOCK` placeholders** (`game/data/lokServer.ts`: `ball`,
   `chest-pass`, `pet-rider-saddle`). These are flavor-named shelf mockups with **no
   backing mechanic anywhere in the codebase** -- buying one today would do nothing,
   because nothing was ever designed for them to grant. Before wiring these to real
   `spend()` calls, each needs an actual in-game effect decided (a cosmetic? a LokPet
   accessory, given "saddle"/"rider"? a travel-encounter item, given "chest-pass"?).
   Don't invent that gameplay blind -- surface the question to the player first.
2. **A LokToken-priced Forge identity reroll pack** -- `OperatorForgePanel.tsx`
   already has free "Reroll name and bio" / "Roll body" / "Roll palette" buttons; a
   paid variant could be a cosmetic-only convenience (e.g. a bundle that rerolls
   every category at once, or unlocks the faction races list without the endgame
   gate) rather than a new mechanic.
3. **More `THEMED_PALETTES`/`RUN_AURAS`/`HATS`/`CELEBRATIONS`/`DROP_PACKS` entries** --
   the lowest-effort path, since the catalog plumbing, pricing tiers and export script
   already handle arbitrary new entries in those five lists with zero new code.
4. **A standalone single extra custom slot**, independent of the three tiers, for a
   player who wants one or two more slots without buying a whole tier. Deliberately
   not built alongside the tiers above: it would compete with the tier pricing/value
   ladder (why buy LokPass's 6 slots for 2000 if one slot is available piecemeal for
   less?), so it needs a pricing decision before it's just a code change.

None of these are built; this is the plan the player asked for, to pick up when
there's a concrete next item to ship.

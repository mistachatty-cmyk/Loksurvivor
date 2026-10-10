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

# Operator Forge roster and supporter slots (2026-10-12)

## What ships

The Operators tab shows the hand-authored 616 roster as deterministic Forge-generated starting designs, plus the player's saved forged operators. Selecting a roster card loads an editable design into the Forge; it never edits the underlying character's stats, weapon, ultimate, or in-run rig. The roster comes from `characterForgeRoster.ts` and `OperatorRoster.tsx`.

The custom slot table in `endgameUnlocks.ts` has eight free play-earned slots, then six Lok Pass slots, ten Lok Passport slots, and an initial batch of ten Lifetime Passport slots. Every slot still needs its own play milestone. The current table stops at 34 slots; extending it toward 100 is later work and must also raise the `MAX_FORGED_OPERATORS` storage ceiling when needed.

## Entitlement source

`useLokEconomy()` fetches `activeSupporterTier` from the shared account service. `lokEconomyStore.tsx` passes only a confirmed tier to `operatorForgeStore.ts`. A Pass opens the first supporter batch, a Passport opens the Pass and Passport batches, and Lifetime opens all current batches. Signed-out, loading, and failed lookup states have no supporter tier. A stale response from a previous refresh is ignored.

The Forge panel subscribes to the account tier so its slot list updates when the lookup finishes. The plain Forge storage module also holds the confirmed tier for `saveForgedOperator()`, which can be called outside React. Dev Mode's existing all-unlocks switch grants temporary access to every slot. If a supporter tier lapses, extra slots lock again, but saved operator designs remain intact and editable when access returns.

The Lok Shop's Pass and Passport information follows the current supporter system. There is no separate Forge Passport LokToken SKU, local purchase flag, or Dev Mode entitlement toggle. The earlier PR branch had proposed those; merging with the newer supporter system removed the duplicate path. Real-money billing and account entitlements are owned by the shared Lok platform, outside this game.

## Other customization additions

The Enemies tab has Classic and Styled palette previews backed by `paletteStyles.ts`. Faction Races Pass is a distinct LokToken feature unlock sold through the existing Unlocks catalog. New catalog cosmetics include Furniture City Dusk, Furnace Orbit, Relay Mast, and Ticker Tape. The Ball stays available through the current hideout and Lok Shop behavior.

Tests cover deterministic roster generation, style presets, slot milestones, tier changes, and saved-design preservation when a tier lapses. The combined game typecheck, unit suite, build, and browser Forge flow are the integration checks.

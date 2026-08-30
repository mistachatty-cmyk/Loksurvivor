---
name: Shop tier & gem economy
description: How VendorItemDef tier bands, attach/detach/refund gem modifiers, and world-dropped rarity gems fit together.
---

Implements phase 1 of `claude/kinetic-bender-progression-3ubvx6`'s planning doc
(§1d, §2) plus a rarity gem-drop/loot-token layer the plan doc didn't cover.
That planning branch was never merged, so its doc isn't on this history --
read this note instead of hunting for it.

**Two unrelated things share the word "gem" -- don't conflate them:**

1. **`GemDef`** (`types.ts`) -- a small modifier attached to one owned
   `VendorItemDef` node (`hostId`), bought with cred, socketed via
   `metaStore`'s `attachGem`/`detachGem`/`refundGem`. `effect` is a
   **display-only label** (`"+15% reach"`, etc.) -- nothing reads it to
   change gameplay numbers yet. Wiring a gem's `pct` into the host's actual
   behavior is future work, scoped to whichever tree owns that host (e.g.
   Kinetic Reach's durability nodes once §1a lands). Only 3 seed records
   exist (`data/vendor.ts`'s `GEM_CATALOG`), attached to existing Field Ops
   nodes (`grabby-hands`, `colossus-frame`, `ghost-cloak`) purely to give the
   attach/detach/refund UI something real to exercise.
2. **`Gem`** (`engine/world.ts`) -- a world-space pickup with a
   **`GemRarity`** (`blue`→`purple`→`gold`→`red`→`white`, weakest to rarest,
   `types.ts`). Enemies roll drops from `EnemyDef.gemDropTable` in
   `killEnemy()` (the same on-kill loot block as health/cred/sweep, called
   from `damageEnemy()`). Collection is `updateGems()`, a copy of
   `updatePickups()`'s magnet math -- kept separate instead of folded into
   `Pickup`/`PickupKind` because gems carry a rarity-driven radius and color
   `Pickup` has no field for. Each rarity has a fixed loot-token value
   (`GEM_RARITY_LOOT_TOKENS` in `data/gems.ts`) credited to
   `w.lootTokensGained` immediately on pickup -- there is no separate
   per-rarity currency bank, so a future phase that wants "spend 5 blue gems"
   style pricing needs to add that bank rather than assuming one exists.
   `World.gemVacuumActive` swaps the normal magnet radius for a large
   constant (`GEM_VACUUM_RADIUS`); nothing sets it true yet -- it's stubbed
   for the ability that will (§1a "Kinetic Reach" or similar).

**Gem-palette cosmetics are not `VendorItemDef`s.** They're
`GemPaletteItemDef` records (`data/gems.ts`'s `GEM_PALETTE_ITEMS`, one per
rarity), priced in `lootTokens` (already existed in `MetaState`; this is the
"token shop coming soon" placeholder in `HubScreen.tsx`/`RunSummary.tsx`
finally getting a purchase path). Ownership is `MetaState.gemPaletteUnlocked`
-- a permanent flag with no refund, same shape as `ownedUiThemeIds`, not the
stack-counted `vendorPurchases` refund pattern. Rendered from a
`VendorPanel.tsx` tab (`gem-palette`) that isn't a real `VendorItemCategory`
-- it's a local `PanelSection` union just for tab state; don't add
`'cosmetic'` to `VendorItemCategory` for this, the panel already branches on
it before touching `VENDOR_CATALOG`.

**`VendorItemDef.tierBand`/`tierRung`** (`'low'|'medium'`, rung number) are
UI-grouping metadata only -- `cost` still prices the item. `data/shop-tiers.ts`
holds the reference price-per-rung table from the plan doc
(low: 2,000/8,000; medium: 50,000/250,000/750,000-1,000,000). Only two real
items use it so far (`veteran-plating`, `street-legend` in `data/vendor.ts`,
both `low` band) -- existing Field Ops items were **not** retagged, since
their costs (90-520 cred) predate the tier system by two orders of magnitude
and tagging them would make the rung price table read as wrong. The next
tree that wants tier pricing (Kinetic Bender's gyroscope ladder, per §1a) is
the first real consumer of the `medium` band. `VendorPanel.tsx`'s
`groupByTier()` buckets a category's items into an untiered list plus
tier-labeled groups and degrades to the original flat grid when nothing in a
category is tagged -- true for every category except `stat`/`utility` today.

See `MEMORY.md` for the index.

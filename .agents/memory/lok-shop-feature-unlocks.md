# LokPet Field Guide & Collector Access gated behind the Lok Shop

User ask: the LokPet Field Guide (the variant catalogue in Character Select)
and access to LokPet Collector characters should both require a purchase in
the Lok Shop (LokTokens), not just be free/always-available.

## What existed before this

- **LokPet Field Guide** is `LokPetVariantSheet.tsx`, rendered unconditionally
  at `CharacterSelect.tsx` — no gate of any kind, cosmetic or otherwise. (Not
  to be confused with the Bestiary/`ArchivePanel.tsx`, a different screen
  that only reuses `LokPetIcon` from the same file.)
- **LokPet Collector** is the `lokPetCollector` trait on a line of six
  characters in `data/characters.ts` (`sleeve` through the Apex Collector
  tier), each already gated by its own per-character `UnlockRule` (`default`
  for the first, `{kind:'lokCollector', runs, lokPets}` progress challenges
  for the rest) — pure in-game progress, no purchase involved.
- The LokToken shop (`PaletteGalleryPanel.tsx`, via `useLokEconomy`/`spend`)
  only ever sold cosmetics (`palette`/`aura`/`hat`/`celebration`/`dropPack`).
  Its own default notice literally said "every item is cosmetic-only."

## What changed

Two new account-wide `MetaState` booleans, each flipped once by its own
LokToken purchase and never un-set: `lokPetFieldGuideUnlocked`,
`lokPetCollectorAccessUnlocked`. New reducer cases `grantLokPetFieldGuide`/
`grantLokPetCollectorAccess` mirror the existing `grantDropPack` pattern
exactly (idempotent, server-verified purchase flips a flag, no local
currency path since both are LokToken-only).

**Field Guide**: `CharacterSelect.tsx` now renders `<LokPetVariantSheet />`
only when `lokPetFieldGuideUnlocked` (or dev-mode); otherwise a small locked
placeholder in the same visual container points at the Lok Shop. Nothing in
the sheet itself changed.

**Collector access is a second, independent gate on top of each Collector
character's existing unlock rule**, not a replacement for it — a player can
satisfy the `{runs, lokPets}` challenge long before buying access, or buy
access long before meeting the challenge; both must be true. New helper
`characterUnlocked(character, meta)` in `metaStore.tsx` is the single place
this AND is expressed (`isUnlocked(character.unlock, meta)` AND, if
`character.lokPetCollector`, `meta.lokPetCollectorAccessUnlocked`). It
replaced raw `isUnlocked()` calls at **every** character-selectability call
site, not just the obvious one — there were three:
`unlockedCharacters`/`lockedCharacters` (the `useMeta()`-exposed derived
lists `CharacterSelect.tsx` reads), `completeRun`'s `newlyUnlocked`
computation (so a Collector character's id isn't written into the
persisted `unlockedCharacterIds` array — and so doesn't fire an "unlocked!"
toast — before access is actually bought), and `ArenaSetupScreen.tsx`/
`ArenaJoinScreen.tsx`'s own separate `unlockedCharacters` memos (these read
`meta.unlockedCharacterIds` directly rather than calling `isUnlocked`/
`characterUnlocked`, so they needed the same extra AND condition inlined
rather than a drop-in function swap). **Grep for every
`CHARACTERS.filter`/`.unlockedCharacterIds` site before trusting one fix
covers Arena modes too** — they do not share the hub's derived-list code.

`CharacterSelect.tsx`'s `LockedCharacterTile` also special-cases this: if a
Collector character's own progress rule is already met but access isn't
bought, it shows "Buy Collector Access in the Lok Shop" instead of repeating
a challenge description that would otherwise read as already complete.

## Lok Shop UI

New `'unlocks'` tab in `PaletteGalleryPanel.tsx` (`data/lokShopUnlocks.ts`'s
`LOK_SHOP_UNLOCKS`, two entries), inserted as its own category branch
*before* the file's final hats/celebrations fallback branch — every
`category === X ? ... : ...` ternary chain in that file assumes exactly the
original 5 categories, so adding a 6th meant finding and extending every
such chain (icon, subtitle, title, description, content grid), not just
adding one new `if`. The format mirrors the existing `drops` category
(owned vs. buy-button card) rather than the equip/preview pattern the other
cosmetic categories use, since these are permanent one-time unlocks with
nothing to equip. The shop's own default notice text ("every item is
cosmetic-only") was corrected since it's no longer true.

## Shared-catalog sync (CLAUDE.md's existing requirement)

Both new items go through `scripts/export-lok-registry.ts` exactly like the
5 cosmetic kinds already did — the script is generic over `StoreItemKind`
and doesn't care whether an item is cosmetic. One real gotcha hit while
wiring this: the shared SDK's Postgres enum (`lib/lok-universe/src/publish.ts`'s
documented `lok_item_type` values: `theme, cursor, ui_kit, motion_pack, tool,
boost, badge, sfx, title, frame, pet, cosmetic`) has **no "unlock" or
"feature" value** — `'boost'` is the closest existing fit and is what both
new catalog rows use. Verified by actually running the export script
(`pnpm exec tsx scripts/export-lok-registry.ts <dir>`) and reading the
generated SQL, not just by reading the script's types.

**Not done, and can't be from this sandbox**: actually seeding the live
shared `lok_catalog` (applying the generated SQL to the Supabase project) —
that needs credentials this environment doesn't have. The user (or whoever
holds those credentials) needs to run the export and apply the SQL before
either item is actually purchasable for real; until then `priceOf(sku)`
returns `undefined` and the UI falls back to the local `LOKTOKEN_PRICE_BY_TIER`
placeholder price shown in the shop, same as any new cosmetic would before
its first sync.

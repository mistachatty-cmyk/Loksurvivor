# Card cosmetics (The Neon Sleeve > Sleeve Counter)

Read before touching pack tiles, the pack reveal, card backs or card frames.

- Catalog is `src/game/data/cardCosmetics.ts`; visuals are `src/ui/CardCosmetics.tsx` + `cardCosmetics.css`;
  the shop tab is `src/ui/SleeveCounter.tsx`. Three kinds, one equipped each: `packSkin`, `cardBack`, `cardFrame`.
- Sold for **Card Credits (CC)**, purely cosmetic: never touch pack odds, prices or card stats from here.
  Free starters (`pack-classic`, `back-default`, `frame-classic`) are always owned and are the defaults.
- Frames reuse the old `cardFrameSleeves` / `selectedCardFrame` meta fields (those had action types but no
  reducer cases before). Backs and skins are `ownedCardBackIds`/`selectedCardBack` and `ownedPackSkinIds`/`selectedPackSkin`.
  `normalizeCardCosmetics` drops unknown ids on load and refuses to equip unowned items.
- Art is the game's own rigs (`RigPortrait`), never raw reference art: a pack's featured fighter is `PACK_FEATURED`,
  a back's hub figure is `BACK_HUB_FIGURE`. `cardCosmetics.test.ts` fails if a fighter or LokPet id is renamed.
- Everything is drawn at a fixed design size and scaled by `FluidScaled` (transform), so CSS uses plain px.
  Do not add container-query units. `LokDeckCardView` hands the whole face to `LayoutCard` for `frame-printed` / `frame-tcg`.
- Locked (uncollected) cards must stay sealed in every layout: no stats, element, abilities or flavor.
- Motion is a setting (`meta.cardMotion`: full / subtle / off, default subtle) and also honors prefers-reduced-motion.
  Looping effects carry `cc-loop` so `subtle` can switch them off; tilt only runs in `full`.
- Not yet synced to the shared LOK store (`lok_catalog`): these are CC-only. Adding LokToken pricing means a new
  `StoreItemKind` plus `scripts/export-lok-registry.ts`.

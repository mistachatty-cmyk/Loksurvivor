# GSIX theme registry (616 side)

The shared source of truth is `Lok-EcoSystsem/universe-sdk/src/palettes.ts` (vendored here in `lib/lok-universe/src/palettes.ts`; never edit the vendored copy). Original spec: the "GSIX 616 & Midwest Game Palettes Master Registry" Google Doc.

- **4-slot contract:** `primary`, `secondary`, `accent`, `base`, plus a derived `fx` (glow, hudBorder, particleTint).
- **87 base themes:** the 75 curated Grand Rapids / Michigan / Midwest / Americana themes plus 12 additions (Silver Line, Pier Lighthouse, Tulip Time, Paczki Day, Lilac Festival, Great Lakes Freighter, Soo Locks, Cheese Curd Squeak, Hotdish Potluck, Corn Maze Night, Porch Fireflies, Roadside Diner Pie).
- **Remixes, generated deterministically:** `_midnight` (swap primary and accent, base to #050507, accent +12 saturation; an achromatic accent keeps the body colored instead of turning it white), `_retro16` (every token snapped to RGB555, base lifted slightly), `_winter` and `_autumn` (secondary pulled toward frost or burnt maple).
- **In 616:** `src/game/data/gsixRegistryPalettes.ts` turns base + midnight + retro16 into catalog entries (261, ids like `gr-03_midnight`). Tokens map onto the 7 sprite slots with `toSevenSlot` (ink=base, body=primary, accent=secondary, accentBright=accent, glow=fx.glow). Free shelf: standard themes are still; uncommon and above animate. Midnight is one tier above its base. Starters (free, owned from launch): Crash the Net, Calder Plaza, Honolulu Silver, Old Glory 76.
- **Not wired in 616 yet:** the `_winter` / `_autumn` overlays (needs a Season setting; `seasonForMonth` is ready), and the zone/achievement unlock hints (`unlock.survivor616`) are data only; today everything else is bought with tokens.
- **Selector:** the shop has family, remix and tier filters; the list is 400 themes (139 original + 261 registry).
- **Trademark note:** several theme names and references use real brands and teams (Culver's, Menards, Carhartt, Faygo, Lions, Tigers and others). Fine as private working names; get a read before shipping them as store items.

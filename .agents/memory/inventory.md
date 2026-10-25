---
name: Inventory and sealed packs
description: Items screen, sealed-by-default card packs, pack opening fixes (0.42.48)
---

# Inventory and sealed packs (0.42.48)

- `ui/InventoryPanel.tsx` is the Items page (dock item `inventory`, between Cards and Lokshop in `DOCK_PAGES`; Go-To entry). Sections: sealed packs (stacked, Open / Open N), stash (cred, loot tokens, card credits, skeleton keys, treats, elixirs), crafting materials, key equipment (`ui/keyItems.ts`, shared with the Workshop), forged relics.
- Earned and bought packs are stored in `meta.unopenedCardPacks`. `autoOpenPacksEnabled` now defaults **false**; `packInventoryV1` marks that an older save was moved to sealed once, so a later choice is respected.
- Bugs fixed here: `openStoredCardPack` charged the pack price again and never removed the pack from storage. `openAllStoredCardPacks` had a type but no reducer (now opens up to `OPEN_ALL_PACK_LIMIT` = 10 into one reveal).
- "+N new" chips: `lib/inventorySeen.ts` saves a snapshot (`survivor616.inventory.seen.v1`) when the screen closes; the first visit only sets the baseline.
- `PackOpeningReveal` is portalled to `document.body`: inside a screen it sat under the global Looks/LokPets button, so Close could not be tapped on phones.
- Player-facing "crew" for friends (planned) must not reuse `crew-*` ids: the in-game crew is the rescued-ally system (`crew-feature.md`).

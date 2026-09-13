# Lock Decks card collection — 2026-09-13

- Survivor 616 card definitions remain pure projections of existing progression; ownership is still derived by `isCardOwned`, never persisted twice.
- `LokDeckCardMetadata` adds stable set, number, subject, source-app, and playability fields without changing the shared `lok.asset` schema version.
- `LOK_DECK_CATALOG` is the serializable definition boundary for the future G6.online Lock Decks application. Account ownership/tradeable instances must be layered onto these IDs later, not inserted into the catalog.
- The Archive Cards tab now treats its five groups as collectible packs/sets. Packs organize earned cards but do not imply randomized paid pulls or duplicate inventory.
- Operative, enemy, crew, and LokPet cards render from their actual procedural game rigs/definitions. Reference sheets are still never used as portraits.
- Keep card numbers stable: add new cards to the end of their set or deliberately version/migrate the catalog if renumbering becomes necessary.

# Sixth Ward Cypher + LokPet Collectors — 2026-09-13

## Shipped scope

- Four rap-group characters form the **Sixth Ward Cypher**: Meter Monk, Vinyl Hex, Hook Ghost, and Sleeve.
- Five characters form a separate **LokPet Collectors** roster class: Sleeve, Crate Sage, Foil Oracle, Crown Binder, and Pack Supreme.
- Sleeve belongs to both groups and is the first unlocked Collector.
- The Archive Card Binder now includes a small LokPet Card Shop. Blue boxes earn Card Credits; 12 credits opens one Cipher Pack that saves a combat-ready LokPet and records its binder imprint.

## Locked visual and mechanical identities

Do not silently replace these silhouettes, palettes, weapons, ranks, or relationships in later passes. Refinement is allowed, but a redesign needs explicit user approval.

| Character | Identity lock | Weapon / ability lock |
| --- | --- | --- |
| Meter Monk | Tall split coat, pendulum mic, violet/amber glow | Four slowing sound walls; `Sixteen Bars` tempo burst |
| Vinyl Hex | Low broad turntable shoulders, vinyl halo, navy/pink/cyan | Twin wall-ricocheting vinyl cutters; `Needle Drop` |
| Hook Ghost | Floating hood, two speaker-wings, green spectral face | Converts two enemies into a temporary chorus; `Everybody Say` |
| Sleeve | Asymmetric card-fan coat and oversized glowing binder sleeve | Piercing foil misprints; `Perfect Pull`; first Collector |
| Crate Sage | Short broad crate-body silhouette, mint seal glow | Box-cutter melee; LokMaster (+2 slots) |
| Foil Oracle | Very tall narrow diviner, staff/halo, floating card trail | Slowing future-card waves; LokCaster (+3 slots) |
| Crown Binder | Crown of top-loaders, broad ceremonial stance | Catalogue laser; LokLegendary (+5 slots) |
| Pack Supreme | Largest winged sanctuary silhouette and floor halo | Seven-ray card fan; LokSupreme (+7 slots) |

## Collector progression contract

- Normal loadout capacity stays at 3 saved LokPets.
- Collector ranks add 1, 2, 3, 5, or 7 loadout slots. The runtime cap always reserves one additional position so a full team can still catch a new chest LokPet.
- Selecting a lower-capacity character trims only the packed selection; it never deletes saved companions.
- Higher ranks increase two separate chances: extra floor LokPacks after ordinary kills and LokPet prize weight inside opened packs.
- Rank unlocks require both completed Collector runs and chest-origin LokPets caught. Non-Collector runs do not progress this ladder.
- Collector bonuses are data on `CharacterDef.lokPetCollector`; avoid rank-specific branches in the simulation or UI.

## Economy contract

- Base reward: 2 Card Credits per blue box opened.
- Collector bonus scales by rank; Sleeve earns 4 total per box and Pack Supreme earns 9.
- Foil Pack cost: 12 Card Credits.
- Shop pulls use the existing deterministic LokPet generator, kennel cap, catalog normalization, and local rig art. No second pet/card inventory is introduced.

## Cheap extension points

- Add ranks by authoring another `CharacterDef` with `lokPetCollector` and a `lokCollector` unlock rule.
- Add challenges by extending the two persisted counters only if the objective cannot be expressed as runs plus catches.
- Add shop packs by sharing Card Credits and `rollLokPet`; do not fork the card manifest or combat pet formats.

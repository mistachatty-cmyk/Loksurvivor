# LokPet field specimen research

Each first successful clear of a standard district records one deterministic seed (`field:<area-id>`). The same seed is rendered through `data/creatureTraits.ts` in the run summary and Bestiary Field Specimens tab, so its name, body plan, look theme, traits and quirks stay stable across reloads. Seeds are normalized and deduplicated in `metaStore`.

This is the first segment of a future LokPet discovery pipeline, not a claim that generated creatures can be captured, used in battle, traded, or bred. The run report labels specimens as research traces and explicitly says their traits are flavor-only. Do not attach combat bonuses to these trait axes without a separate balance design and explicit gameplay purpose.

Next stages, in order:

1. Add a small, deterministic encounter or field-scan choice in authored districts and show the actual map/encounter provenance.
2. Let players choose to keep, release, or compare a duplicate trace without silently replacing it.
3. Only after the roster, sprite/rig pipeline, and save migration are defined, convert a specimen into a battle-ready LokPet and connect it to its collection record.
4. Check fresh-save and existing-save behavior, deterministic identity, mobile Bestiary layout, and no stat change before shipping those stages.

# The Lev Expansion

Origin: a separate Google AI Studio export of this project (collaborator
"Gemini (AI Studio Agent)") contained an unfinished "Lev Expansion" content
pack, described in that export's own `.agents/memory/the-lev-expansion.md`.
That export used npm-workspaces + `bun.lock` and had drifted from this repo
in unrelated ways (a whole parallel `areas-districts.ts`/`areas-abstract.ts`
district system, a `vane`/`cora`/`torque`/`solas` character roster that
doesn't exist here) — so nothing was copied wholesale. Everything below was
extracted by hand, verified against this repo's actual `types.ts`/
`world.ts`/`draw.ts`, and ported only where the referenced id had real
backing code in that export.

## What shipped in this port

- **Faction**: `lev-syndicate` in `data/factions.ts`, roster of the 5
  enemies below.
- **Enemies** (`data/enemies.ts`): `lev-singularity-colossus`,
  `lev-nanite-phantom`, `lev-arc-conductor`, `lev-substation-brute`,
  `lev-drone-interceptor`. The first three use genuinely new `EnemyBehavior`
  cases (`vortex-crusher`, `nanite-swarm`, `arc-conductor`) that were real,
  working `updateEnemyAI` switch cases in the source export (gravity-pull +
  radial kinetic ring; phase-blink flanking; directional arc-laser bolts) —
  ported into `engine/world.ts` verbatim, plus the union additions in
  `types.ts`. This is an exception to the CLAUDE.md "fancy label with no
  switch case falls through to chase" footgun: these three are not that
  footgun, they're real cases, confirmed by grepping the source export's
  `world.ts` before porting.
- **Obstacles** (`types.ts`, `render/draw.ts`, `engine/chunks.ts`):
  `skyscraper`, `transformer-station`, `skyline-bridge`, `beacon-tower`,
  `security-gate`, `bunker-hatch` — full render blocks, `OBSTACLE_COLORS`
  entries, and the exhaustive `sizes` record in `chunks.ts`. None of them
  were added to `OBSTACLE_WEIGHT_PROFILES` (source export didn't either), so
  they read as indestructible/immovable by default (`fixed-bench` variant)
  unless a placement sets `propVariant`, same as the source.
- **Chunk prefabs** (`engine/chunks.ts`): `lev-substation`, `skyline-spire`,
  `nanite-foundry` — added to `BuildingPrefabId` and `BUILDING_PREFABS`, not
  wired into any `THEME_DISTRICTS`/`kindWeights` table (the source export
  didn't wire them into endless-mode generation either — they exist as
  prefabs a future area could reference via `getBuildingPrefab`, not as
  live endless-mode content yet).
- **Sky profiles** (`types.ts`, `render/draw.ts`): `cyber-storm` (used by
  the district below), plus `toxic-haze` and `solar-flare` — all three were
  fully implemented in the source export's `draw.ts` (`SKY_PROFILES` entries
  and the `drawAtmosphericParticles` ion-spark/spore-mote/heat-mote layers),
  so all three were ported even though only `cyber-storm` currently has an
  area using it. `toxic-haze`/`solar-flare` are reserved for a future
  Lev-adjacent area.
- **District**: `lev-syndicate-spire` ("Lev Syndicate Spire") appended
  directly into `data/areas.ts`'s `AREAS` array (NOT as a new
  `areas-districts.ts` file — see "What was NOT ported" below for why).
  Discovery `lev-core-archive` added to `data/progression.ts`.
- **Achievement**: `lev-spire-conqueror` (clear `lev-syndicate-spire`) added
  to `data/achievements.ts`.

## What was NOT ported, and why

The source export's `the-lev-expansion.md` describes a larger scope than
what actually had code behind it. Searched thoroughly (multiple full-text
queries per id, including alternate phrasings) before concluding each of
these is unimplemented — this is a porting task, not a design task, so none
of it was authored fresh:

- **`vector-lev`** (playable character "Vector Lev — The Singularity
  Defector") — no `CharacterDef` anywhere in the source export. Only
  appears as a `featuredCharacterId` string on the district (a field that
  doesn't even exist on this repo's `AreaDef` — dropped when porting the
  district) and in one achievement's `isComplete` check (see below).
  **Needs**: a full `CharacterDef` authored in `data/characters.ts` —
  base stats, a `lev-expansion` weapon (in `data/weapons.ts`), and a
  `singularity-collapse` ultimate — before anything that names `vector-lev`
  can be real.
- **`lev-overlord-prime`** (boss, "Lev Overlord Prime") — no `EnemyDef`
  anywhere in the source export, only referenced in the memo prose and in
  `lev-syndicate-spire`'s wave list (`ratePerSec: 0.1, burst: 1, hpMult:
  1.4`). That wave entry was dropped when porting the district (its
  `toSec: 200` window was folded into extending the preceding drone wave
  instead, so the district's last 10 seconds aren't dead time). **Needs**:
  an `EnemyDef` (giant sizeClass, gravity/anti-gravity shockwave kit —
  likely wants its own new `EnemyBehavior` case, not `vortex-crusher` reused,
  since the memo describes a distinct "radial anti-gravity shockwave" from
  the colossus's "kinetic shockwave ring") authored, then re-added to the
  wave list.
- **`lev-grav-catalyst`** (permanent relic) / **`lev-singularity-vortex`**
  (its evolution) — no `RelicRecipeDef`/`EvolutionDef` anywhere. **Needs**:
  entries in `data/relics.ts` and `data/evolutions.ts`, plus whatever base
  weapon `lev-singularity-vortex` is meant to evolve (only makes sense once
  `vector-lev`'s `lev-expansion` weapon exists).
- **`lev-ion-hawk`** (legendary LokPet, `polar-pull` special ability) — no
  `LokPetVariantDef`. `polar-pull` itself already exists as a
  `LokPetSpecialAbility` union member (pre-existing, unrelated to this
  expansion) but nothing assigns it to an ion-hawk variant. **Needs**: a
  `LokPetVariantDef` in `data/lokPets.ts`.
- **`sector-lev-skyline-breach`** (Sector Command mission, "Breach at
  Skyline Relay") — no `SectorMissionDef`. **Needs**: authoring in
  `data/sectorMissions.ts` per `sector-command-design.md`'s existing
  patterns, including the "commander Vee" framing device the memo mentions.
- **`lev-conduit`** (Scenario passive card) / **`lev-grav-link`** (LokPet
  passive card) — no `PassiveCardDef`/`CardDef` entries. **Needs**:
  authoring in `data/passiveCards.ts` and `data/cards.ts`.
- **`singularity-defector`** achievement ("Level up Vector Lev at least once
  during any run") — the *definition* exists in the source export's
  `achievements.ts` (`isComplete: (meta) =>
  (meta.characterLevelUps['vector-lev'] ?? 0) >= 1`), but it is permanently
  unachievable without `vector-lev` existing as a real, level-up-able
  character. Deliberately not ported — an achievement that can never fire is
  worse than no achievement. Add it once `vector-lev` ships.

## Also NOT ported: the other 5 "districts" file content

The source export's `areas-districts.ts` (which `lev-syndicate-spire` lived
in) is a 6-area file, not a Lev-only one: `skyway-overpass`,
`glasshouse-arboretum`, `iron-junction`, `basalt-sanctum`, `tide-gate-wharf`
are unrelated non-Lev districts, each with a `featuredCharacterId` pointing
at a character (`vane`, `cora`, `torque`, `solas`) that doesn't exist in
this repo either, and an `AreaDef.featuredCharacterId`/`category` field
this repo's `AreaDef` doesn't have at all. Importing that file wholesale
would have imported 5 areas entirely out of scope for "the Lev Expansion"
plus broken references. Instead, only the `lev-syndicate-spire` object was
extracted by hand and spliced directly into `data/areas.ts`'s `AREAS` array
(dropping `featuredCharacterId`/`category`, neither of which this repo's
`AreaDef` supports). If those other 5 districts and their 4 characters are
ever wanted, that's a separate, much larger porting/authoring effort with
its own character roster work — out of scope here.

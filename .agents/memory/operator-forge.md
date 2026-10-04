# Operator Forge (v0.10.8)

**Decision: additive, never retroactive.** The owner said existing operators were too simple and samey, then (twice) ruled out changing them: "nothing replaced but expanded", "don't want this to be retroactive". The first attempt generated detailed looks for all 69 operators behind a Classic/Detailed toggle by swapping each `character.rig` for a getter. That was rejected and deleted. The shipped design only adds new, forged operators after the authored ones.

**What it is.** A hidden workshop (tap the Settings "Save data" label five times) that designs and generates new operators from a body build, a palette (scheme, hue, skin tone), a species preset, a wardrobe style and about 190 features across 15 categories. Seeded generation, per-category rerolls, batch generation and share codes. Forged operators borrow the stats, weapon and ultimate of an unlocked authored operator.

**Invariants that are easy to break.**
- `registerForgedOperators` only appends to `CHARACTERS`/`CHARACTERS_BY_ID` at the end of `data/characters.ts`. A test checks the authored operators are the same objects in the same order.
- The renderer paints parts in array order and ignores `z`; `applyOperatorLook` stable-sorts by `z`. A cape that draws over the torso means a bad `z`, not a renderer bug.
- Rigs are built once and cached by object identity; never rebuild one per frame.
- Kits with id-keyed engine behavior (`llama-mama`, `llama-overlord`, `cluck-616`) and legendary operators are not borrowable (`FORGE_KIT_BLOCKLIST`, `isForgeKit`). If you add another id-keyed behavior to `world.ts` or `draw.ts`, add its id to the blocklist.
- Saved data and share codes are untrusted: always go through `normalizeForgedOperator`.
- New roster entries need a reload (roster built at module load, default unlocks at meta hydration).

**Where.** `sprites/operatorDetail.ts` (feature bank), `data/operatorForge.ts` (generation and validation), `data/forgedOperators.ts` (registration), `state/operatorForgeStore.ts` (`survivor616.forge.v1`), `ui/OperatorForgePanel.tsx`. Docs: `artifacts/survivor-616/docs/operator-forge.md`.

**Also from this request:** the LokPet creature range brief (hybrid, fantasy, fictional, sci-fi; cute and terrifying; uncommon and easter egg; add more periodically) lives in `artifacts/survivor-616/docs/lokpet-creature-design.md`.

# Operator Forge

The Operator Forge is an optional, hidden workshop for designing and generating
**new** operators. It exists because the hand-authored operators are about ten
flat rectangles each, so a large roster reads as the same figure in different
colors. The owner wanted far more range in how operators are made and how they
look, plus a way to generate them, **without changing the operators that already
exist**.

## The one rule: additive only

- The 69 authored operators in `data/characters.ts` are never read, re-skinned,
  re-rigged or reordered by the Forge. There is no global "detailed mode"
  switch and no getter that swaps an existing `character.rig`. An earlier
  design did that and was rejected for being retroactive; do not bring it back.
- A forged operator is a separate roster entry with its own `forge-` id. It is
  appended after every authored operator, and the test suite checks that the
  authored operators come back as the same objects in the same order.
- With nothing forged, `registerForgedOperators` does nothing and the game is
  byte-for-byte the roster it was before.

## How it is revealed

Settings, then tap the **Save data** label five times. The reveal is saved
(`survivor616.forge.v1`, `unlocked: true`) and a "Hidden workshop / Operator
Forge" section appears in Settings with an **Open the Forge** button. Nothing in
the normal UI mentions it before then.

## What an operator is made of

| Ingredient | Where | Notes |
| :--- | :--- | :--- |
| Body | `BODY_BUILDS` in `data/operatorForge.ts` | 9 builds (average, lean, stocky, broad, tall, small, hunched, flared, giant), plus height 14-28 and width 7-14 sliders. Fed to the existing `humanoidRig`. |
| Palette | `generatePalette(spec)` | 9 schemes (analogous, complementary, triadic, split, mono, neon, earth, pastel, noir), a hue, a lightness, and a skin tone. Produces the usual 7-color `SpritePalette`. Any single color can then be edited by hand. |
| Skin tones | `SKIN_TONES` | 10 natural tones and 12 fantasy tones (ash, moss, lavender, ember, frost, gilt, void, bone, rose quartz, teal, chrome...). |
| Look | `sprites/operatorDetail.ts` | 15 categories, about 190 features, each with its own palette color. See below. |
| Species | `SPECIES` | 10 presets (human, cyborg, beastkin, spirit, alien, undead, construct, dragonkin, fae, mutant). A species biases skin, color scheme, body build and which features are likely. It is a generation bias, not a stat change. |
| Style (flavor) | `OPERATOR_LEAN` | 7 wardrobes (street, tech, mystic, brawler, performer, scout, wild) that bias the clothing. |
| Identity | `generateOperatorIdentity` | Name, handle, tagline and bio, invented from word pools with a Grand Rapids flavor. All editable. |
| Kit | `data/forgedOperators.ts` | The stats, weapon and ultimate come from an authored operator the player has already unlocked. |

### Look categories

Head: hair, headwear. Face: eyes, brows, mouth and beard, face marks. Torso: top,
shoulders, sleeves and gloves, belt. Legs: legwear, footwear. Extras: accessory,
back item, held item. `FORGE_CATEGORIES` in `data/operatorForge.ts` is the single
list the generator, the validator and the UI all read.

## Generation

`generateOperatorDesign(seed, options)` is a pure function of its seed and
options (species, style, build). The same seed gives the same operator forever,
so a seed is a shareable recipe. The panel offers: **Surprise me**, **Generate
from seed**, **Forge 5 random operators** (random kits), per-category **Roll**
buttons, **Roll body**, **Roll palette**, and **Reshuffle item colors**
(`rerollDesign`).

A share code (`FORGE1:` plus base64 JSON) round-trips one operator
(`exportForgedOperator` / `importForgedOperator`). Imports are always passed
through `normalizeForgedOperator`, which coerces unknown feature ids, bad colors
and out-of-range sizes to safe values, so a stale save or a hand-edited code can
never crash the rig builder.

## Adding more options

This is meant to grow. Everything is a data entry:

- **A feature** (a hat, a hairstyle, a held item): add one entry to the matching
  table in `sprites/operatorDetail.ts`. A feature is a function from the body
  geometry and a palette color to a few `SpritePart`s. Attach head items to the
  `head`/`crest` keys, torso items to `torso`, gloves to the arm keys and boots to
  the leg keys, so the existing idle, walk, attack and hurt clips move them. The
  tests render every feature on every build and fail on an empty or out-of-bounds
  part.
- **A whole category**: add a field and color field to `OperatorLook`, a table,
  and a row in `FORGE_CATEGORIES`. The generator and the UI pick it up.
- **A body build, species, style, scheme or skin tone**: add a row to the matching
  list in `data/operatorForge.ts`. The tests check every list only names things
  that exist.
- **Name pools**: add words to the pools at the bottom of `operatorForge.ts`.

## Things that look like bugs but are deliberate

- **The renderer ignores `z`.** It paints parts in array order. `applyOperatorLook`
  therefore stable-sorts the final part list by `z` so capes and packs sit behind
  the torso and hats sit in front of the head. If a new feature draws on the wrong
  side, fix its `z`, not the renderer.
- **Rigs must be stable objects.** `drawRig` caches baked frames per rig object, so
  a forged rig is built once when the roster loads, never per frame.
- **Saving needs a reload.** The roster is built when `data/characters.ts` loads and
  the meta store unlocks default operators at hydration, so a newly saved forged
  operator appears after a reload. The panel says so and has a Reload button.
- **Some kits cannot be borrowed.** `llama-mama`, `llama-overlord` and `cluck-616`
  have behavior keyed on their id in `world.ts` and `draw.ts`, which a copy under a
  new id would silently lose. Legendary operators are also excluded so a forged
  copy cannot skip an unlock. The panel only offers kits the player has unlocked.
- **Forged operators carry no reference art, rarity, crew, signature traits, skins
  or episodes.** Those belong to the authored operator.
- **The hunched build needs width 9 or more.** Narrower hunched frames collapse the
  head below what the detail layer can sit on (`minWidthFor`).
- **Features are small.** Operator sprites are 15-28 pixels tall, so a hairstyle is
  a few pixels. The preview in the Forge is enlarged; in a run the differences are
  subtler and are carried by silhouette (hair height, capes, wings, tails) and color.

## Files

- `src/game/sprites/operatorDetail.ts`: the feature bank and `applyOperatorLook`.
- `src/game/data/operatorForge.ts`: bodies, palettes, species, styles, generation, validation, share codes.
- `src/game/data/forgedOperators.ts`: turns saved designs into playable `CharacterDef`s and registers them.
- `src/game/state/operatorForgeStore.ts`: device-local saves (`survivor616.forge.v1`).
- `src/ui/OperatorForgePanel.tsx`: the hidden screen; `SettingsPanel.tsx` holds the reveal.
- Tests: `src/game/operatorForge.test.ts`, `e2e/operator-forge.spec.ts`.

## Ideas not built

- Letting forged operators wear their own forged look as a skin on an authored operator (kept out so far because it brushes against "nothing replaced").
- Cosmetic species perks or lore lines in the roster.
- Using the generator for hideout visitors and rescued allies.
- Making the Forge a visible feature once the owner decides the hidden reveal has done its job.
- Live registration without a reload.

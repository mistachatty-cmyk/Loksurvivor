# Operator Forge

The Operator Forge is an optional end-game workshop for designing and generating
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

## How it is unlocked (0.10.9)

It used to be hidden behind five taps on the Settings "Save data" label (0.10.8).
The owner found the new screen content too much, so it is now an **end-game unlock**:

- **Gate:** clear every standard map once (timed maps; not the endless modes and
  not the extreme 2x/4x versions). Before that, Settings shows no trace of it.
- **Settings has two pages**, Standard and End game, with a left/right slide
  between them (`SettingsPager`). The End game page ("Victory Lap") has a switch
  for each earned extra. All start **off**.
- **Extras:** Operator Forge, Zoom viewer, Faction races, Champion foil, Glow aura.
- **Five custom slots**, each earned its own way once the maps are cleared: Full
  Circuit (the gate), Crowd Control (20,000 kills), Roll Call (15 allies), Field
  Notes (18 discoveries), Beast Master (25 LokPet battle wins). The Forge keeps one
  custom operator per earned slot. A custom operator is a modified copy of a premade
  operator's kit and never replaces a premade operator.
- A Forge found with the old taps stays available and on. Operators saved beyond
  the slot count stay on the roster and are listed as "made before slots existed".
- Turning on Dev Mode also opens the Forge and all five slots immediately. This
  grants temporary access, not end-game progress: turning Dev Mode off hides the
  Forge and unearned slots again, while designs stay saved. Reload after
  switching Dev Mode to refresh the roster.

## The Forge Five

Five new authored operators sit in the normal roster: Vitrail, Cinder Kiln,
Threadwake, Quarry Choir and Comet Courier. They have their own rigs, signature
weapons and projectile drawings in `data/forgeFive.ts` and
`render/forgeFiveVfx.ts`. Their weapons are starting weapons only and are absent
from the shared loot pool. They do not consume custom operator slots.

Rules and goals are in `data/endgameUnlocks.ts`; state is in
`state/operatorForgeStore.ts`.

## What an operator is made of

| Ingredient | Where | Notes |
| :--- | :--- | :--- |
| Body | `BODY_BUILDS` in `data/operatorForge.ts` | 9 builds (average, lean, stocky, broad, tall, small, hunched, flared, giant), plus height 14-28 and width 7-14 sliders. Fed to the existing `humanoidRig`. |
| Palette | `generatePalette(spec)` | 9 schemes (analogous, complementary, triadic, split, mono, neon, earth, pastel, noir), a hue, a lightness, and a skin tone. Produces the usual 7-color `SpritePalette`. Any single color can then be edited by hand. |
| Skin tones | `SKIN_TONES` | 10 natural tones and 12 fantasy tones (ash, moss, lavender, ember, frost, gilt, void, bone, rose quartz, teal, chrome...). |
| Look | `sprites/operatorDetail.ts` | 15 categories, 202 features, each with its own palette color. See below. |
| Species | `SPECIES` | 10 core presets (human, cyborg, beastkin, spirit, alien, undead, construct, dragonkin, fae, mutant) plus 21 faction races (`FACTION_SPECIES`, shown only with the Faction races switch on). A species biases skin, color scheme, body build and which features are likely. It is a generation bias, not a stat change. |
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
- `src/ui/OperatorForgePanel.tsx`: the Forge screen, with the custom slot grid.
- `src/game/data/endgameUnlocks.ts`, `src/ui/EndgameSettings.tsx`, `src/ui/SettingsPager.tsx`: the end-game gate, switches and Settings pages.
- `src/ui/OperatorInspector.tsx`: the zoom viewer, portaled to the body at z-[110] to sit above the floating Back and music buttons; `RigPortrait` has a `pixelScale` prop for crisp whole-number zoom.
- Tests: `src/game/operatorForge.test.ts`, `src/game/endgameUnlocks.test.ts`, `e2e/operator-forge.spec.ts`, `e2e/endgame.spec.ts`, `e2e/operator-inspector.spec.ts`.

## Ideas not built

- Letting forged operators wear their own forged look as a skin on an authored operator (kept out so far because it brushes against "nothing replaced").
- Cosmetic species perks or lore lines in the roster.
- Using the generator for hideout visitors and rescued allies.
- Player-imported art as custom parts (designed in `docs/lokpet-creature-design.md`, not built).
- Live registration without a reload.

## Three screens and the Classic look (0.21.2)

- The Forge has a top nav: **Operators**, **Enemies**, **LokPets** (`OperatorForgePanel`). All screens stay mounted and are only hidden, so switching is instant and keeps each screen's state. The last screen is remembered in `survivor616.forge.tab`.
- **Classic v1** is a per-design option (`OperatorDesign.style === 'classic'`): `buildOperatorRig` returns the bare `humanoidRig` and skips the feature stack. The detailed look stays in the design, so switching back loses nothing. Only `'classic'` is stored; a missing `style` means detailed, so old saves and share codes are unchanged. Authored operators are still never re-rigged.
- **Enemies** and **LokPets** are classic galleries (`VariantStudio`): browse the real rigs, recolor, save a cosmetic custom look (`customEnemies`/`customPets` in the forge store, included in the save archive). Stats and behavior never change. Not yet drawn in runs or the Bestiary. Full part-by-part forges for both are the next step.

## Customs control (0.21.3)

See `endgame-unlocks.md` for the full table. Custom operators and looks each have a "use in runs" switch plus a master switch. Looks are applied in runs by palette only. The Custom Bestiary (Bestiary, third view) and the hideout Endgame dock are shortcuts to the same switches. Customs are kept out of card packs for now.

## The 616 Roster and tiered slots (0.24.5)

- **Operators tab roster** (`OperatorRoster.tsx`, rendered below the creator in `OperatorForgePanel.tsx`): every hand-authored character is reinterpreted through the Forge engine by `characterForgeRoster.ts` (`getCharacterRoster()`), biased toward the character's own accent hue so the forged look still "rhymes" with the original. Nothing about the 69 `CharacterDef`s changes -- picking a roster card loads its `OperatorDesign` into the creator exactly like picking a species/flavor preset does, fully editable afterward. The player's own saved custom operators show above the roster ("Your Operators"), per the Forge's "nothing replaced, only expanded" rule.
- **Enemies/LokPets**: no roster yet. `VariantStudio.tsx` instead got a **Classic (v1) / Styled (v2)** toggle on the Enemies tab only, reusing the player-skin style-preset engine extracted to `src/game/sprites/paletteStyles.ts` (Original/Nocturne/Countertone/Cel Broadcast/Riso Print). A full Forge-style rig/customization overhaul for Enemies and LokPets (including extending the humanoid-only feature system to quadruped/blob rigs) is a deferred follow-up.
- **Tiered custom slots** (`endgameUnlocks.ts`): `CUSTOM_SLOTS` (free, play-earned) grew from 5 to 8. Three new tiers layer on top, each slot still gated by its own milestone *in addition to* owning the tier: `LOKPASS_SLOTS` (6, slots 9-14, needs the one-time LokPass), `PASSPORT_SLOTS` (10, slots 15-24, needs an active Lok Passport subscription), `LIFETIME_SLOTS` (an initial batch toward 100, needs the Lifetime Lok Passport). `ALL_CUSTOM_SLOTS` is the combined, ordered list; `operatorForgeStore.earnedSlotCount()`/`isSlotTierUnlocked()` are tier-aware.
- **The three tiers are real LokToken purchases**, sold in the Lok Shop (`LokShopScreen.tsx`) exactly like any other LokToken-only cosmetic: `spend()` against the shared economy (`useLokEconomy`), balance shown, `ownedSkus` synced back into the three entitlement flags (`MetaState.lokPassOwned`/`lokPassportActive`/`lokPassportLifetime`) so a tier bought on another device follows the account. Dev Mode can still grant them directly for testing (Settings), using the same flags. Real-money billing (Stripe, recurring subscriptions) is still unwired across the whole Lok ecosystem -- but these tiers don't need it, since LokTokens are earned in-game, not bought with real money. Full writeup and a backlog of other LokToken-buyable candidates: `.agents/memory/lok-passport-slots.md`.


# Travel encounters

A hub-side popup minigame: a small chance of a turn-based scrap against an
enemy or wild LokPet fires when the player enters the LokPet Card Shop
(`the-storefront` hub room) or launches a run via "Head out." Data in
`game/data/travelEncounters.ts`, combat logic in `game/travelEncounter.ts`,
UI in `ui/TravelEncounterOverlay.tsx`.

## This is deliberately the "classic version"

Every thrown card deals flat, uniform damage, only mildly scaled by rarity
and variant (`CARD_RARITY_DAMAGE_MULT`/`CARD_VARIANT_DAMAGE_MULT` in
`data/travelEncounters.ts`) -- there are no per-card bespoke effects. That is
an intentional scope cut agreed with the user, not an oversight: a richer
Pokémon/JRPG-style move system (distinct actions per card, elemental
matchups, etc.) is the named future direction once this version ships and is
validated. Don't "fix" the flat damage into per-card effects without a
deliberate follow-up design pass -- that's a bigger, separate feature.

## Triggers are a data table, not inline `if` checks

`TRAVEL_ENCOUNTER_TRIGGERS` in `data/travelEncounters.ts` is the only place
that decides where an encounter can fire. It deliberately excludes every
hideout room except `the-storefront` -- the user was explicit that other
hideout rooms (the Sanctum, the Perch, the Cellar, etc.) should never
trigger this, only "places in the city" should, and the LokPet Card Shop is
the first of those even though it's still implemented as a `HubRoomDef`.
Adding a future city-location trigger is a one-line table entry, never a new
`if` wired into `HubScreen.tsx`/`AreaSelect.tsx`.

## The overlay is local `Game()` state, not a new `Screen` variant

`the-storefront` trigger point (`HubScreen`'s `enterRoom`/`onChangeRoom`)
never goes through `App.tsx`'s `Screen` union at all -- `roomId` is a
separate `useState` in `Game()`. A `Screen` variant can't represent that
hook without rerouting room navigation through `setScreen`, so the overlay
is instead a `PendingTravelEncounter | null` state in `Game()`, rendered as
a sibling on top of whatever `renderScreen()` returns. Both `HubScreen` and
`AreaSelect` keep their original callback signatures unchanged; the
`attemptTravelEncounter()` closure in `App.tsx` is the only interception
point. Don't "clean this up" into a `Screen` variant later without solving
the hub-room-trigger problem first.

## Fully isolated from `engine/world.ts`/`stepWorld`

`game/travelEncounter.ts` only reads `data/enemies.ts` and `data/lokPets.ts`
for stats -- it never imports the real-time simulation and never runs during
a live run. This is a hub-side minigame layered on top of navigation, and it
must stay that way as it grows (e.g. don't route its "attack" resolution
through `damageEnemy()`).

## The `'lokpet'` opponent slot rolls fresh, it doesn't reference fixed ids

`TRAVEL_ENCOUNTER_OPPONENTS`'s `{ kind: 'lokpet' }` entry calls
`rollLokPet(rng)` at encounter time rather than picking from a curated list
of `LokPetVariantDef` ids. That keeps "what you fight" and "what you can
catch" byte-identical (one roll, reused for both the opponent's stats and,
on a win, the `SavedLokPet` added to `meta.savedLokPets`), and surfaces the
whole existing LokPet roster with zero new authoring.

## Battle Deck is a flat sibling to the Passive Lock Deck, not tiered

`meta.battleDeckCardIds` (equipped in `CardShopPanel.tsx`'s new "Battle
Deck" tab) mirrors the existing Passive Lock Deck equip pattern
(`togglePassiveCard`/`activePassiveCardIds`) but deliberately uses a flat
`BATTLE_DECK_SLOTS` constant instead of `passiveDeckSlots()`'s
Collector-rank-tiered unlock curve -- v1 doesn't gate battle-deck size on
progression. An empty deck must never block the player: the UI falls back
to a fixed unarmed-punch attack (`UNARMED_PUNCH_DAMAGE`) when no cards are
equipped.

## `MetaState.travelEncountersEnabled`

A settings toggle (default on) fully disables the roll. It's read in exactly
one place, `attemptTravelEncounter()` in `App.tsx` -- that's the single
chokepoint that suppresses the feature, so any new trigger point must call
through that same helper rather than rolling its own chance check.

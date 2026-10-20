# Hideout interactables (v0.15.0)

What it is: a walkable operator on the hideout strip, tappable props per room, LokPet play
verbs, and choice events. All content is rows in `data/hideoutProps.ts`, `data/petCare.ts`
and `data/choiceEvents.ts`; text is `MessageKey`s into `en.json`.

Decisions worth keeping:

- **One reward choke point.** `engine/hideoutRewards.ts#grantSmallReward` is the only place a
  prop, a play verb or a choice event pays. It owns the daily caps (`DAILY_CAP`), the
  three-events-a-day limit, and the rare-find limits (one a day, per-item cooldowns). It never
  touches `lootTokens`. A new source must call it, never write to `meta` itself.
- **Rare finds are rolled by the caller, limited by the policy.** A blocked rare returns
  `rareBlocked` and `grantWithFallback` pays the authored `fallback` instead. Rare chance is
  scaled by `bondLuck` (up to 2x at Soulbound); everyday payouts never are.
- **Preview == payout.** Resolvers are seeded (`createRng(seed)`); the UI previews with the same
  seed it dispatches, and the reducer re-runs the pure function (`applyPetCare`, `applyChoice`,
  `resolvePropReward`). Reducer cases are replay-safe through claim timestamps in
  `hideoutClaims` (`prop.<id>`, `event.<id>`, `rare.<item>`) and `care.<verb>` keys in
  `SavedLokPet.hideoutEvents`.
- **No auto pop-ups.** Idle and walk-triggered choice events only show a "Something's up" chip
  on the strip (it expires after a minute). Only the travel trigger (entering a room, heading
  out) opens the overlay, and it shares `attemptTravelEncounter`'s choke point in `App.tsx` so a
  fight and a choice never both fire for one move.
- **The overlay lives in `App.tsx`, not `HubScreen`**, because it is `position: fixed` (see
  `fixed-popups-and-ancestor-filters.md`).
- **Strip input.** `HideoutPreview` reads everything through the `live` ref; the canvas loop deps
  stay `[rig, palette, height]`. Taps are pointerup-after-small-move so a vertical swipe still
  scrolls (`touch-action: pan-y`). Keys: Left/Right and A/D only; never Up/Down/Space; ignored
  while typing, with a dialog open, scrolled away, or with Walk and props off. The canvas stays
  `role="img"` and NOT `aria-hidden` (the stylesheet makes aria-hidden elements `pointer-events:
  none`). With the setting off the operator only wanders, exactly as before.
- Deferred on purpose: choice costs, `creatureTraits` axes as verb affinity, pet moods that
  persist, joystick/drag steering, in-run pet commands.

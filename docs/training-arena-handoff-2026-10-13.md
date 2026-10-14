# Training Arena handoff (2026-10-13)

## Handoff status

- **Owner:** User for design review; Codex for this implementation and handoff.
- **Goal:** Record what shipped in the Training Arena and identify decisions and checks still needed.
- **Scope:** `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`, its hideout/app navigation, and its changelog entry.
- **Status:** The base arena and layout work merged in PRs [#273](https://github.com/mistachatty-cmyk/Loksurvivor/pull/273), [#274](https://github.com/mistachatty-cmyk/Loksurvivor/pull/274), [#275](https://github.com/mistachatty-cmyk/Loksurvivor/pull/275), [#276](https://github.com/mistachatty-cmyk/Loksurvivor/pull/276), and #278. Progression and mailbox systems merged in [#280](https://github.com/mistachatty-cmyk/Loksurvivor/pull/280); weapon interaction, loadouts, camera behavior, and weapon tiers merged in [#281](https://github.com/mistachatty-cmyk/Loksurvivor/pull/281). Related ultimate character looks and animated themes merged in [#282](https://github.com/mistachatty-cmyk/Loksurvivor/pull/282).
- **Checked:** Typecheck passed on the combined main tree after #282. GitHub's translation and preview checks passed on #281 and #282. The full desktop/mobile and weapon-by-weapon visual review remains incomplete. A local preview reached the first-companion choice but did not proceed, to avoid saving a permanent companion selection in the QA profile.
- **Next:** Finish visual review with a dedicated QA save that can enter the arena without first-time setup, then check a real account Weapon Rack purchase and arena unlock. The shared catalog was published on 2026-10-14.

## Request captured from this chat

Bring back a dedicated, unlockable training room in 616 Survivor. It should have its own arena, the player and a Dust Mite target standing opposite each other, and a weapon rack on the left. Selecting a weapon should show it activating against the target. Movement is intentionally out of scope for this first pass. The user later provided the full next-pass requirements; decisions and incomplete work are listed in [the next-pass spec](training-arena-next-pass-spec-2026-10-13.md).

The user later provided a layout sketch and clarified the intended composition: a persistent top bar; a narrow left weapon dock with its own scroll area; each weapon icon expands/collapses detail underneath; the arena occupies the main field with the operator on the left and enemy on the right. This sketch-led layout should be the default. Preserve another layout as a user-selectable, saved option.

## What was added

- A **Training Arena** entry appears on the hideout main floor after 616 total defeats. Developer all-unlocks mode also reveals it.
- The arena is a separate screen with a dedicated test world. The selected operator and a stationary Dust Mite face each other.
- The searchable, alphabetized rack is populated from `ALL_WEAPON_DEFS`. Clicking a weapon icon activates it immediately; clicking its text selects it and toggles inline detail. In Spam mode, rack activations append attacks while existing projectiles and effects continue. The rack offers 2, 3, or 4 columns to show more icons at once. The former layout remains selectable.
- The target has 1,000, 5,000, or 20,000 HP settings. Reset Dummy restores its current HP setting.
- Each test reports observed damage and average damage per second. The selected weapon's base damage and cooldown are also shown.
- The implementation uses the normal world step and renderer for attacks and visuals. The arena does not start a normal run.
- The follow-up fix gives the screen a fixed viewport, keeps weapon scrolling inside the rack, and overlays controls and readouts on the arena. The operator stays in place; the target is now free to react to physics and softly returns to its spawn point.
- With Spam on, weapon tests repeat until stopped. With Spam off, an activation resolves once and the simulation waits for its effects and target return to settle; the 10-second simulation-time cap still clears an attack that otherwise remains active indefinitely.
- The sketch-led default uses a slim left dock with a green-tinted internal scrollbar, expandable weapon cards and a wide, white-framed arena. The top bar uses the orange accent, and separate blue/silver actor tags keep operator and target identity clear. Players can drag the canvas to pan; Center is on by default and smoothly returns the camera to the arena center, while Recenter resets it immediately. Challenge results now show the damage score with Retry and Back to Arena actions.
- Clicking a weapon icon or name fires immediately. The disclosure arrow is a separate detail control; Lock closes details and turns that control into a fire action. Spam defaults off beside Search/Lock and in each challenge attempt. Each icon shows its weapon level; detail panels adjust that weapon from levels 1–8 and show its stats/effects. The top-bar All counter sets every weapon to the same level.
- Each weapon badge and detail counter uses levels 1–8 with a short pop animation; reduced-motion disables the animation. The All counter can raise/lower the entire rack together; MIX indicates per-weapon tiers differ, and its center action reapplies the displayed All tier.
- The camera midpoint is the space between the operator and target. The Dust Mite may be knocked away by weapon physics and eases back to its home point instead of being snapped there every frame; when Spam is turned off, the preview settles before ending.
- The floating Looks & LokPets shortcut is hidden while the Training Arena is open so it cannot cover the arena heading at narrow widths.

Key implementation files:

- `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`
- `artifacts/survivor-616/src/ui/HubScreen.tsx`
- `artifacts/survivor-616/src/App.tsx`
- `artifacts/survivor-616/src/game/data/changelog.ts`

## Decisions and incomplete work

1. **Loadouts and repeated attacks:** Multi-Weapon Testing unlocks after 1,000,000 cumulative dummy damage. Saved loadouts support up to four groups. Spam allows rapid rack activations to overlap while the simulation continues; whether persistent orbit effects stack as separate copies still needs a focused visual check.
2. **Coverage and accuracy:** Tests use the selected operator and weapon level 1 (Base) or level 8 (Level), with attack range raised so attacks can reach the target. This is a visual, observed-damage preview, not a full multi-cooldown DPS benchmark. Delayed, status, and evolution behavior still needs broader review.
3. **Weapon coverage:** The rack exposes 189 entries from `ALL_WEAPON_DEFS`, including base, character-specific, evolved, and relic definitions. The count was checked, but every entry was not individually verified; Glitch, meteor, DVD bounce, and arc-tether remain named gaps.
4. **Unlock choices:** The user requested 616 total defeats for the hideout entry and 616 credited kills per base weapon; evolutions use a 6,166-kill gate. Progress commits at run end, and arena kills do not count. The real run-end unlock and mailbox flow still needs a QA-profile pass.
5. **Localization:** All configured locales and lock hashes are present, and GitHub translation checks passed on #281 and #282. Review generated non-English wording during the full UI pass.
6. **Visual and input review:** Full desktop/mobile review remains. Recheck camera drag/center-lock, rack densities, individual and All tier counters, reduced motion, icon activation under Spam, challenge retry/back, target readability, keyboard focus, and saved Classic layout. The browser preview for this handoff reached the first-companion choice and stopped without saving a permanent choice; it did not reach the arena.
7. **Shared economy:** The Weapon Rack is in the local and shared catalogs. The [published catalog record](lok-registry-review/README.md) identifies the project, tenant, and readback. The real account purchase and arena unlock still need a QA pass.

The target stays defeated after a lethal test until Reset Dummy or another weapon test recreates it. Damage is bounded by the target's remaining HP, so a lethal test will not report theoretical overkill damage.

## Original first-pass questions and decisions

- The hideout entry unlocks after 616 total defeats; base weapons need 616 credited kills each. This matches the requested progression.
- The arena supports both single-weapon tests and multi-weapon loadouts; the multi-weapon mode unlocks after 1,000,000 dummy damage.
- Tests use the selected operator with Base (level 1) and Level (level 8) weapon settings.
- Durability choices, Non-lethal, and Infinite HP are implemented.
- The user’s later requests for loadouts, effects/stats, mailbox, progression, camera controls, evolution testing, and the timed challenge are implemented in #280 and #281. The remaining visual and shared-economy items above are not complete.

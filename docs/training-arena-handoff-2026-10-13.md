# Training Arena handoff (2026-10-13)

## Handoff status

- **Owner:** User for design review; Codex for this implementation and handoff.
- **Goal:** Record what shipped in the Training Arena and identify decisions and checks still needed.
- **Scope:** `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`, its hideout/app navigation, and its changelog entry.
- **Status:** Base feature merged in PR [#273](https://github.com/mistachatty-cmyk/Loksurvivor/pull/273); viewport/attack-settling work merged in PR [#274](https://github.com/mistachatty-cmyk/Loksurvivor/pull/274); roadmap and layout work merged in PRs [#275](https://github.com/mistachatty-cmyk/Loksurvivor/pull/275), [#276](https://github.com/mistachatty-cmyk/Loksurvivor/pull/276), and #278. The next-pass implementation is being prepared on issue [#279](https://github.com/mistachatty-cmyk/Loksurvivor/issues/279); decisions and remaining work are in [the next-pass spec](training-arena-next-pass-spec-2026-10-13.md).
- **Checked:** Typecheck and production build pass; all 1,011 tests pass. Arena was manually reviewed at desktop size and 390×844; a weapon attack, Non-lethal target, Level 8 mode, and the 24-second challenge were exercised. Remaining visual review is listed below.
- **Next:** Finish checks and leave an open PR for user-arranged review. The Lok registry SQL must also be applied to the shared economy before the real LokShop purchase works.

## Request captured from this chat

Bring back a dedicated, unlockable training room in 616 Survivor. It should have its own arena, the player and a Dust Mite target standing opposite each other, and a weapon rack on the left. Selecting a weapon should show it activating against the target. Movement is intentionally out of scope for this first pass. The user later provided the full next-pass requirements; decisions and incomplete work are listed in [the next-pass spec](training-arena-next-pass-spec-2026-10-13.md).

The user later provided a layout sketch and clarified the intended composition: a persistent top bar; a narrow left weapon dock with its own scroll area; each weapon icon expands/collapses detail underneath; the arena occupies the main field with the operator on the left and enemy on the right. This sketch-led layout should be the default. Preserve another layout as a user-selectable, saved option.

## What was added

- A **Training Arena** entry appears on the hideout main floor after 616 total defeats. Developer all-unlocks mode also reveals it.
- The arena is a separate screen with a dedicated test world. The selected operator and a stationary Dust Mite face each other.
- The searchable, alphabetized rack is populated from `ALL_WEAPON_DEFS`. In the sketch-led layout, selecting a weapon chooses it and toggles its inline detail; a separate test action fires it. The former layout remains selectable.
- The target has 1,000, 5,000, or 20,000 HP settings. Reset Dummy restores its current HP setting.
- Each test reports observed damage and average damage per second. The selected weapon's base damage and cooldown are also shown.
- The implementation uses the normal world step and renderer for attacks and visuals. The arena does not start a normal run.
- The follow-up fix gives the screen a fixed viewport, keeps weapon scrolling inside the rack, overlays the controls and readouts on the arena, and pins both actors in place between simulation steps.
- Test simulation now runs until the tracked attack activity clears, then settles. A selected non-orbit weapon fires once; an orbit weapon gets one rotation. A 10-second simulation-time cap clears any attack that otherwise remains active indefinitely.
- The sketch-led default uses a slim left dock with a green-tinted internal scrollbar, expandable weapon cards and a wide, white-framed arena. The top bar uses the orange accent, and separate blue/silver actor tags keep operator and target identity clear. The Main/Classic selection persists locally; weapon choice itself does not fire an attack.
- The floating Looks & LokPets shortcut is hidden while the Training Arena is open so it cannot cover the arena heading at narrow widths.

Key implementation files:

- `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`
- `artifacts/survivor-616/src/ui/HubScreen.tsx`
- `artifacts/survivor-616/src/App.tsx`
- `artifacts/survivor-616/src/game/data/changelog.ts`

## Needed decisions or incomplete work

1. **Single weapon versus a custom loadout:** the rack contains the full weapon definition list, but only one weapon is active per test. There is no way to assemble a multi-weapon loadout or test multiple selected weapons together. Confirm whether that is required for the intended meaning of “test all weapons in a loadout.”
2. **Coverage and accuracy:** each test is at weapon level 1 and uses the selected operator's stats. It raises attack range to at least 310 world units so attacks can reach the placed target. Simulation now waits for tracked attack objects and statuses to finish, up to a 10-second cap. This is a visual/observed-damage preview, not a full multi-cooldown DPS benchmark. Review delayed, status, and evolution behavior, especially effects that reach the cap.
3. **Weapon list scope:** the rack is driven by `ALL_WEAPON_DEFS`; verify that this is the desired set, including character-specific and evolved definitions, and that every entry visibly activates against the target.
4. **Unlock design:** the first pass uses 616 total defeats. Confirm that this threshold and the main-floor placement match the intended progression.
5. **Localization:** the new screen copy is currently written directly in the component instead of using the locale message catalog. Move player-facing strings into the project's localization flow before treating localization as complete.
6. **Visual and input review:** after PR #276, a 390×844 manual click-through caught the floating shortcut covering the title; this branch fixes that overlap. Desktop and 390×844 checks now cover the hideout-to-arena click, rack scroll containment, weapon activation, stats, Non-lethal mode, Level 8 mode, and timed challenge celebration. Full weapon-family coverage, mailbox/unlock flow, target readability under every mode, keyboard focus, and saved Classic toggle still need review.
7. **Next-pass systems:** Current branch work implements the progression, mailbox, arena XP/stats, non-lethal/infinite HP modes, multi-weapon gate, and timed challenge described in [the next-pass spec](training-arena-next-pass-spec-2026-10-13.md). Shared Lok registry publishing, non-English localization, final verification, and full weapon/viewport review remain incomplete.

The target stays defeated after a lethal test until Reset Dummy or another weapon test recreates it. Damage is bounded by the target's remaining HP, so a lethal test will not report theoretical overkill damage.

## Original first-pass review checklist

- Does 616 defeats unlock this in the right place and at the right time?
- Should the mode support a multi-weapon custom loadout, or is one-at-a-time testing the intended first release?
- Should tests use the operator's live stats, fixed standard stats, or controls for level and stats?
- Are the three target durability settings useful, and should the target have a non-lethal/infinite-HP mode?
- Which weapon families, status effects, delayed attacks, evolutions, and orbit attacks need an explicit visual check?
- What additional features did the user have in mind for a later pass?

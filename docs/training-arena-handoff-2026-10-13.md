# Training Arena handoff (2026-10-13)

## Handoff status

- **Owner:** User for design review; Codex for this implementation and handoff.
- **Goal:** Record what shipped in the Training Arena and identify decisions and checks still needed.
- **Scope:** `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`, its hideout/app navigation, and its changelog entry.
- **Status:** Feature merged in PR [#273](https://github.com/mistachatty-cmyk/Loksurvivor/pull/273), commit `f8317ab`. This note is ready for review.
- **Checked:** `pnpm typecheck` passed on the feature branch after rebasing on current `main`; GitHub Vercel status was successful. No automated tests or manual playtest were run for this feature.
- **Next:** Review the design gaps and acceptance checklist below; decide which follow-up items belong in the next implementation pass.

## Request captured from this chat

Bring back a dedicated, unlockable training room in 616 Survivor. It should have its own arena, the player and a Dust Mite target standing opposite each other, and a weapon rack on the left. Selecting a weapon should show it activating against the target. Movement is intentionally out of scope for this first pass. The user mentioned additional future features but did not specify them in this chat.

## What was added

- A **Training Arena** entry appears on the hideout main floor after 616 total defeats. Developer all-unlocks mode also reveals it.
- The arena is a separate screen with a dedicated test world. The selected operator and a stationary Dust Mite face each other.
- The searchable, alphabetized rack is populated from `ALL_WEAPON_DEFS`. Selecting an entry immediately runs that weapon test; the Test Weapon button repeats it.
- The target has 1,000, 5,000, or 20,000 HP settings. Reset Dummy restores its current HP setting.
- Each test reports observed damage and average damage per second. The selected weapon's base damage and cooldown are also shown.
- The implementation uses the normal world step and renderer for attacks and visuals. The arena does not start a normal run.

Key implementation files:

- `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx`
- `artifacts/survivor-616/src/ui/HubScreen.tsx`
- `artifacts/survivor-616/src/App.tsx`
- `artifacts/survivor-616/src/game/data/changelog.ts`

## Needed decisions or incomplete work

1. **Single weapon versus a custom loadout:** the rack contains the full weapon definition list, but only one weapon is active per test. There is no way to assemble a multi-weapon loadout or test multiple selected weapons together. Confirm whether that is required for the intended meaning of “test all weapons in a loadout.”
2. **Coverage and accuracy:** the arena runs each test for 1.5 seconds (1.8 seconds for orbit weapons), at weapon level 1, using the selected operator's stats. It raises attack range to at least 310 world units so attacks can reach the placed target. This makes the room useful for previews, but it does not reproduce normal run spacing or a full cooldown/DPS benchmark. Longer-duration, delayed, status, and evolution behavior needs deliberate review.
3. **Weapon list scope:** the rack is driven by `ALL_WEAPON_DEFS`; verify that this is the desired set, including character-specific and evolved definitions, and that every entry visibly activates against the target.
4. **Unlock design:** the first pass uses 616 total defeats. Confirm that this threshold and the main-floor placement match the intended progression.
5. **Localization:** the new screen copy is currently written directly in the component instead of using the locale message catalog. Move player-facing strings into the project's localization flow before treating localization as complete.
6. **Visual and input review:** no manual playtest or screenshot was done. Review desktop and narrow/mobile layouts, target readability, attack effects, keyboard focus, and whether any weapon requires different framing.
7. **Future ideas:** the user noted that more features exist but did not list them here. Capture those requirements separately before expanding this first pass.

The target stays defeated after a lethal test until Reset Dummy or another weapon test recreates it. Damage is bounded by the target's remaining HP, so a lethal test will not report theoretical overkill damage.

## Review checklist

- Does 616 defeats unlock this in the right place and at the right time?
- Should the mode support a multi-weapon custom loadout, or is one-at-a-time testing the intended first release?
- Should tests use the operator's live stats, fixed standard stats, or controls for level and stats?
- Are the three target durability settings useful, and should the target have a non-lethal/infinite-HP mode?
- Which weapon families, status effects, delayed attacks, evolutions, and orbit attacks need an explicit visual check?
- What additional features did the user have in mind for a later pass?

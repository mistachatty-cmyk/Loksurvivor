---
name: Settings tabbed nav + mobile/PC-standard settings
description: SettingsPanel reorganized into 7 category tabs, plus 5 new platform-standard settings (touch-control sizing, haptics, wake lock, fullscreen, reduce-motion override).
---

# Settings tabbed nav

`SettingsPanel.tsx` was one flat 981-line scroll of 14 sections with no
navigation. It's now a single component (not split into per-tab
sub-components -- each section's local state like `gyroDenied`/`devTapCount`
stays where it was) with a 7-category chip-tab strip reusing
`ArchivePanel.tsx`'s exact pattern: `useState<string>` for the active key, a
`flex flex-wrap` chip row, each tab's content in a `motion.section` fade+
slide-up. Categories: Gameplay (default), Audio, Display, Mobile controls,
PC & Browser, Data & Account, Developer. `SettingsPanel` is rendered from
two call sites (`App.tsx`'s `case 'settings'` and `RunScreen.tsx`'s
paused-run overlay) with an identical `{ onBack }` prop, so the redesign
applies to both automatically.

One deliberate reclassification while regrouping: the Hideout weather
toggle moved from the Audio tab (it lived in the same section as the real
audio toggle, Hideout ambience) to Display, since its own doc comment
already said it's "visual... unlike the audio ambience above."

## New settings (all additive, feature-detected, opt-in where battery/
permission-relevant)

- `touchControlsScale`/`touchControlsOpacity` (`'small'|'normal'|'large'`,
  `'subtle'|'normal'|'bold'`) -- visual-only multipliers on the virtual
  joystick in `RunScreen.tsx`. Deliberately never touch `STICK_RADIUS` or
  the `stick.dx / STICK_RADIUS` deflection math -- size is applied via CSS
  `transform: scale()` on the already-positioned outer ring (verified this
  doesn't desync from the `left/top` origin), opacity via computed
  `rgba(...)` inline styles replacing the old hardcoded Tailwind alpha
  classes.
- `hapticsEnabled` (default **on** -- `navigator.vibrate` needs no
  permission and no-ops harmlessly where unsupported). New
  `game/input/haptics.ts` (`hapticsSupported()`, `vibrate()`), called from
  `RunScreen.tsx` on the level-up phase transition and `RunSummary.tsx` on
  mount (win/loss-differentiated pattern).
- `wakeLockEnabled` (default **off**, opt-in). New `game/input/wakeLock.ts`
  (`useWakeLock` hook) mirroring `gyro.ts`'s shape -- the lock auto-releases
  when the tab hides and must be re-acquired on `visibilitychange`, which
  the hook handles. Held for a `RunScreen` mount's whole lifetime, not
  re-acquired per pause/resume.
- `reduceMotionEnabled` (default off -- an override on top of the OS
  setting, which stays primary). `anim/motion.ts`'s `prefersReducedMotion()`
  now also checks a `force-reduce-motion` class on `<html>`, toggled by an
  effect in `App.tsx`'s `Game()` off `meta.reduceMotionEnabled`. This let 4
  previously-hand-rolled `matchMedia` checks (`RunScreen.tsx`,
  `RunSummary.tsx`, `AttractMode.tsx`, `RigPortrait.tsx`) get deduplicated
  onto the one shared function for free. `index.css`'s 3 reduced-motion
  blocks got a sibling `:root.force-reduce-motion` rule each, since a media
  query and a class selector can't combine in one `@media` rule.
- Fullscreen -- **not** a `MetaState` field (persisting "was fullscreen" is
  meaningless across reloads; re-entering needs a fresh user gesture
  anyway). Local component state in `SettingsPanel.tsx`, synced via the
  `fullscreenchange` event so exiting via Esc is reflected too.
- A static keyboard-shortcuts reference card (no state) confirms the actual
  bindings by reading `RunScreen.tsx`'s keydown handler directly: WASD/
  arrows to move, Space for ultimate, Esc/P to pause -- nothing else exists.

## e2e note

`e2e/run-controls.spec.ts`'s hideout-palette test needed one added
`button-settings-tab-display` click before its Theme & palette assertions,
since that section moved under a tab. Two *other* failures in that same
spec file (a `page.reload()` timeout, and a `data-ui-theme` locator strict-
mode violation caused by `App.tsx`'s `ThemedGame` wrapper duplicating
`ScreenLayout`'s own `data-ui-theme` attribute) were confirmed via
`git stash` to reproduce identically against the pre-redesign file --
pre-existing sandbox/test issues, unrelated to this change, left as-is.

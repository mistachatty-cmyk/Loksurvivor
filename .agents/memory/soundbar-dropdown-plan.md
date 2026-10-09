---
name: Soundbar volume bar and micro dropdown plan
description: Plan (not yet built) for an animated volume bar and a small in-game dropdown on the global MusicNowPlaying bar, with findings about what exists today.
---

Read before changing `src/ui/MusicNowPlaying.tsx` or the volume/persistence
parts of `src/game/audio/musicPlayer.tsx`. Planned 2026-10-09; nothing below is
implemented yet.

## What exists today (verified)

- `MusicNowPlaying` is mounted once in `App.tsx` (~line 696) above the screen
  switch, plus an `inline` copy in `HubScreen.tsx` (~line 655). It has three
  states: no track (single shuffle button), collapsed (round 40px icon), and
  expanded (title + previous / shuffle / play / next). Placement is `default`
  (top-left), `menu` (bottom-right) or `inline`.
- It has NO volume control, no seek bar, no mute button.
- The player context already exposes everything needed, so no engine work:
  `volume`, `muted`, `setVolume(0..1)`, `toggleMute`, `progressSec`,
  `durationSec`, `seek`, `shuffle`/`toggleShuffle`, `repeat`/`cycleRepeat`,
  `playbackRate`/`setPlaybackRate`. `setVolume(>0)` already un-mutes.
- `MusicPanel.tsx` (~line 693-704) already has a plain `<input type=range>`
  volume slider (`data-testid="input-volume"`); reuse its mapping.

## Gaps found

1. **Volume does not persist.** `musicPlayer.tsx` line ~492 is
   `useState(0.7)` with no localStorage, so every reload resets to 70%. Fix:
   store `volume` and `muted` under one new key (same try/catch pattern as
   `AUTO_START_STORAGE_KEY`), read lazily in the initial state.
2. **Linear volume feels wrong.** HTMLAudio volume is linear; the low end is
   too sensitive. Map slider position `s` to `volume = s * s` (and the inverse
   `Math.sqrt(volume)` for display) so the bar feels even.
3. **No in-run access.** During a run the bar is only the tiny top-left icon;
   a player cannot change volume without leaving to Settings.

## Plan

### P1 (priority): animated volume bar
- Volume icon button inside the expanded bar. Icon switches
  `VolumeX` (muted or 0) / `Volume1` / `Volume2`; click toggles mute.
- Hover, focus, or tap reveals a slim slider that grows out sideways from the
  icon (width 0 to ~5rem, `transition-[width,opacity] duration-200`, ease-out).
  Touch: tap the icon to open, tap outside or 2.5s idle to close.
- Fill is a gradient track in the primary colour with a glowing thumb that
  scales up on drag. A tiny numeric readout (0-100) fades in while dragging.
- Use pointer events with `setPointerCapture` (not just `<input range>`) so
  dragging works with the touch movement stick not stealing the pointer
  (see `sector-command-design.md`: stick and other pointer grammars never
  share a pointer-down). Keep a visually-hidden real `<input type=range>` or
  `role="slider"` with arrow-key / Home / End support for accessibility.
- Mouse wheel over the bar nudges by 5%.
- Respect `prefers-reduced-motion` (already handled in `index.css` line ~173):
  skip the width animation, just show/hide.
- Test ids: `button-global-music-mute`, `slider-global-music-volume`.

### P2: micro dropdown ("more")
A chevron or `...` button at the end of the expanded bar opens a small panel
that drops down (scale-y + fade, 150ms, origin top; flips to open upward for
the `menu` bottom-right placement). Contents, in order of value for in-game use:
- Seek bar with elapsed / duration (`formatTime` already exists).
- Shuffle and repeat (off / all / one) toggles.
- Playback speed (0.75 / 1 / 1.25) via `setPlaybackRate`.
- "Open music panel" link to the full `MusicPanel`.
- Optional: track list quick-pick (unlocked tracks only, reuse the `locked`
  filter from `playRandomUnlocked`).
Close on outside click, Escape, or screen change. Only one popover open at a time
(volume slider and dropdown are exclusive).

### P3: in-run behaviour
- Keep the collapsed icon during runs; on `run` and `arena` screens auto-collapse
  the dropdown when the pause menu or level-up overlay opens (they are fixed
  overlays; see `fixed-popups-and-ancestor-filters.md` about ancestor filters
  breaking `fixed` children).
- Optional keyboard shortcuts while a run is paused only: M mute, [ and ] volume.
  Do not bind during live play, the sim uses keys for movement and abilities.

## Verification when built
- `pnpm typecheck`, `pnpm test` (new `*.test.ts` are picked up automatically).
- Unit test the pure helpers (slider position to volume curve and back, clamp).
- Playtest with a headless browser and screenshots: hub inline, intro (top-left),
  a menu screen (bottom-right, dropdown opens upward), mobile width 375px, and
  a run on a touch layout.
- Copy: add strings to `src/locales/en.json` only (see Localization). Do not use
  the prohibited word from CLAUDE.md in any name, id, class, or comment.
- Bump `changelog.ts` and regenerate `public/lok-updates.json`.

## Revision (owner direction, same day) -- supersedes the P1/P2 placement above

The soundbar's standard stays exactly as is: closed (round icon) and open
(title + previous / shuffle / play / next). The volume bar and everything else
are a third, opt-in tier. Nothing new is visible by default.

Reveal order: closed icon -> click -> open bar (unchanged) -> click "more" -> panel.

How to expand without increasing the bar's profile:
- The panel is an overlay, never in flow. It is portalled to `document.body`,
  `position: fixed`, placed from the anchor's `getBoundingClientRect()`, so the
  bar's width and height never change and parent `overflow` (the hub's inline
  placement) cannot clip it. Opens downward for top-left, upward for bottom-right,
  and flips if it would leave the viewport. Match `z-[100]` of the bar.
- The only change to the open bar is one small "more" chevron button. The title is
  already `flex-1 truncate`, so the chevron takes ~28px from the title, not from
  the bar: outer width stays within the existing `max-w-[min(18rem,...)]`.
- The volume slider lives in the panel's first row, not on the bar. The
  mute/volume icon is the panel's first control. Panel width ~ the bar's width.
- Animation: panel scales/fades from the chevron (origin at the anchor, 150ms);
  rows stagger in 30ms apart; chevron rotates 180deg. Reduced motion: no animation.
- Closing the bar (collapse icon), Escape, outside click or a screen change also
  closes the panel. The panel's open state is NOT persisted: a fresh load starts
  at the standard closed bar.
- The closed (collapsed) state keeps zero extra controls; the no-track state is
  unchanged.

## Status: built in 0.22.7

Implemented as designed: `src/ui/SoundbarPanel.tsx` (portal, fixed overlay),
chevron `button-global-music-more` in `MusicNowPlaying.tsx`, pure helpers and
volume persistence in `src/game/audio/volumeCurve.ts` (+ test), strings under
`soundbar.*` in `en.json`, `.soundbar-*` styles in `index.css`. Verified in a
headless browser at 420px: bar size is identical before and after opening.
Gotcha found: on phones the top-left bar ran under the fixed Looks & LokPets
button and hid the chevron. Fixed by removing that button from the intro screen
(owner request), not by shrinking the bar; it is already absent on hub/run/arena.
Not built: quick track picker, "open music panel" link, pause-only hotkeys.

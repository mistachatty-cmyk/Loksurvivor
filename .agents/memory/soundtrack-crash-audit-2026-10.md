# Soundtrack crash and speed audit (2026-10-20)

Read before changing `src/game/audio/musicPlayer.tsx`, the `.music-reactive-root`
CSS, or the error boundary. Full detail is in `docs/soundtrack-crash-audit-2026-10-20.md`,
`docs/soundtrack-speed-history-2026-10-20.md` and `docs/soundtrack-fix-plan-2026-10-20.md`.

## Durable facts

- The only ways to reach the `intro` screen are the first mount and one Back button
  (`App.tsx:220`, `:576`). A crash that lands on intro is a full remount (outer
  `ErrorBoundary`, "Try again") or a page reload (OS tab kill), never a normal
  navigation. In production the boundary fallback hides the error text.
- Nothing outside `musicPlayer.tsx` writes `src`, `currentTime`, `volume`, `muted` or
  `playbackRate` on the audio element. Beat-reactive gameplay is read-only for audio.
  Keep it that way (see `music-reactivity.md`).
- Setting `audio.src` resets `playbackRate` to `defaultPlaybackRate` (the HTML load
  algorithm). The player stores the chosen rate in state but does not re-apply it
  after a track change, so the speed UI and the element can disagree, and touching
  volume or mute re-applies the stale rate and jumps the speed.
- Playback speed was added on 2026-10-04 (`e177eb8`, the AI Studio merge). Before
  that the player had no speed control.
- `--music-energy` is written on the app-wide root every frame and inherited by the
  whole DOM, and `.music-reactive-root::before` is a full-screen blend overlay. The
  "Music reactivity" setting only gates the run loop's read of the beat bus, not this.
- The context value includes `progressSec`/`durationSec`, so every `useMusicPlayer()`
  caller re-renders on each `timeupdate`.
- The recovery listener resumes only `'suspended'`; Safari also uses `'interrupted'`.

## Status

Audit only, no code changed. Typecheck clean, 1020 tests green. The crash was **not**
reproduced (no device or browser in the audit sandbox), so the causes of the mobile
crash itself are ranked, not proven. Do the instrumentation phase before guessing.

## Cheap wins once approved

Pin the rate to the element on every load, split progress out of the main context,
drive the overlay with direct opacity at a low rate, honor the reactivity setting,
add a per-screen error boundary, and validate music-event ids in a test.

# Soundtrack speed: what can change it, and the history (2026-10-20)

Status: **audit only.** Companion to `docs/soundtrack-crash-audit-2026-10-20.md`.
Fixes are listed in `docs/soundtrack-fix-plan-2026-10-20.md`.

## The question

Songs seem to speed up and slow down, in places that were meant to be
gameplay-only feature sets, and it reaches the whole app and spoils the sound.
Was this caused by a change a long time ago?

## Short answer

- **The game has no code path that changes a song's speed.** The only writes to
  the audio element are in `musicPlayer.tsx` (list below). Beat-reactive gameplay
  speeds up and slows down actors and visuals to the music, which is a different
  thing and is read-only with respect to audio.
- **The player's own speed control is manual, global and buggy.** It was added on
  2026-10-04 through the merge commit `e177eb8` ("Merge Google AI Studio build
  (1.9) into main as v0.10.1"). It can leave the audio element and the on-screen
  speed disagreeing, which makes speed appear to change by itself.
- The feature you are thinking of, "music drives the game", is real and dates from
  2026-08-28 (`c0c3d53`). It leaks app-wide **visually** (a pulsing overlay on
  every screen), not audibly.
- For garbled or wrong-speed sound on iPhone specifically, the likeliest cause is
  a WebKit audio-route problem the team already documented, not game logic.

## Every place that can change playback speed or position

Searched all of `src/`. Writes to the audio element, all in
`src/game/audio/musicPlayer.tsx`:

| Line | Write | Triggered by |
| :--- | :--- | :--- |
| 696-697 | `audio.src = track.url` and `currentTime = 0` | Starting or skipping to a track |
| 739 | `currentTime = 0` | Repeat-one when a song ends |
| 771-773 | `volume`, `muted`, `playbackRate` re-applied | Effect on `[volume, muted, playbackRate]` |
| 1268-1269 | `src` and `currentTime` | MP3 conversion swap |
| 1416 | `currentTime = 0` | Previous-track button |
| 1428 | `currentTime = seconds` | Seek bar |
| 1479 | `playbackRate = clamped` | `setPlaybackRate`, called only by the two speed UIs |

Callers of `setPlaybackRate`: `MusicPanel.tsx:731` (buttons 0.75, 1, 1.25, 1.5x)
and `SoundbarPanel.tsx:191` (a cycle button, 0.75, 1, 1.25x). Nothing in the
engine, renderer, run loop or any area data calls it.

## Timeline

| Date | Commit | What changed | Effect on speed or sound |
| :--- | :--- | :--- | :--- |
| 2026-08-25 | `62ea810` | Music player created. The `<audio>` element is routed through Web Audio into an analyser. `--music-energy` root variable and overlay added. | Original design: all music passes through Web Audio. The app-wide overlay starts here. |
| 2026-08-28 | `c0c3d53` | "Make the game react live to the soundtrack": tempo analyser, beat bus, `reactivity.ts`, `speed`, `scale`, `glow` reaction targets. Analyser grew from 128 to 1024 points. | This is the "feature sets that depend on what is happening" change. Gameplay-only; adds per-frame analysis cost. |
| 2026-08-30 | `f07b59d` | Video drop, in-browser MP3 conversion, link import, playlists. | None on speed. |
| 2026-09-05 | `edeb155` | Audio crash and hang fixes (shuffle loop, double revoke, throwing `close()`). | Stability only. |
| 2026-09-20 | `8da5753` | Soundtrack progression and track locks. | None on speed. |
| 2026-09-26 | `d3f9c7c` | Resume the shared context after a mobile tab is backgrounded. Notes the next suspect is WebKit sample rate after an audio route change. | Fixes silence after backgrounding. Handles only the `'suspended'` state. |
| **2026-10-04** | **`e177eb8`** | **Adds `playbackRate` state, `setPlaybackRate`, an effect that re-applies the rate, and speed buttons in the Music panel.** | **Introduces user-controlled speed for the entire player.** |
| 2026-10-08 | `d3fc1f0` | Studio public beta MVP. (The Studio has shared the app's one context since 2026-08-28, via Tone.) | Shares the context. Does not touch the media element. |
| 2026-10-09 | `e34d913` | Soundbar: a global panel mounted on `document.body` with a speed button, and persisted volume. | Puts a speed button on every screen. |

Most relevant to "a change way back": `e177eb8`. Before 2026-10-04 there was no
way for the player to run at any speed other than normal.

## Finding S1: speed is global, not persisted, and reachable everywhere

There is one `<audio>` element for the whole app, so one speed applies to every
track, every hideout room's authored song, and the run music. It resets to 1x on
each launch (`useState(1.0)` at `musicPlayer.tsx:511`), so it is never stored.
The Soundbar is portaled to `document.body`, so a speed button can sit on top of
any screen, easy to tap by accident on a phone.

## Finding S2: the element and the on-screen speed can disagree (Likely)

Per the HTML standard's media element load algorithm, setting a new `src` resets
`playbackRate` to the element's `defaultPlaybackRate`, which is 1. Chromium and
WebKit follow this. The player never sets `defaultPlaybackRate`, and it does not
re-apply the chosen rate after `audio.src = track.url` (`musicPlayer.tsx:696`) or
after the conversion swap (`:1268`).

What that does in practice:

1. Choose 1.25x. The element runs at 1.25x and the UI reads 1.25x.
2. The song ends or you press next. The element resets to 1x. **The UI still reads
   1.25x.** The new song plays at normal speed.
3. Touch the volume slider or mute. The effect at `:768-774` re-applies the stored
   rate, and the song **suddenly speeds up** mid-track.

Because the Soundbar's volume bar is the most-touched control, this produces
exactly "songs change speed in places they shouldn't". It is also why behavior
seems to depend on "what is happening", since track changes and volume touches
trigger it.

Confidence: high that the standard behaves this way. **Not yet reproduced on a
device**, because no browser was available. A 30-second check is below.

## Finding S3: non-1x speed degrades sound (Likely)

Browsers keep pitch constant at other rates by time-stretching, and stretching
audibly smears transients. Bass-heavy and drum-forward music shows it first.
Nothing in the UI warns about this, and the beat grid also scales with the rate
(`authoredTiming` multiplies by `audio.playbackRate`, `musicPlayer.tsx:595`), so
the game's reactions stay locked to a stretched version of the song.

## Finding S4: iPhone wrong pitch or speed, a separate mechanism (Hypothesis)

If speed or pitch changes happen with the speed control at 1x, look at the audio
route, not the game. The team recorded this on 2026-09-26
(`.agents/memory/music-reactivity.md`): after a route change (headphones,
Bluetooth, speaker) WebKit can leave a long-lived `AudioContext` at the wrong
sample rate, and the fix is rebuilding the source and analyser graph rather than
calling `resume()`. The current code never rebuilds the graph and handles only the
`'suspended'` state, not Safari's `'interrupted'`.

A busy main thread (see the crash audit, F3 and F4) can add stretched or glitchy
audio on top of that when playback is routed through Web Audio.

## Quick checks to confirm S2 on a device (about 30 seconds)

1. Open the Music panel and set speed to 1.25x.
2. Skip to the next track. Listen: it plays at normal speed while the button still
   says 1.25x.
3. Drag the volume slider a little. Listen for the song suddenly speeding up.

If both happen, S2 is confirmed and the fix is a few lines (fix plan, item P1-1).

## What did NOT cause it

- Beat-reactive gameplay. It scales actor speed, sprite size, glow and screen
  shake from the beat bus and never touches the audio element. This was verified
  by searching every write to the element.
- The analyser. It reads frequency data only.
- The effects engine. It adds short oscillator and noise voices on the shared
  context with a 12-voice cap and does not alter the music source.
- The Studio. It adopts the shared context and publishes its own beat grid, but
  does not write to the soundtrack's media element.

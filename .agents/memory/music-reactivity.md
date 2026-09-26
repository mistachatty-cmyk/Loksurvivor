# Music reactivity contract

## Decision

The game reacts to whatever the player is listening to through **one seam**:
`src/game/audio/beatBus.ts`. Nothing downstream ever talks to an
`AnalyserNode`, and nothing upstream knows what a reaction is.

Two producers publish into the bus and are arbitrated by priority:

| source     | priority | produced by |
|------------|----------|-------------|
| `none`     | 0        | the default `SILENT_FRAME` |
| `detected` | 1        | `audio/analysis.ts`, estimating a grid from the soundtrack player |
| `studio`   | 2        | (future) an in-game studio transport publishing its **exact** grid |

A lower-priority publish is dropped while a higher-priority source holds the
bus, so background detection can never fight an authored grid. The holder
calls `release()` to hand it back.

## Why it is shaped this way

- **The bus is a module singleton, not React state.** It is read once per
  animation frame; a context would re-render the whole tree 60x a second. UI
  that wants it uses `useAudioFrame()`, which samples at ~15 Hz.
- **`stepWorld` takes the frame as input, never reads the bus.** `RunScreen`
  reads `beatBus.read()` once per rendered frame and holds that value across
  every fixed-timestep substep. Reading inside the catch-up loop would let a
  single beat retrigger several times on a slow frame. This also keeps the
  simulation a pure function of its inputs, so the engine tests can drive
  synthetic `AudioFrame`s with no browser.
- **A phase-locked loop, not onset snapping.** `analysis.ts` free-runs the beat
  phase from the tempo estimate and only *nudges* it toward detected onsets
  (`PLL_GAIN`, and only within `PLL_CAPTURE_BEATS`). Snapping directly to
  onsets makes the whole screen jitter on a busy hi-hat.
- **Low confidence disables bonuses, never imposes penalties.** `isOnBeat()`
  returns false below `BEAT_TRUST_THRESHOLD`, so a track the analyser reads
  badly costs the player nothing.

## Reactions are content, not code

Per the rule in `types.ts`, moving a new enemy to the beat is a record, not a
loop edit. `EnemyDef.react` / `CharacterDef.react` carry `BeatReaction[]`
(`data/reactivity.ts`), and `REACTION_PRESETS` holds the named tuning sets.
The simulation consults them in exactly one helper (`musicMultiplier` in
`world.ts`); the renderer has its own (`musicVisual` in `draw.ts`).

**Visual targets (`scale`, `glow`, `lightRadius`) are applied only in the
renderer.** Two players watching the same seed with different music must see
identical *gameplay*. Only `speed` and the on-beat damage bonus touch the sim,
and both are bounded multipliers.

## Constraint inherited from the art-assets memory

Audio is the dev's own bundled tracks or files the player picks off their own
device. Analysis is entirely in-browser; nothing is uploaded, and no external
catalog is streamed or claimed as licensed.

## Mid-run audio must never be altered -- fixed 2026-09, still true

The soundtrack `AudioContext` is shared app-wide (`musicPlayer.tsx`) and gets
suspended by mobile browsers whenever the tab is backgrounded (locking the
screen, an incoming call, switching apps) to save power. Nothing resumed it
automatically, so returning to an in-progress run read to the player as "my
music got messed up mid-game" -- silence or a stuck moment until some
unrelated UI interaction happened to call `ensureAudioContext()`. Fixed with
a `visibilitychange` listener in `MusicProvider` that calls `context.resume()`
only when the existing context is `'suspended'` -- it never recreates the
context, never touches `volume`/`playbackRate`/any filter, and does nothing
if the context is already running. If this class of bug resurfaces (garbled
pitch rather than silence after backgrounding), the next step is almost
certainly WebKit's known sample-rate-after-route-change issue, which needs
tearing down and rebuilding the `MediaElementAudioSourceNode`/analyser graph,
not just a `resume()` call.

## Future idea (not built): let the music drive spawns/waves, never audio

The user has floated reusing `beatBus`'s energy/frequency-band data (already
published every frame by `analysis.ts`) to trigger *gameplay* events when the
music crosses a loudness/frequency threshold -- a tactical wave shape, a
named faction arriving, a burst of more enemies or more ranged enemies, a
palette/color shift, or a one-off special event. This is explicitly a later
feature, not requested to be built now, and explicitly must **never** alter
the audio itself (no volume/pitch/EQ changes tied to gameplay) -- the fix
above exists specifically to keep mid-run audio untouched, and any such
future work must preserve that boundary.

If it does get built, it slots into the existing "reactions are content, not
code" shape above: a new consumer of `beatBus` (bands/energy, not raw FFT
data) feeding into `stepWorld`'s wave-selection logic the same way
`musicMultiplier` already feeds speed/damage, with named presets in data
rather than one-off checks in the loop. `WaveDef`'s existing `burst`/`group`/
`formation` fields and `squadWave()` (see `content-authoring-system.md`) are
probably the right vocabulary for "a certain faction" or "more enemies in
general" once someone actually designs the trigger thresholds.

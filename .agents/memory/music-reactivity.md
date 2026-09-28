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

## Built 2026-09: music-driven spawn/palette events, audio still untouched

The future idea below shipped as `data/musicEvents.ts`'s `MusicSpawnEvent`
(`trigger` + `effect`) plus `world.ts`'s `applyMusicEvents`, consulted once
per tick from `updateSpawning` -- a new, separate seam from `musicMultiplier`,
because this is *discrete/edge-triggered* (a one-shot action once a
band/energy threshold crosses, gated by a per-event `cooldownMs`) rather than
`BeatReaction`'s *continuous* multipliers. `AreaDef.musicEvents` is optional
and empty on every area except `monroe-strip` (two events: a bass-threshold
enemy burst, an energy-threshold `afterimage-choir` squad arrival), so this
never affects an area that hasn't opted in.

Three effect kinds exist: `squad` (spawns a named faction's whole roster via
a new dedicated `spawnMusicSquad`, deliberately not `spawnDirectorSquad`,
which is coupled to `DIRECTORS`/boss tracking this has no use for), `burst`
(spawns N copies of one enemy id -- the vocabulary for both "more enemies in
general" and "more ranged," by simply picking a ranged enemy id), and
`palette` (resolves a `paletteId` against the existing `THEMED_PALETTES`
registry). Both spawn kinds reuse `spawnEnemy`, which already no-ops past
`enemyCap(w)`, so no new cap logic was needed.

**The palette effect is additive, never destructive.** `World.worldColorPalette`/
`worldColorFullRecolor` are the player's own settings-driven theme choice, set
once at `createWorld`. A music event instead sets a new, separate
`World.musicColorOverride`, and the three `draw.ts` tint sites (`groundTint`,
`worldTint`, the enemy-palette blend cache) check `musicColorOverride ??`
that settings-driven pair -- so a music event can add a color shift on top,
but can never overwrite or lose the player's own choice. It's sticky (no
timer) until a different palette event fires or the run ends.

**Still true: this never touches audio playback.** `applyMusicEvents` only
reads `w.audio`/`w.now`/`w.area`; it has no reference to `musicPlayer.tsx`,
`beatBus`, or any `AudioContext`/`<audio>` element, and stays inside
`stepWorld`'s existing purity contract (consult `w.audio`, nothing else).

**Deliberately deferred to v2, not silently skipped:**
- **Endless-mode wiring.** `updateEndlessSpawning` is a separate spawn path
  with its own difficulty-cap composition rules (`hpMult` ≤ 1.7, spawn rate
  ≤ 3.2/s, composed *inside* `Math.min()` per `endless-mode-engine.md`) --
  music events don't fire there yet.
- **Any sustained/decaying effect kind** (e.g. "boost spawn rate for N
  seconds"). v1 is one-shot only by design, specifically to avoid having to
  compose a new multiplier inside those same difficulty caps for a first
  ship.
- **Open-ended "special events"** beyond squad/burst/palette --
  `MusicEventEffect` is a closed discriminated union; add a variant plus a
  `fireMusicEvent` case when a concrete fourth kind is actually designed,
  rather than a speculative generic hook.

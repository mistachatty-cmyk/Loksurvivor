# The in-game studio

Why the studio is built the way it is. Read before changing anything under
`src/game/audio/studio/` or `src/ui/studio/`.

## One `AudioContext`, always

The soundtrack player creates the app's context lazily on first playback and
exposes it through `getAudioContext()`. The studio engine adopts that context
(`Tone.setContext(new Tone.Context({ context })))`) rather than making its own.

Two contexts fight over the output device, and mobile Safari suspends one of
them without warning — the symptom is "audio works on desktop, one of the two
sources is silent on iPhone", which is miserable to diagnose after the fact.
If the player has not unlocked a context yet, Tone creates one and the player
adopts *that*. Either way there is exactly one.

The same rule is why `importAudioFile` takes a context instead of constructing
one: a context per dropped file leaks one per import.

## The bus is the only seam

The studio publishes to `beatBus` as source `'studio'`, which outranks
`'detected'`. That is the entire integration: no consumer knows the studio
exists, and every reaction written against live detection starts running on an
exact grid the moment the transport rolls. Don't add a studio-aware branch to
a consumer — if a consumer needs something, it belongs in the frame.

`stopStudioClock()` must release the bus, or live detection stays locked out
for the rest of the session.

## `Tone.Draw`, and why beat position comes from ticks

Transport callbacks fire *ahead* of real time; that lookahead is what makes
scheduling sample-accurate. Publishing a visual frame straight from one runs
the game's beat reactions ~100ms early, which reads as mushy rather than as
"early" — you feel it without being able to name it. `Tone.getDraw().schedule`
defers the publish to the frame whose wall-clock matches.

Beat position is read from `transport.getTicksAtTime(time) / transport.PPQ`,
never counted up per callback. A counter drifts permanently the first time a
draw is dropped or coalesced, and it drifts silently.

`tickStudioClock()` interpolates `phase` between quarter notes. Without it the
bus only moves on beats, and every continuous reaction steps at 2-4Hz instead
of moving.

## Model and graph are separate on purpose

`project.ts` is plain JSON with no Tone types and no Web Audio objects, so it
serialises, exports as `.616song`, and unit-tests under `node --test` with no
browser. `tracks.ts` owns every node and reconciles against the model.

Consequences worth remembering:
- `TrackGraph.sync()` reuses nodes rather than rebuilding. Rebuilding on every
  fader frame clicks audibly.
- Effects are keyed by effect *instance* id, so two of the same effect stay
  distinct and a parameter move does not rewire the graph.
- Gain and pan changes ramp (20ms). Setting them instantly clicks.
- Decoded buffers are **not** serialised — a project references the player's
  files, it does not carry them. A project reloaded in a fresh session has
  clips whose buffers are gone; the graph skips them so the rest still plays.
  If that ever needs to change, the fix is re-import, not persisting audio.

## Never hard-wire a connection

Nothing calls `a.connect(b)` between a source and the master. Every track owns
an ordered `inserts` array and `rewire()` is the only function that connects
anything, using `Tone.connect` (which bridges Tone nodes and raw `AudioNode`s
in both directions).

This is not tidiness — it is what lets a WAM plugin, which is a raw
`AudioNode` and never will be a Tone node, take an insert slot with no change
to playback code.

## Instrument tracks are ordinary tracks

A track plays a synth instead of audio clips when `instrumentId` is set, and
that is the *only* difference. One mixer, one insert chain, one solo rule and
one export path cover both, and the piano roll simply appears for tracks that
have an instrument.

Two details that bite:
- `syncVoice()` rebuilds the voice only when the instrument actually changes.
  Disposing and recreating a PolySynth cuts every note currently sounding.
- The sanitiser must not write `instrumentId: undefined`. `JSON.stringify`
  drops an undefined key, so a track carrying one is not equal to itself after
  a save and load — which a round-trip test catches and a user would not.

Note pitch is a MIDI number, not a name, so transposing and drawing are
arithmetic. Notes snap to sixteenths; a piano roll that lets a note land
between semitones is not a piano roll.

## Export renders offline, and rebuilds the graph

`Tone.Offline` rather than `MediaRecorder`: deterministic, faster than
realtime, no codec surprises. The graph is rebuilt inside the offline callback
because nodes belong to the context that created them — the live graph cannot
render there. Rebuilding also means an export is unaffected by whatever is
currently soloed or half-scheduled.

The insert chain must be rebuilt in the same order, or the exported file is not
the mix the player just heard.

WAV is written by hand (16-bit PCM RIFF). Full scale maps asymmetrically
(`-1 → -32768`, `+1 → +32767`) so a hot mix cannot wrap to the opposite rail,
which sounds like a click at the loudest moment.

## React stays out of the audio path

- The playhead is a ref, read by the timeline canvas in its own loop. Putting
  it in state re-renders the tree 60×/s to move one line.
- Pads trigger synchronously inside `pointerdown` and light up via a direct
  style write. A state round-trip costs at least a frame, and a frame of
  jitter is audible as sloppy timing.
- Pointer capture is best-effort: `setPointerCapture` throws `NotFoundError`
  for a pointer the browser no longer considers active, and an uncaught throw
  in a pointer handler aborts the whole interaction. Always guard it.

## Plugins are opt-in, and that is a real decision

Everything else in this app is local — the soundtrack plays the player's own
files, stems are decoded in-browser, nothing is uploaded. A WAM plugin breaks
that shape: it fetches and executes code from another origin.

So it is off by default (`meta.studioPluginsEnabled`), the SDK is fetched on
demand rather than added to `package.json`, no plugin URL ships as a default,
the URL must be `https:`, and the UI says plainly what loading one means. That
setting defaults to false on every load *including upgrades* — remote code is
never enabled by shipping a new version.

`wam/host.ts` is deliberately the entire blast radius. If plugin support is
removed, nothing else in the studio changes.

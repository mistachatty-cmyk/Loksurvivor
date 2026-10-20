---
name: Hideout strip scenery and room melody
description: Why the hideout strip paints a per-room backdrop in canvas (not CSS), and how the ambience audio's melody layer works. Read before adding a room, biome or ambience profile.
---

## Why this exists
The strip (`ui/HideoutPreview.tsx`) used to draw actors on a transparent canvas over a
generic dim band, which read as flat and generated. Rooms now have a painted look.

## Scenery (`ui/hideoutScenery.ts`)
- Pure functions of `now`, music energy and beat phase -- no state, so reduced motion
  (`now` forced to 0, no dust) renders an exact still frame.
- `drawSceneryBack` (backdrop per `HideoutBiome`, floor + light pool under the
  operator, drifting dust) runs right after `clearRect`; `drawSceneryFront` is a
  side vignette after everything. A new room look = one `case` in `drawBackdrop`.
- `HubScreen` passes `scene.biome` and `scene.homeAccent`; the lamp/pool colors come
  from the room accent, so a room's data already tunes its lighting.
- Footstep puffs reuse the spark list (capped at 48), tinted by `dustColorFor`.
- This is separate from the CSS weather layer (`hideout-ambiance.md`): weather stays
  CSS and fixed-`rem`-tiled; scenery is canvas and sized to the strip only.

## Ambience melody (`audio/ambience.ts`)
- `BedProfile.melody` = a small scale, a mean gap and a waveform. Notes are soft
  plucks chosen by a +-1 random walk along the scale so they wander, never loop.
- Chained `setTimeout`s like the accents, cleared in `stop()`. Still opt-in
  (`hideoutAmbienceEnabled`, default off) and mixed under the soundtrack.
- `snow` has no melody on purpose (no room uses it today).

## Ideas not built
Per-room leitmotif that locks to `beatBus` tempo when the player's music plays;
time-of-day tint on backdrops; NPC silhouettes in windows.

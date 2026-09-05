---
name: Hideout ambiance and character-tier roadmap
description: Why the hideout's CSS weather background must use fixed background-size, plus recorded (not yet built) design intent for Artisan Valor's identity split and a Prime character tier.
---

## Hideout background weather is CSS, not canvas -- and its tile size must be fixed, never a percentage

`data/hideout.ts`'s `HIDEOUT_SCENES` (one `HideoutSceneDef` per hub room, e.g.
`main-floor: { weather: 'rain', ... }`) drives a purely decorative
`.hideout-weather-*` class in `HubScreen.tsx`, animated entirely in
`index.css` -- a different, unrelated system from the in-run weather in
`sky-ambiance.md` (`SKY_PROFILES` / `drawRain` in `render/draw.ts`). Nothing
here is `World` state; it's a CSS `background-position` keyframe loop.

**Bug (fixed):** `.hideout-weather-rain .hideout-weather-particles` had
`background-size: 100% 8rem` -- a percentage width, so the gradient's own
3.5rem repeat unit got stretched to fill the container's actual width. On a
narrow phone viewport that stretch is mild and the rain reads fine; on a
wide desktop monitor the same pattern gets stretched ~30-40x wider, so the
animation's fixed `-3rem` per-loop `background-position` shift becomes an
imperceptible fraction of the (now much wider) pattern -- the rain reads as
frozen, though the animation is technically still running. Reported as
"rain doesn't flow on a bigger screen."

**Fix:** `background-size: 3.5rem 8rem` -- a fixed width matching the
gradient's own repeat period, tiled by the default `background-repeat`
instead of stretched to the container. Apparent rain speed and density are
now identical at every viewport width.

**Why this was the right fix, not a smaller `-3rem` fudge or a JS
solution:** `.hideout-weather-snow` (same `hideout-rain` keyframes, a
radial-gradient dot pattern) was already authored correctly with a fixed
`background-size: 2.4rem 2.4rem` -- confirming a fixed tile size is the
established, working pattern here, and rain's `100%` width was the one-off
mistake. Any new `.hideout-weather-*` variant should copy snow's fixed-size
approach, not rain's original one.

## Roadmap notes -- not yet built, recorded so the vision survives to when it is

The rest of this doc is **design intent only**. Nothing described past this
point exists in code yet; do not treat any of it as an implemented contract.

### Artisan Valor has three distinct planned identities

As of this writing, `data/characters.ts` has exactly one `artisanvalor`
entry: red/black palette (`accent: '#ff2b4d'`), hooded, `staff: true` rig.
The user's stated intent is for this to eventually split into three:

1. **Artisan Valor** (current, shipped) -- the red/black staff-wielding
   Curator described above. Stays as-is.
2. **Artisan Valor Prime** -- an unreleased, more-powerful variant, part of
   a **Prime tier planned across the whole roster** (not unique to this
   character). Prime variants are described as cosmetically
   color-fluctuating ("fluctuate colors... in many ways") on top of being
   mechanically stronger (special weapons/stats). No fluctuating/animated
   per-character palette mechanism exists in the codebase today --
   `data/themedPalettes.ts` is a *static*, globally-applied, purchasable
   palette swap (affects all characters/enemies/environment at once), not a
   per-character animated color cycle. A Prime tier would need a new
   mechanism, not a reuse of that system.
3. **Artisan Valor Shop** -- the character's *original* design before the
   red/black/staff version shipped: brown, generic, no staff. Explicitly
   described as "a mistake that grew on" the user, kept for a future base
   shop character. **How this hooks into the game mechanically is
   explicitly undecided** -- asked directly, the answer was "just a design
   note for now," so do not invent a shop/unlock mechanic for it without
   asking again when this is actually picked up.

## Procedural room audio (`src/game/audio/ambience.ts`) -- opt-in, asset-free

`startHideoutAmbience(context, scene, level)` synthesizes a per-room bed from
filtered noise plus a drone and scheduled one-shot accents: rain hiss upstairs,
a low fog drone on the perch, and a dedicated cellar bed (pipe hum + slow
drips) because the record grotto is the room the player is invited to sit in.
Nothing ships as an audio file and nothing is fetched.

Three constraints worth keeping:
- **It reuses the music player's single `AudioContext`** (`ensureAudioContext`,
  newly exposed on `MusicPlayerValue`) -- a second context fights over the
  output device and iOS suspends one of them, the same rule `studio-engine.md`
  records.
- **`meta.hideoutAmbienceEnabled` defaults to `false`**, unlike the other audio
  toggles, and an old save without the key stays off (`=== true`, not
  `!== false`): a returning player must never be surprised by new noise.
- **Accents are chained `setTimeout`s, not an interval** -- a throttled
  background tab then just gets fewer of them rather than a burst on return.
  The bed is also torn down entirely while the tab is hidden and on every room
  change, so two beds can never overlap.

This is the "toggleable ambiance" the roadmap note below asked for, on the
audio side; the CSS weather variety part of that note is still open.

### Hideout room ambiance: more variety, toggleable

Beyond the rain bug fix above, there's a stated intent for more per-room
background ambiance variety (`main-floor` currently has rain; other rooms
have their own static `weather` in `HIDEOUT_SCENES`), and for ambiance to be
**toggleable** by the player (a settings switch, presumably similar in
spirit to existing toggles like `meta.wildlifeSheltersInRain` /
`meta.minimapVisible`). No specific new weather kinds or toggle UI were
specified -- flagged here so a future pass doesn't have to rediscover that
this was asked for, but the concrete design is still open.

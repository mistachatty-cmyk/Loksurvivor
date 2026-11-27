# Survivor 616: background options (PLAN, not built)

Owner direction, 2026-11-27: give 616 better background options, the way Queens N Kings offers different interactive backgrounds and experiences, without losing 616's vibe (Grand Rapids at night, neon, rain, street energy). Quality bar: nothing with a visible cut-off or a loop you can spot (the rain was rebuilt for exactly that in v0.43.5).

Rule before building: show the owner moving mockups of each option first, then build only the picked ones (his standing rule on visuals).

## Where they show

The title screen and the Hideout menu backdrop, picked in Settings > Look > Background. Runs keep their own district skies.

## Options (all procedural Canvas2D, no images, no network)

| Option | Mood | Idle motion | Tap or click reaction (always positive, never pays anything) |
| --- | --- | --- | --- |
| Monroe Rain (default, upgraded) | moody | full-height rain with depth, puddles, a passing bus glow | a ripple ring where you tap, drops scatter around the finger |
| Neon Night Drive | energetic | headlights and tail lights stream along two lanes, signs flicker on a beat | tap a car: it flashes its brights and the sign above buzzes |
| Rooftop Static | eerie | antenna blink, slow cloud cover, the city grid breathing below | tap: a wash of radio static, then the skyline lights a block at a time |
| Arcade After Hours | playful | cabinet screens glow and cycle attract modes | tap a cabinet: it lights up and plays a short chiptune sting |
| Lakeshore Fog (peaceful) | calm | fog rolls off the water, a lighthouse sweep | tap: a soft foghorn and the beam swings toward you |
| First Snow on Fulton (peaceful) | calm | slow snow, warm windows, steam from a grate | tap: a little snow puff and a window turns on |

## Engineering notes

- One small `BackgroundScene` record per option (draw, tap, colours), so adding one is a record, matching the data-driven rule.
- Respect power saving (fewer particles, 30 fps cap), reduced motion (still frame with a slow fade), and pause when hidden.
- Reuse the run renderer's weather pieces (rain, fog banks, clouds) rather than writing new ones.
- Taps also work with a controller (A on the focused backdrop) and keyboard.

## Next step

Moving mockups of all six on a phone screen, filed in `docs/art-library/`, for the owner to pick from.

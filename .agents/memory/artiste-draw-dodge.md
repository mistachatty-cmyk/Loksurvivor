# Artiste: freeform draw-to-dodge

## Why this is a dedicated subsystem

Artiste completes Stage 7 of the GRPD Station roadmap. The defining input is
an arbitrary polyline drawn across multiple pointer frames, so neither the
instantaneous `DashSkillDef` family nor the radial `UltimateDef.effect` bag
can represent it. It follows the proven Zero Day shape instead: an optional
`CharacterDef` config, dedicated `World` state, and one character-specific
`PointerMode` branch that is inert for everyone else.

## Runtime contract

- `CharacterDef.artisteDraw?: ArtisteDrawConfig` contains every balance and
  safety bound: maximum route length, maximum sampled points, point spacing,
  cooldown, damage, trail radius, and post-dodge invulnerability.
- `World.artisteDraw` is `null` for every other character. For Artiste it
  owns the armed/drawing flags, world-space points, accumulated length,
  cooldown timestamp, and the short completed-trail presentation timer.
- `armArtisteDraw` reserves the next pointer gesture. `beginArtisteDraw` and
  `updateArtisteDraw` record the route, truncating the last segment exactly
  at `maxPathLength` and refusing points past `maxPoints`.
- `commitArtisteDraw` resolves once on release: damage each crossed hostile
  at most once, move Artiste to the clamped/collision-resolved endpoint,
  grant the bounded invulnerability window, and start cooldown. Cancelled or
  shorter-than-minimum marks clear for free.
- The dodge is intentionally one crisp resolution, not simulated travel
  along every point. That keeps collision, contact damage, and very dense
  enemy scenes bounded while preserving the route's shape for hit testing.

## Input and presentation

- `RunScreen.tsx` adds `PointerMode: 'draw'`. It activates only after the
  Artiste-only Draw button arms the brush, and it owns that pointer until
  release/cancel; movement, prop clicks, double-tap dash, and other character
  modes never share the same gesture.
- Existing Pointer Events keep mouse and touch on one path. Sector Command's
  explicit command mode still takes priority, preserving its mobile grammar.
- While drawing, a screen-space SVG polyline supplies the live stroke. It is
  capped by the engine's accepted point count. After release, `draw.ts`
  renders the completed world-space route for 520 ms so the dodge remains
  readable while the camera follows Artiste to the endpoint.
- No supplied character sheet is used. Artiste has a procedural rig: an
  asymmetrical paint coat, bright beret, and oversized light-brush.

## Tests

`world.test.ts` covers the registered Artiste config, maximum-length clamp,
polyline damage, endpoint movement, invulnerability, cooldown start, and the
free cancel/too-short branches.

# Object damage and destruction effects

Object cracking and destruction are a standing major gameplay priority requested by the player. Keep the visual response readable, material-specific, and satisfying in a crowded fight.

## Implemented presentation contract

- `src/game/render/breakableFx.ts` owns the shared render-only damage vocabulary for map-pack props and ordinary breakables.
- Damage progresses through stable thresholds at 16%, 43%, and 72%; each stage keeps the earlier crack arms so damage accumulates rather than rerolling.
- Material is derived from the obstacle kind or authored map-prop ID: wood, glass, metal, stone, or organic. Hits originate at the recorded impact point. Breaking creates a short impact outline, deterministic debris, and a temporary rubble footprint.
- A broken silhouette fades over 190 ms, then the debris/rubble presentation expires by 760 ms. This only changes rendering; health, collision, chain reactions, and rewards stay in the simulation.
- `World.effectMotionEnabled` follows the operating system reduced-motion preference and the existing palette-animation setting. When off, hit pulses and fragment drift are suppressed while static damage and debris remain readable.
- Fragment count is capped per prop and reduced at `balanced` and `performance` graphics quality. Keep all procedural decoration deterministic from the obstacle identity; never use render randomness for crack placement.

## Acceptance checks

- Verify each of the five material families at all three damage stages and at the break transition.
- Confirm simultaneous repeated rendering of the same damaged prop produces identical cracks and debris placement.
- Inspect crowded combat at all graphics qualities and with reduced motion enabled. Preserve a readable damage state on small screens.
- Verify broken props cease drawing after the short aftermath and that their existing physics, chain rules, and one-time reward behavior are unchanged.

## Follow-up

The current procedural drawing uses a shared pixel-art vocabulary. Hand-authored silhouettes, richer directional debris, audio pairing, and automated crowded-scene visual review remain possible polish; do not expand the gameplay reward for destroying scenery without a separately balanced design.

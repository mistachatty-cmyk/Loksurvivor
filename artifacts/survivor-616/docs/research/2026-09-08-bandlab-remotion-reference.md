# September 8, 2026 BandLab, Remotion, and Visual FX Reference

**Status:** Non-binding research record  
**Purpose:** Preserve useful ideas and rejected assumptions from two user-provided Gemini conversations and current official product documentation.  
**Implementation authority:** None. This document is not a specification and does not require every idea below to be built.

## Sources reviewed

User-provided conversation exports:

- `Gemini - direct access to Google AI.pdf` - an 11-page conversation titled "Elevating Survivor 616 With Remotion" covering audio reactivity, Remotion, marketing assets, post-game recaps, and a proposed WebGL/Three.js pipeline.
- `Gemini - direct access to Google AI(1).pdf` - an 18-page conversation titled "Elevating 6x6 Survivor Visuals and Design" covering visual sameness, hybrid asset ideas, weapon motion, faction concepts, and the user's corrections to the proposed approach.

Repository and official references:

- [Loksurvivor repository](https://github.com/mistachatty-cmyk/Loksurvivor)
- [Remotion Player](https://www.remotion.dev/docs/player/)
- [Remotion browser renderer](https://www.remotion.dev/docs/web-renderer)
- [Remotion audio visualization](https://www.remotion.dev/docs/audio/visualization)
- [Remotion client-rendering limitations](https://www.remotion.dev/docs/client-side-rendering/limitations)
- [Remotion licensing and pricing](https://www.remotion.dev/docs/license/pricing)
- [BandLab Studio overview](https://help.bandlab.com/hc/en-us/articles/115002945153-Getting-Started-with-the-BandLab-Studio)
- [BandLab Studio feature index](https://help.bandlab.com/hc/en-us/sections/360003385054-Studio)
- [BandLab editing index](https://help.bandlab.com/hc/en-us/sections/57478572966937-Editing)
- [BandLab Drum Machine](https://help.bandlab.com/hc/en-us/articles/115002959894-Using-the-Drum-Machine)
- [BandLab Sampler](https://help.bandlab.com/hc/en-us/articles/4403006058009-Using-the-Sampler)
- [BandLab Automation](https://help.bandlab.com/hc/en-us/articles/360021039314-Using-Automation)
- [BandLab track and duration limits](https://help.bandlab.com/hc/en-us/articles/115002945433-Track-and-Project-Duration-Limits)

The Gemini conversations are useful ideation, not authoritative technical documentation. Claims about third-party capabilities should be checked against current official documentation before implementation.

## User direction preserved from the conversations

The following statements are the durable intent behind the research:

1. Survivor 616 should expand beyond its current visual and technical vocabulary.
2. The first update must not replace the entire existing game or force all old content through a new renderer.
3. The existing terminal, pixel, block, neon, mainframe, Grand Rapids, music, and rap-culture identity remains a foundation, not a permanent ceiling.
4. The basement and Studio may be deliberately different and may host much more experimental work.
5. New characters and new basement content should be the first place to test new visual languages, asset types, renderers, motion systems, and effects.
6. Successful experiments may later be added on top of or selectively applied to older content after review.
7. No single technique - procedural Canvas drawing, raster sprites, SVG, Three.js, shaders, Remotion, or pre-rendered assets - should become a mandatory answer for every problem.
8. The current style should not be discarded simply because a richer pipeline becomes available.
9. Weapons need different movement, timing, transformation, and impact behavior, not merely different colors or icons.
10. Planning and architectural review should happen before large implementation passes.

## What the first Gemini conversation proposed

The Remotion/audio-reactivity conversation proposed:

- Remotion-authored or Remotion-baked visual effects.
- Audio-reactive Three.js particles and post-processing.
- Programmatically generated marketing trailers.
- Passing run data into a Remotion composition.
- Post-game sports-style stat reels.
- Movement and kill heatmaps.
- Short downloadable recap videos.
- A telemetry event buffer.
- Bass, mid, and treble frequency bands driving visuals or mechanics.
- Three.js instancing, shader materials, bloom, and color grading.
- `@remotion/player` for an embedded recap.

### Corrections required before using those ideas

- The shipped game renderer is Canvas2D. Three.js is not the current runtime renderer.
- A Three.js or React Three Fiber migration is not a prerequisite for adding visual variety.
- `@remotion/player` previews a composition; browser video export requires `@remotion/web-renderer` or another rendering path.
- Raw audio amplitude should not directly and unpredictably control damage, collision size, or spawn rates.
- The repository already has one shared audio context, soundtrack analysis, a semantic beat bus, exact Studio timing, confidence handling, and bounded music reactions. A second audio system would be a regression.
- `@remotion/three` can be useful in an isolated composition or developer-side bake tool without shipping Three.js as the main game renderer.
- Client-side Remotion rendering depends on browser capabilities, has CSS/media limitations, and can be expensive in time, heat, and memory on mobile devices.

## What the second Gemini conversation proposed

The visual-FX conversation proposed:

- External raster, sprite-sheet, SVG, and textured particle support.
- A hybrid of existing block/pixel visuals and richer organic or rendered assets.
- Pre-rendering 3D characters or effects into lightweight 2D assets.
- Floor decals and persistent battle damage.
- Audio-waveform attacks, chromatic separation, and multi-pass effects.
- Separating weapon appearance from weapon movement.
- Stall-and-snap projectiles.
- Staggered clockwise or cardinal sweeps.
- Zigzags, sine waves, spirals, boomerangs, and delayed bursts.
- Velocity-based stretching, squashing, and rotation.
- Reusable motion and visual registries.
- Concept factions including Bubble Knots and Bucketeers.
- Concept attacks including 808 Sub-Drop, Turntable Scratch Arcs, Aux Cable Whip, Sample Chopper, and Tagging Laser.

### User corrections inside that conversation

The user explicitly rejected an immediate global visual replacement. The desired approach was to preserve the current foundation, add new capabilities, experiment through newer characters, and focus on actual behavioral variety. A slash that uses new artwork but still behaves exactly like every other slash does not solve the problem.

The faction, character, boss, and weapon names above are exploratory references. They are not automatically canon and must be checked against the existing roster before adoption to prevent thematic duplication.

## Adopt, modify, reject, or defer

| Proposal | Decision | Reason |
| --- | --- | --- |
| Remotion track visualizer | Adopt first | Directly strengthens the Studio-to-soundtrack loop. |
| Remotion run recap | Adopt after telemetry contract | High identity and sharing value without changing gameplay. |
| Compact highlight event log | Adopt | Supports recaps with bounded memory. |
| Aggregated movement/kill heatmap | Adopt | More efficient and private than recording every frame. |
| Remotion developer FX bake lab | Defer, then prototype | Promising path for unusual new-character assets without a runtime migration. |
| Runtime Three.js everywhere | Reject for the first expansion | Rewrites a stable Canvas2D renderer without a proven product need. |
| Isolated WebGL/Three.js basement scene | Allow as an experiment | The basement is an expansion zone and may use a separate renderer behind a clear boundary. |
| Global bloom and LUT migration | Defer | First test cheaper Canvas/CSS overlays or an isolated composite layer. |
| Raw frequency bands for lighting and particles | Adopt | Visual-only use is expressive and low risk. |
| Raw frequency bands for unbounded game mechanics | Reject | Creates unpredictable balance and collision behavior. |
| Authored beat/downbeat/section markers | Adopt | More reliable than re-detecting timing after Studio export. |
| Motion, visual, activation, and impact profiles | Adopt for new content first | Direct response to the sameness problem and compatible with the data-driven engine. |
| Mandatory profile migration for every old weapon | Reject | Violates the additive-first direction. |
| Hybrid raster/SVG/procedural assets | Allow selectively | Different content may need different production methods. |
| Replace supplied character art | Reject | Existing supplied art remains user-owned source material and follows repository display rules. |
| Gemini concept factions and names | Reference only | Require user approval and roster/theme review. |

## BandLab experience findings

The two Gemini exports contain little detailed BandLab product research. Their strongest contribution is the relationship between music creation, audio reactivity, and post-game presentation. The concrete Studio plan therefore relies primarily on current BandLab documentation and inspection of the existing Survivor 616 Studio.

BandLab's accessible creation feeling comes from:

- A fast add-track entry point.
- Audio, MIDI, instruments, drums, sampler, loops, and recording presented as clear starting modes.
- A persistent transport and timeline.
- Contextual editing rather than exposing every control simultaneously.
- Region trim, fade, normalize, slice, merge, duplicate, loop, and stretch operations.
- Piano-roll note and velocity editing.
- Effects presets and parameter editing.
- Automation lanes.
- Mobile workflows designed around one focused tool at a time.
- Saving and revision confidence.
- A clear finishing/mastering path.

Survivor 616 should pursue the workflow quality, not copy BandLab's branding, exact interface, proprietary sounds, AI tools, cloud model, or social network.

## Remotion opportunities ranked

1. Studio track visualizer and animated cover preview.
2. Local vertical, square, and landscape music promo exports.
3. Post-run animated statistics and highlight recap.
4. Character, achievement, area, and episode unlock reels.
5. Build-time official trailers generated from game data.
6. Gameplay-capture plus soundtrack composition.
7. Developer-side generation of sprite frames, atlases, and VFX studies.
8. Isolated experimental 3D compositions in the basement.

Remotion should not replace Framer Motion or CSS for ordinary UI interactions, and it should not run the core enemy/projectile simulation.

## Weapon and FX opportunity backlog

The most useful reusable motion families from the reference are:

- Stall, telegraph, and snap.
- Decelerate, hold, and split.
- Staggered cardinal sequence.
- Clockwise/counterclockwise sector sweep.
- Zigzag with authored turn cadence.
- Sine-wave travel.
- Expanding or contracting spiral.
- Boomerang return.
- Orbit, release, and reacquire.
- Delayed chain reaction.
- Ground-following segmented wave.
- Step-sequencer beams.
- Swarm steering with controlled randomness.

The most useful reusable visual traits are:

- Velocity stretch and braking squash.
- Rotation by velocity, age, beat phase, or authored rate.
- Multi-part silhouettes.
- Trail modes with capped sample counts.
- Chromatic offset as an optional secondary pass.
- Pixel, vector, raster, or pre-rendered sprite renderers behind one visual reference.
- Distinct telegraph, travel, impact, and residue phases.

These are candidates, not requirements. Each new weapon should use the smallest combination needed to create a distinct readable identity.

## Cost, storage, rights, and licensing notes

- Continue device-local audio/project storage first.
- Streaming embeds remain reference playback and are never extracted into Studio.
- Public music submissions require authentication, storage quotas, rights attestations, moderation, reporting, takedown handling, and recurring cost.
- User-facing video rendering should begin locally and on demand.
- Do not retain duplicate audio/video blobs when a content-addressed asset reference can be reused.
- Check `navigator.storage.estimate()` and handle quota failure explicitly.
- Remotion's current license is free for individuals and organizations of up to three people. Re-check licensing before the organization grows or the rendering product changes materially.
- Do not ship third-party samples without verified redistribution rights and provenance.

## Interpretation rule for future collaborators

When this reference conflicts with `studio-remotion-architecture.md`, repository memory, merged code, or a later user decision, the later approved source wins. Do not copy Gemini prompt blocks into implementation instructions without reconciling them with the actual repository first.


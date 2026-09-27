# Survivor 616 Additive Studio, Remotion, and Basement Expansion Architecture

**Status:** Approved direction; implementation is phased and not implied by this document  
**Decision date:** September 8, 2026  
**Related issue:** #66  
**Research record:** `research/2026-09-08-bandlab-remotion-reference.md`

## Governing product principle

Survivor 616 will expand beyond its current visual style and technology, but the first expansion will not rewrite the entire existing game.

The existing game is a protected baseline, not a permanent ceiling. New approaches should be added beside it, tested in the basement and Studio, and allowed to graduate into more of the game when they prove that they improve identity, usability, performance, and readability.

Survivor 616 must not become locked to any one technique. Canvas2D, procedural drawing, raster art, SVG, WebGL, Three.js, shaders, Remotion, pre-rendered frames, and CSS/React animation are tools. The content and experience decide which tool is appropriate.

## Three-zone expansion model

### 1. Protected baseline

The current game, existing roster, existing weapons, areas, progression, and Canvas2D renderer continue to work without mandatory conversion.

Rules for the first expansion:

- Do not mass-migrate existing weapons to a new profile system.
- Do not replace the global renderer merely to support one new visual idea.
- Do not change old content as a side effect of adding a basement experiment.
- Preserve existing save data and progression.
- New optional fields must have safe legacy defaults.
- A player who never enters the basement still receives a complete working game.

Protected does not mean frozen. Older content can later receive deliberate additions or upgrades through focused, reviewed changes.

### 2. Basement and Studio expansion zone

The basement is allowed to look, sound, and behave differently. It is the first home for:

- The BandLab-inspired Studio.
- Remotion previews and media creation.
- New UI composition and interaction patterns.
- Hybrid procedural, raster, SVG, and pre-rendered artwork.
- Experimental motion, impact, and particle systems.
- Isolated WebGL/Three.js scenes or layers when they provide a clear benefit.
- New-character and new-weapon pilots.
- Developer-facing FX authoring and bake tools.

The basement should feel connected to the hacked Grand Rapids/music-mainframe fiction, but visual consistency must not be used as an excuse to prevent meaningful experimentation.

### 3. Graduation path

An experiment may move into the broader game only after passing explicit gates:

1. It has a distinct player-facing purpose.
2. It does not break existing save data or content.
3. It maintains threat, pickup, player, and UI readability under dense combat.
4. It meets mobile performance and memory budgets.
5. It respects reduced-motion and flashing-safety settings.
6. It has a fallback or graceful failure mode where browser capabilities are missing.
7. It can be removed or disabled without rewriting the core game.
8. It has focused tests for its data and simulation behavior.
9. It has been manually playtested in an actual late-run scenario.
10. The user has approved any broad visual or behavioral migration.

## Product loop

The primary new loop is:

1. Create or record music in the basement Studio.
2. Save the project and its owned assets locally.
3. Finish and publish a mix to the player's local soundtrack.
4. Choose whether the track is non-reactive, visually reactive, or gameplay-affecting.
5. Assign it to The Perch, a character, an area, a boss, victory, or Endless mode.
6. Play a run with that music.
7. Generate a Remotion recap or music visualizer from the run and track.
8. Return to the Studio to revise, remix, or create again.

This creation-to-play-to-presentation loop is the major Survivor 616 differentiation from a general browser DAW.

## Soundtrack roles

Every published local track declares one role:

| Role | Playback | Visual reactions | Gameplay reactions |
| --- | --- | --- | --- |
| `listen-only` | Yes | No | No |
| `reactive-score` | Yes | Yes | No |
| `challenge-score` | Yes | Yes | Bounded and explicit |

Rules:

- `reactive-score` is the recommended default for Studio-published work.
- Raw frequency values may drive visual presentation but not collision geometry.
- `challenge-score` effects are defined through bounded semantic reactions.
- A future competitive mode must normalize or exclude custom gameplay-affecting tracks unless its rules explicitly support them.
- Official streaming embeds remain a separate reference shelf and never become extractable or game-reactive audio.
- Public sharing is not implied by local publishing.

## One audio path

The current single-audio-context and beat-bus contracts remain in force:

- The music player is the playback path used during gameplay.
- The Studio transport does not continue invisibly into a run.
- The Studio may publish exact timing while the player is actively editing.
- A finished track carries an authored timing manifest into the soundtrack.
- The music player uses that manifest rather than unnecessarily re-detecting known tempo and downbeat information.
- Remotion preview audio, Studio transport, streaming embeds, and game soundtrack must observe a single audio-focus owner so two sources do not play accidentally.

### Timing manifest

```ts
interface TrackTimingManifest {
  bpm: number;
  beatsPerBar: number;
  downbeatSec: number;
  durationSec: number;
  sections?: Array<{
    id: string;
    label: string;
    startBeat: number;
    endBeat: number;
    intensity?: number;
  }>;
  confidence: 'authored' | 'confirmed' | 'estimated';
}
```

Authored timing is metadata consumed by the soundtrack player. It does not create a second gameplay music system.

## Local media architecture

Use one content-addressed IndexedDB media store shared by the Studio, soundtrack, and local render features.

### Core records

```ts
interface MediaAssetRecord {
  id: string;
  contentHash: string;
  kind: 'audio' | 'image' | 'video';
  mimeType: string;
  byteLength: number;
  blob: Blob;
  createdAt: number;
}

interface PublishedTrackRecord {
  id: string;
  assetId: string;
  title: string;
  creatorLabel?: string;
  artworkAssetId?: string;
  role: 'listen-only' | 'reactive-score' | 'challenge-score';
  timing?: TrackTimingManifest;
  assignments: string[];
  rightsConfirmedAt: number;
  createdAt: number;
}
```

The final implementation may adjust field names and schema boundaries, but it must preserve the responsibilities:

- Audio/image/video bytes are stored once.
- Projects and published tracks reference assets.
- Deleting a reference does not delete a shared asset until no records use it.
- Quota errors are recoverable and visible.
- The player can export a portable backup.
- Device-local storage is clearly identified as local storage, not cloud backup.

## BandLab-inspired Studio direction

Survivor 616 should pursue BandLab's clarity and immediacy without cloning its visual design, proprietary content, subscription model, AI features, cloud architecture, or social network.

### Desktop shell

- Persistent transport and project status at the top.
- Compact track headers and mixer controls on the left.
- Arrangement timeline as the central workspace.
- Sounds, imports, instruments, effects, and presets browser on the right.
- Contextual waveform, piano-roll, sampler, drum-machine, automation, or mastering editor below.

### Mobile shell

- One primary workspace at a time.
- Persistent compact transport.
- Large bottom destinations for tracks, arrange, instrument, mixer, and finish.
- Contextual controls in a bottom sheet.
- Touch targets and gestures designed for mobile rather than a squeezed desktop layout.

### Capability order

1. Reliable projects, asset persistence, autosave, migration, backup, and quota handling.
2. Undo/redo and a trustworthy non-destructive editing model.
3. Timeline ruler, waveform peaks, zoom, snap, loop range, playhead, and scrolling.
4. Trim, split, duplicate, loop, fade, clip gain, and later timestretch.
5. MIDI selection, velocity, transpose, quantize, and supported controller input.
6. Pattern drum machine with swing and velocity.
7. Sampler with trim, pitch, envelopes, choke groups, and saved kits.
8. Recording meter, count-in, monitoring, latency guidance, and multitrack recording.
9. EQ, compression, limiting, sends, and automation.
10. Finish, master, publish, assign, and create visualizer.

Core creative tools should not be locked behind game progression. Progression may unlock 616 sound palettes, kits, presets, visualizer themes, room decorations, soundtrack slots, and creative challenges.

## Remotion architecture

### Runtime responsibilities

Remotion is approved for:

- Studio visualizer previews.
- Animated cover art.
- Local vertical, square, and landscape exports.
- Post-run recaps.
- Achievement, character, area, boss, and episode presentation pieces.
- Build-time official marketing assets.
- Developer-side visual studies and baked asset generation.

Remotion is not the core game simulation, a replacement for all UI animation, or a requirement for every effect.

### First composition

The first composition is a Studio Track Visualizer:

- Accepts a local published track, timing manifest, artwork, palette, and theme as props.
- Offers 9:16, 1:1, and 16:9 layouts.
- Uses `@remotion/player` for in-app preview.
- Uses `@remotion/web-renderer` for capability-checked, on-demand local export.
- Defaults to 720p for the first mobile-safe implementation.
- Does not upload the track or rendered video.
- Is lazy-loaded so the core game bundle does not pay for an unopened editor.
- Pauses other audio owners before preview or render.

### Client-rendering constraints

- Feature-detect WebCodecs and codec support.
- Expose progress and cancellation.
- Render one job at a time.
- Keep the page in a responsive mode by default.
- Warn about heat, battery, memory, and foreground-tab performance on mobile.
- Use only supported composition styles and media elements.
- Fall back to preview-only or audio/project download when video export is unsupported.
- Re-check Remotion licensing before organization size or product use changes.

### Post-run presentation record

Do not record the entire simulation or player path frame-by-frame.

```ts
interface RunPresentationRecord {
  version: number;
  runId: string;
  characterId: string;
  areaId: string;
  paletteId: string;
  soundtrackTrackId?: string;
  summary: Record<string, number | string | boolean>;
  highlights: Array<{
    type: string;
    atMs: number;
    x?: number;
    y?: number;
    value?: number;
  }>;
  movementHeatmap: number[];
  defeatOrVictoryAtMs: number;
}
```

The implementation should cap highlight count and use a small aggregate heatmap grid. The Remotion Player shows an immediate recap; a video file is rendered only at the player's request.

## Weapon and FX expansion architecture

The first goal is behavioral diversity, not global asset replacement.

### Separated profiles

```ts
interface WeaponPresentationRefs {
  activationProfileId?: string;
  motionProfileId?: string;
  visualProfileId?: string;
  impactProfileId?: string;
}
```

- Activation controls when and in what order an attack's parts begin.
- Motion controls position, velocity, turning, pauses, anchors, and stage transitions.
- Visual controls shape, renderer, stretch, rotation, trail, palette, and secondary passes.
- Impact controls damage-event presentation, split, chain, residue, force, and cleanup.

Collision and damage remain authoritative simulation data. Visual scale, glow, trails, and distortion must not silently change hitboxes.

### First pilot profiles

Use new characters or dedicated basement trials for the first three pilots:

1. **Stall and Snap** - decelerate, hold with a readable telegraph, then accelerate or burst.
2. **Staggered Sweep** - activate sectors or directions sequentially rather than simultaneously.
3. **Path and Form** - zigzag, sine, spiral, or boomerang travel paired with velocity stretch and independent rotation.

Existing weapons keep their current behavior. A later focused pass may opt individual older weapons into proven profiles.

### Hybrid rendering allowance

A visual profile may use:

- Existing Canvas primitives.
- New procedural Canvas routines.
- Raster or sprite-sheet assets.
- SVG or pre-rasterized vector assets.
- Pre-rendered 3D frames.
- An isolated WebGL layer when its performance and fallback are justified.

The profile chooses the renderer. The project does not declare one renderer universally superior.

## Basement WebGL/Three.js experimentation

Three.js is allowed in the basement when a specific experiment benefits from depth, lighting, particles, material response, or 3D composition.

Boundaries for the first experiment:

- Load it only when the experiment is opened.
- Keep it outside the core Canvas2D simulation loop.
- Share plain data contracts, not renderer-owned game state.
- Pause or reduce work when hidden.
- Provide a non-WebGL fallback or a clear unsupported state.
- Measure bundle, memory, frame-time, and device behavior.
- Do not require existing characters, weapons, or maps to migrate.

If a WebGL technique later belongs in gameplay, graduate the smallest useful layer instead of replacing the whole renderer by default.

## Developer FX bake lab

A future developer-only tool may use Remotion, `@remotion/three`, or other rendering tools to:

- Preview deterministic VFX at multiple speeds and palettes.
- Render transparent frame sequences.
- Pack atlases and emit frame metadata.
- Produce directional or staged animation sets.
- Compare visual variants without adding every authoring dependency to the game bundle.

Generated assets must retain source/provenance metadata, output dimensions, frame rate, palette, and the tool/version used. The bake lab is an option, not a required pipeline.

## Performance and accessibility budgets

Every expansion must define budgets before implementation:

- Maximum active particles and trails.
- Maximum retained trail samples per entity.
- Maximum simultaneous audio nodes and voices.
- Maximum decoded/imported local media held in memory.
- Maximum recap event count and heatmap resolution.
- Maximum concurrent Remotion renders: one.
- Lazy-load boundaries for Studio, Remotion, and WebGL experiments.
- Reduced-motion behavior.
- Flash-frequency and full-screen brightness safeguards.
- A late-run mobile test scenario, not only an empty-room preview.

## Delivery sequence

### Phase 0 - Integrate the soundtrack baseline

- Review and merge #61, #63, and #65 in order.
- Test iPhone imports and local persistence.
- Reconcile session-only copy with persisted tracks.
- Preserve the reference-shelf/game-mix separation.

### Phase 1 - Reliable Studio foundation

- Shared IndexedDB asset store.
- Multiple-project browser.
- Autosave, migrations, backup, import queue, and quota recovery.
- Undo/redo and waveform peak cache.
- Desktop/mobile shell refactor without changing audio behavior.

### Phase 2 - Publish to the game

- Finish checks and optional local mastering.
- Track metadata, artwork, rights confirmation, and soundtrack role.
- Timing manifest.
- Assignment to rooms, characters, areas, bosses, victory, and Endless mode.
- Immediate audition in The Perch or a safe test encounter.

### Phase 3 - First Remotion feature

- Track Visualizer Player preview.
- Local capability-checked 720p export.
- Three aspect ratios.
- No cloud render or upload.

### Phase 4 - BandLab-quality editing

- Region editing, better MIDI, drum machine, sampler, recording workflow, mixer, sends, and automation.

### Phase 5 - New-character FX pilots

- Add optional profile references.
- Implement the three pilot behavior families.
- Use new basement content first.
- Playtest readability and late-run performance.

### Phase 6 - Run recap

- Add the bounded presentation record.
- Build the Remotion recap.
- Add user-triggered local highlight export.

### Phase 7 - Broader expansion

- Selectively graduate proven FX and rendering methods.
- Add unlock and episode reels.
- Prototype the developer FX bake lab.
- Consider an isolated Three.js basement experience.

### Phase 8 - Optional online services

Only after explicit storage, moderation, rights, deletion, privacy, and cost policies:

- Cloud backup.
- Project collaboration.
- Public Survivor Radio submissions.
- Server rendering.

## Explicitly deferred

- Rewriting the entire game in Three.js.
- Converting every existing weapon to the new profile system.
- A public music feed or social network.
- Unmetered cloud audio/video storage.
- Server-side Remotion rendering.
- AI mastering, stem separation, voice conversion, or commercial sample catalogs.
- Canonizing concept characters, factions, bosses, or weapons from the research PDF without a separate content decision.

## Collaboration handoff

Each implementation slice requires its own issue and focused branch. A handoff must state:

- Which zone it changes: protected baseline, basement expansion, or graduation.
- Which data, audio, renderer, and storage contracts it touches.
- What remains unchanged.
- Performance and accessibility checks completed.
- How to disable or roll back the experiment.
- Whether the feature is local-only, exportable, or public.

This document authorizes exploration within its boundaries. It does not authorize unrelated mass refactors or make every listed feature mandatory.

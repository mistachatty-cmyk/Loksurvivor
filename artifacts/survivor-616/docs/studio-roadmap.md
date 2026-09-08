# Survivor 616 Studio Roadmap

## Purpose

Build a focused, BandLab-inspired creation studio inside Survivor 616: make, arrange, record, mix, and export music that can become part of a player's local game soundtrack. This is a creative tool, not a social network.

## Product boundary

- **In scope:** local projects, multitrack audio and MIDI, instruments, loops supplied with clear rights, recording, mixer/effects, automation, export, and sending a finished render to the local game mix.
- **Out of scope:** feed, follows, comments, public profiles, discovery, messaging, social collaboration, or server-side distribution.
- **Storage policy:** start device-local with IndexedDB. Add account/cloud sync only after a cheap, explicit storage policy exists.
- **Rights policy:** users import music they own or have permission to use. Streaming-service audio is never extracted into Studio.

## What already exists

The repository already has a local Studio surface, a shared Web Audio context, local audio import, instruments/effects, rendering, and a **To Soundtrack** handoff. The next work should strengthen these pieces rather than replace them.

## Delivery sequence

### 1. Reliable local projects

- Store project metadata, clips, and user-imported source files in IndexedDB.
- Add project browser: create, duplicate, rename, delete, last-opened, and storage usage.
- Use versioned project schemas and safe migrations before adding more instruments.
- Show an explicit local-only indicator and a recoverable storage-full state.

### 2. Proper arrange view

- Time ruler, zoom, snap/grid, loop region, playhead, and horizontal scrolling.
- Audio and MIDI clip trim, split, duplicate, drag, fade handles, and clip gain.
- Undo/redo that covers every editing action.
- Keyboard shortcuts on desktop with equally capable touch controls on mobile.

### 3. Performance and recording

- Permission-first microphone recording with input meter, count-in, monitoring, and latency guidance.
- MIDI device input where the browser supports Web MIDI; retain touch/piano-roll entry as the universal fallback.
- Quantization, tempo/time-signature controls, metronome, and reusable loop clips.

### 4. Mixer and sound design

- Track color/name/icon, mute, solo, arm, volume, pan, and sends.
- Per-track effect rack using the existing audio engine: EQ, compressor, delay, reverb, filter, distortion, and limiter.
- Automation lanes for volume, pan, and safe effect parameters.
- Prevent a second AudioContext; Studio and Survivor playback retain the current single-context rule.

### 5. Finish and hand off

- Offline bounce to WAV first, then MP3 where browser conversion succeeds.
- Export stems and project backup bundle.
- Send a finished render to **Local game mix**, with title/artwork/metadata confirmation.
- Keep streaming embeds view-only: they can inspire a session but never become extractable Studio clips.

## Quality gates

- Every project action survives refresh and handles storage quota errors without data loss.
- No project requires a network connection to open, edit, or export.
- Mobile flow works with Safari's audio-permission and background-playback constraints.
- Playback never runs the game-reactive local mix and an external streaming embed as an assumed synchronized source.
- Large file operations reveal progress and offer cancellation where the browser permits it.

## Deferred decisions

- Cloud backup/authentication: choose only after defining a free-tier storage cap, deletion policy, and user-facing export/backup route.
- Real-time collaboration: explicitly out of scope until the local studio is stable.
- Commercial sample catalog/API integrations: only after licensing, attribution, and cost are resolved.

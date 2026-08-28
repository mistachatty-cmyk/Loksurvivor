/**
 * Tests for the studio's pure-data layer.
 *
 * Everything here runs in node with no browser: that is exactly why the project
 * model carries no Tone types and the WAV encoder takes a plain buffer shape.
 * The parts that genuinely need Web Audio (the transport, playback) are covered
 * by the headless browser pass instead.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeWav } from './exporter';
import { estimateBufferBpm, clipLengthInBeats } from './importer';
import {
  addClip,
  addNote,
  addTrack,
  clampBpm,
  createProject,
  moveClip,
  moveNote,
  parseProject,
  projectLengthBeats,
  removeClip,
  removeNote,
  removeTrack,
  serializeProject,
  setTrackInstrument,
  toggleSolo,
  trackAudible,
  updateTrack,
} from './project';

/* --- project model ---------------------------------------------------- */

test('a project round-trips through serialisation unchanged', () => {
  const project = addClip(createProject('Test Song'), createProject().tracks[0]!.id, {
    bufferId: 'buffer-1',
    name: 'Drums',
    startBeat: 4,
    lengthBeats: 8,
  });
  const restored = parseProject(JSON.parse(serializeProject(project)) as unknown);
  assert.equal(restored.name, project.name);
  assert.equal(restored.bpm, project.bpm);
  assert.deepEqual(restored.tracks, project.tracks);
});

test('parsing repairs a corrupt project instead of throwing', () => {
  // Losing a session to one bad field is worse than silently repairing it.
  const repaired = parseProject({
    name: 42,
    bpm: 'fast',
    tracks: [{ name: 'Keys', gain: 99, pan: -8, clips: [{ startBeat: -5 }] }],
  });
  assert.equal(repaired.name, 'Untitled');
  assert.equal(repaired.bpm, 120);
  // An out-of-range number is clamped rather than reset: `gain: 99` plainly
  // means "loud", and honouring that reads better than discarding it.
  assert.equal(repaired.tracks[0]!.gain, 1);
  assert.equal(repaired.tracks[0]!.pan, -1);
  assert.equal(repaired.tracks[0]!.name, 'Keys', 'a readable field survives its neighbours being junk');
  assert.equal(repaired.tracks[0]!.clips.length, 0, 'a clip with no bufferId is dropped');
});

test('parsing junk yields a usable default project', () => {
  for (const junk of [null, undefined, 'nonsense', 7, []]) {
    const project = parseProject(junk);
    assert.ok(project.tracks.length > 0, `${JSON.stringify(junk)} still gives a usable project`);
  }
});

test('bpm is clamped into the musical range', () => {
  assert.equal(clampBpm(0), 40);
  assert.equal(clampBpm(9000), 240);
  assert.equal(clampBpm(Number.NaN), 120);
  assert.equal(clampBpm(128), 128);
});

test('solo silences every track that is not soloed', () => {
  let project = createProject();
  const [first, second] = project.tracks;
  assert.ok(trackAudible(project, first!), 'with nothing soloed everything is heard');

  project = toggleSolo(project, second!.id);
  assert.equal(trackAudible(project, project.tracks[0]!), false);
  assert.equal(trackAudible(project, project.tracks[1]!), true);
});

test('soloing one track clears the solo on another', () => {
  let project = toggleSolo(createProject(), createProject().tracks[0]!.id);
  project = toggleSolo(project, project.tracks[1]!.id);
  assert.deepEqual(
    project.tracks.map((track) => track.soloed),
    [false, true],
  );
});

test('a muted track stays silent even while soloed', () => {
  let project = createProject();
  const id = project.tracks[0]!.id;
  project = updateTrack(project, id, { muted: true });
  project = toggleSolo(project, id);
  assert.equal(trackAudible(project, project.tracks[0]!), false);
});

test('edits never mutate the project they are given', () => {
  const project = createProject();
  const before = serializeProject(project);
  addTrack(project);
  addClip(project, project.tracks[0]!.id, { bufferId: 'b', name: 'x', startBeat: 0, lengthBeats: 4 });
  updateTrack(project, project.tracks[0]!.id, { gain: 0.1 });
  assert.equal(serializeProject(project), before);
});

test('a clip moved before the start of the song is clamped to zero', () => {
  let project = createProject();
  const trackId = project.tracks[0]!.id;
  project = addClip(project, trackId, { bufferId: 'b', name: 'x', startBeat: 8, lengthBeats: 4 });
  const clipId = project.tracks[0]!.clips[0]!.id;

  // A negative start would schedule at a negative transport time, which never
  // fires -- the clip would simply vanish.
  project = moveClip(project, clipId, -12);
  assert.equal(project.tracks[0]!.clips[0]!.startBeat, 0);
});

test('a clip can be moved to another track', () => {
  let project = createProject();
  const [from, to] = project.tracks;
  project = addClip(project, from!.id, { bufferId: 'b', name: 'x', startBeat: 0, lengthBeats: 4 });
  const clipId = project.tracks[0]!.clips[0]!.id;

  project = moveClip(project, clipId, 16, to!.id);
  assert.equal(project.tracks[0]!.clips.length, 0);
  assert.equal(project.tracks[1]!.clips.length, 1);
  assert.equal(project.tracks[1]!.clips[0]!.startBeat, 16);
});

test('removing the last track is refused', () => {
  let project = createProject();
  project = removeTrack(project, project.tracks[0]!.id);
  project = removeTrack(project, project.tracks[0]!.id);
  assert.equal(project.tracks.length, 1, 'a project with no tracks has no usable UI');
});

test('project length rounds up to a whole bar and is never zero', () => {
  const empty = createProject();
  assert.equal(projectLengthBeats(empty), 4, 'an empty project still has one bar of grid');

  const withClip = addClip(empty, empty.tracks[0]!.id, {
    bufferId: 'b',
    name: 'x',
    startBeat: 0,
    lengthBeats: 5,
  });
  assert.equal(projectLengthBeats(withClip), 8, '5 beats rounds up to two bars');
});

test('removing a clip finds it on whichever track holds it', () => {
  let project = createProject();
  project = addClip(project, project.tracks[1]!.id, {
    bufferId: 'b',
    name: 'x',
    startBeat: 0,
    lengthBeats: 4,
  });
  const clipId = project.tracks[1]!.clips[0]!.id;
  project = removeClip(project, clipId);
  assert.equal(project.tracks[1]!.clips.length, 0);
});

/* --- instrument tracks -------------------------------------------------- */

test('a track becomes an instrument track and back again', () => {
  let project = createProject();
  const id = project.tracks[0]!.id;
  assert.equal(project.tracks[0]!.instrumentId, undefined);

  project = setTrackInstrument(project, id, 'neon-keys');
  assert.equal(project.tracks[0]!.instrumentId, 'neon-keys');

  project = setTrackInstrument(project, id, undefined);
  assert.equal(project.tracks[0]!.instrumentId, undefined);
});

test('an instrument track round-trips with its notes', () => {
  let project = setTrackInstrument(createProject('Beat'), createProject().tracks[0]!.id, 'block-kit');
  project = addNote(project, project.tracks[0]!.id, {
    pitch: 60,
    startBeat: 2,
    lengthBeats: 0.5,
    velocity: 0.7,
  });
  const restored = parseProject(JSON.parse(serializeProject(project)) as unknown);
  assert.deepEqual(restored.tracks, project.tracks);
});

test('notes snap to the grid and cannot start before zero', () => {
  let project = setTrackInstrument(createProject(), createProject().tracks[0]!.id, 'neon-keys');
  const trackId = project.tracks[0]!.id;
  project = addNote(project, trackId, { pitch: 60, startBeat: 0, lengthBeats: 1, velocity: 0.8 });
  const noteId = project.tracks[0]!.notes[0]!.id;

  project = moveNote(project, trackId, noteId, 64, 1.31);
  const moved = project.tracks[0]!.notes[0]!;
  assert.equal(moved.pitch, 64);
  assert.equal(moved.startBeat, 1.25, 'snapped to the nearest sixteenth');

  project = moveNote(project, trackId, noteId, 64, -5);
  assert.equal(project.tracks[0]!.notes[0]!.startBeat, 0);
});

test('a note is clamped to the MIDI range rather than wrapping', () => {
  let project = setTrackInstrument(createProject(), createProject().tracks[0]!.id, 'neon-keys');
  const trackId = project.tracks[0]!.id;
  project = addNote(project, trackId, { pitch: 60, startBeat: 0, lengthBeats: 1, velocity: 0.8 });
  const noteId = project.tracks[0]!.notes[0]!.id;
  project = moveNote(project, trackId, noteId, 999, 0);
  assert.equal(project.tracks[0]!.notes[0]!.pitch, 127);
});

test('a corrupt note is dropped without taking the track with it', () => {
  const repaired = parseProject({
    tracks: [
      {
        name: 'Keys',
        instrumentId: 'neon-keys',
        notes: [{ pitch: 'high' }, { pitch: 62, startBeat: 1, lengthBeats: 1, velocity: 0.5 }],
      },
    ],
  });
  assert.equal(repaired.tracks[0]!.notes.length, 1);
  assert.equal(repaired.tracks[0]!.notes[0]!.pitch, 62);
});

test('project length accounts for notes as well as clips', () => {
  let project = setTrackInstrument(createProject(), createProject().tracks[0]!.id, 'neon-keys');
  project = addNote(project, project.tracks[0]!.id, {
    pitch: 60,
    startBeat: 9,
    lengthBeats: 1,
    velocity: 0.8,
  });
  // A note ending at beat 10 must not be cut off by a grid that stops at 8.
  assert.equal(projectLengthBeats(project), 12);
});

test('removing a note leaves the others alone', () => {
  let project = setTrackInstrument(createProject(), createProject().tracks[0]!.id, 'neon-keys');
  const trackId = project.tracks[0]!.id;
  for (const pitch of [60, 62, 64]) {
    project = addNote(project, trackId, { pitch, startBeat: 0, lengthBeats: 1, velocity: 0.8 });
  }
  const target = project.tracks[0]!.notes[1]!.id;
  project = removeNote(project, trackId, target);
  assert.deepEqual(
    project.tracks[0]!.notes.map((note) => note.pitch),
    [60, 64],
  );
});

/* --- WAV encoding ------------------------------------------------------ */

/** Minimal stand-in for the parts of `AudioBuffer` the encoder reads. */
function fakeBuffer(channels: Float32Array[], sampleRate = 44_100): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]!.length,
    sampleRate,
    duration: channels[0]!.length / sampleRate,
    getChannelData: (index: number) => channels[index]!,
  } as unknown as AudioBuffer;
}

function ascii(view: DataView, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i));
  return text;
}

test('the WAV encoder writes a valid 16-bit PCM header', () => {
  const frames = 100;
  const encoded = encodeWav(fakeBuffer([new Float32Array(frames), new Float32Array(frames)]));
  const view = new DataView(encoded);
  const dataSize = frames * 2 * 2; // frames * channels * bytes per sample

  assert.equal(ascii(view, 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), 36 + dataSize);
  assert.equal(ascii(view, 8, 4), 'WAVE');
  assert.equal(ascii(view, 12, 4), 'fmt ');
  assert.equal(view.getUint32(16, true), 16, 'PCM header length');
  assert.equal(view.getUint16(20, true), 1, 'uncompressed PCM');
  assert.equal(view.getUint16(22, true), 2, 'channel count');
  assert.equal(view.getUint32(24, true), 44_100);
  assert.equal(view.getUint32(28, true), 44_100 * 4, 'byte rate');
  assert.equal(view.getUint16(32, true), 4, 'block align');
  assert.equal(view.getUint16(34, true), 16, 'bit depth');
  assert.equal(ascii(view, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), dataSize);
  assert.equal(encoded.byteLength, 44 + dataSize);
});

test('the WAV encoder interleaves channels and clamps full scale', () => {
  const left = Float32Array.from([1, -1, 0]);
  const right = Float32Array.from([-1, 1, 0]);
  const view = new DataView(encodeWav(fakeBuffer([left, right])));

  // Frame 0: left then right.
  assert.equal(view.getInt16(44, true), 32_767);
  assert.equal(view.getInt16(46, true), -32_768);
  // Frame 1 swaps them.
  assert.equal(view.getInt16(48, true), -32_768);
  assert.equal(view.getInt16(50, true), 32_767);
});

test('the WAV encoder does not wrap on out-of-range samples', () => {
  // Rendering can overshoot 1.0 when tracks sum; wrapping would turn a loud
  // peak into a full-scale click in the opposite direction.
  const view = new DataView(encodeWav(fakeBuffer([Float32Array.from([4, -4])])));
  assert.equal(view.getInt16(44, true), 32_767);
  assert.equal(view.getInt16(46, true), -32_768);
});

/* --- tempo estimation --------------------------------------------------- */

/** A click track: one short burst every `bpm` beats, silence between. */
function clickTrack(bpm: number, seconds: number, sampleRate = 22_050): AudioBuffer {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  const period = Math.round((60 / bpm) * sampleRate);
  const clickLength = Math.round(sampleRate * 0.01);
  for (let start = 0; start < samples.length; start += period) {
    for (let i = 0; i < clickLength && start + i < samples.length; i += 1) {
      // Decaying burst -- a rising edge is what the estimator keys on.
      samples[start + i] = (1 - i / clickLength) * Math.sin(i * 0.7);
    }
  }
  return fakeBuffer([samples], sampleRate);
}

test('tempo estimation recovers the bpm of a click track', () => {
  for (const bpm of [90, 120, 140]) {
    const { bpm: estimated, confidence } = estimateBufferBpm(clickTrack(bpm, 20));
    assert.ok(
      Math.abs(estimated - bpm) <= 2,
      `estimated ${estimated} for a ${bpm}bpm click track`,
    );
    assert.ok(confidence > 0, 'a clean click track is not a guess');
  }
});

test('tempo estimation reports no confidence rather than a wrong number', () => {
  // Silence has no periodicity at all; claiming a tempo here would make the
  // game react to a grid that does not exist.
  const { bpm, confidence } = estimateBufferBpm(fakeBuffer([new Float32Array(22_050 * 10)], 22_050));
  assert.equal(bpm, 120, 'falls back to a neutral default');
  assert.equal(confidence, 0);
});

test('tempo estimation handles a buffer too short to analyse', () => {
  const { confidence } = estimateBufferBpm(fakeBuffer([new Float32Array(500)], 22_050));
  assert.equal(confidence, 0);
});

test('a loop close to a whole bar snaps to that bar', () => {
  // Two bars at 120bpm is exactly 4 seconds; a real export is a few ms off.
  const almostTwoBars = fakeBuffer([new Float32Array(Math.round(44_100 * 3.97))]);
  assert.equal(clipLengthInBeats(almostTwoBars, 120), 8);
});

test('a clip that is not near a bar keeps its own length', () => {
  const oddLength = fakeBuffer([new Float32Array(Math.round(44_100 * 2.5))]);
  assert.equal(clipLengthInBeats(oddLength, 120), 5);
});

/**
 * The one bridge between the studio engine and React.
 *
 * Engine state lives in the engine. React holds only what is actually rendered,
 * and the playhead -- which moves every frame -- is deliberately *not* React
 * state: it is exposed as a ref the timeline canvas reads in its own animation
 * loop. Re-rendering a component tree sixty times a second to move a one-pixel
 * line is how studio UIs end up dropping audio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { findEffect } from '@/game/audio/studio/effects';
import { getStudioEngine } from '@/game/audio/studio/engine';
import type { TrackGraph } from '@/game/audio/studio/tracks';
import {
  startStudioClock,
  stopStudioClock,
  tickStudioClock,
} from '@/game/audio/studio/clock';
import {
  clipLengthInBeats,
  importAudioFile,
  ImportError,
  releaseBuffer,
  type ImportedBuffer,
} from '@/game/audio/studio/importer';
import {
  addClip,
  addEffect,
  addTrack,
  clampBpm,
  loadStoredProject,
  moveClip,
  projectLengthBeats,
  removeClip,
  removeEffect,
  removeTrack,
  setEffectParam,
  storeProject,
  toggleSolo,
  updateTrack,
  type StudioProject,
  type StudioTrack,
} from '@/game/audio/studio/project';
import {
  downloadBlob,
  exportFilename,
  exportProjectFile,
  readProjectFile,
  renderProjectToWav,
} from '@/game/audio/studio/exporter';

export interface StudioController {
  project: StudioProject;
  clips: ImportedBuffer[];
  playing: boolean;
  /** Beats since the start of playback. Read per frame; never state. */
  playheadRef: React.RefObject<number>;
  busy: string | null;
  error: string | null;
  dismissError: () => void;

  togglePlay: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  rename: (name: string) => void;

  importFiles: (files: FileList | File[]) => Promise<void>;
  placeClip: (bufferId: string, trackId: string, startBeat: number) => void;
  dropClip: (clipId: string) => void;
  relocateClip: (clipId: string, startBeat: number, trackId?: string) => void;
  discardImport: (bufferId: string) => void;

  patchTrack: (trackId: string, patch: Partial<Omit<StudioTrack, 'id' | 'clips' | 'effects'>>) => void;
  insertEffect: (trackId: string, effectId: string) => void;
  dropEffect: (trackId: string, effectInstanceId: string) => void;
  tweakEffect: (trackId: string, effectInstanceId: string, paramId: string, value: number) => void;
  /** Where a live instrument sends its output. */
  master: Tone.Gain;
  /** The live node graph, for insert slots the project model does not own. */
  graph: TrackGraph;
  solo: (trackId: string) => void;
  newTrack: () => void;
  dropTrack: (trackId: string) => void;

  exportWav: () => Promise<void>;
  exportProject: () => void;
  openProject: (file: File) => Promise<void>;
}

export function useStudio(): StudioController {
  const { getAudioContext } = useMusicPlayer();
  const [project, setProject] = useState<StudioProject>(loadStoredProject);
  const [clips, setClips] = useState<ImportedBuffer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playheadRef = useRef(0);

  // Built eagerly, adopting the soundtrack player's context when it has one.
  // Eager rather than lazy so `master` is a real node on the first render --
  // the pads bind to it once and would otherwise stay silent forever. Creating
  // a context here is safe: it starts suspended and a gesture unlocks it.
  const [engineInstance] = useState(() => getStudioEngine(getAudioContext()));
  const engine = () => engineInstance;

  /** Latest project, for callbacks that must not re-bind on every edit. */
  const projectRef = useRef(project);
  projectRef.current = project;

  // Keep the audio graph and the saved copy in step with the model.
  useEffect(() => {
    engine().graph.sync(project);
    storeProject(project);
    // Tempo is live: dragging the BPM field while playing should be audible.
    Tone.getTransport().bpm.value = project.bpm;
  }, [project]);

  // Stopping when the screen unmounts is not optional -- the transport is a
  // singleton and would otherwise keep publishing a grid over a game run.
  useEffect(() => {
    return () => {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      engineInstance.graph.clearSchedule();
      stopStudioClock();
    };
  }, [engineInstance]);

  // Interpolates `phase` between the transport's quarter-note callbacks and
  // moves the playhead. One loop for the whole screen.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const transport = Tone.getTransport();
      playheadRef.current = transport.ticks / transport.PPQ;
      tickStudioClock();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    engine().graph.clearSchedule();
    stopStudioClock();
    playheadRef.current = 0;
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
      return;
    }
    void (async () => {
      const { graph } = engine();
      // Must precede any scheduling: browsers hand back a suspended context
      // until a gesture unlocks it, and a suspended transport silently never
      // fires the events we just queued.
      const { unlockStudioAudio } = await import('@/game/audio/studio/engine');
      await unlockStudioAudio();

      const current = projectRef.current;
      const transport = Tone.getTransport();
      transport.bpm.value = current.bpm;
      transport.position = 0;
      graph.sync(current);
      graph.schedule(current);
      startStudioClock(current.beatsPerBar);
      transport.start();
      setPlaying(true);
    })();
  }, [playing, stop]);

  // Stop at the end of the arrangement rather than looping forever over silence.
  useEffect(() => {
    if (!playing) return;
    const end = projectLengthBeats(project);
    const check = setInterval(() => {
      if (playheadRef.current >= end) stop();
    }, 200);
    return () => clearInterval(check);
  }, [playing, project, stop]);

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(`Importing ${list.length === 1 ? list[0]!.name : `${list.length} files`}...`);
    const imported: ImportedBuffer[] = [];
    const failures: string[] = [];

    for (const file of list) {
      try {
        imported.push(await importAudioFile(file, engine().context));
      } catch (cause) {
        failures.push(cause instanceof ImportError ? cause.message : `Could not read ${file.name}.`);
      }
    }

    if (imported.length > 0) setClips((previous) => [...previous, ...imported]);
    setBusy(null);
    if (failures.length > 0) setError(failures.join('\n'));
  }, []);

  const placeClip = useCallback((bufferId: string, trackId: string, startBeat: number) => {
    setProject((current) => {
      const source = clips.find((clip) => clip.id === bufferId);
      if (!source) return current;
      return addClip(current, trackId, {
        bufferId,
        name: source.name,
        startBeat: Math.max(0, Math.round(startBeat)),
        lengthBeats: clipLengthInBeats(source.buffer, current.bpm),
      });
    });
  }, [clips]);

  const discardImport = useCallback((bufferId: string) => {
    setClips((previous) => previous.filter((clip) => clip.id !== bufferId));
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.bufferId !== bufferId),
      })),
    }));
    releaseBuffer(bufferId);
  }, []);

  const exportWav = useCallback(async () => {
    const current = projectRef.current;
    const hasAudio = current.tracks.some((track) => track.clips.length > 0);
    if (!hasAudio) {
      setError('Nothing to export yet -- add a clip to a track first.');
      return;
    }
    setBusy('Rendering...');
    try {
      const blob = await renderProjectToWav(current);
      downloadBlob(blob, exportFilename(current, 'wav'));
    } catch {
      setError('Render failed. Try again, or export the project file instead.');
    } finally {
      setBusy(null);
    }
  }, []);

  const openProject = useCallback(async (file: File) => {
    try {
      const loaded = await readProjectFile(file);
      setProject(loaded);
      // Clips reference buffers by id, and ids are per-session -- a project
      // opened in a fresh session needs its audio re-imported to be heard.
      setError('Project loaded. Re-import its audio files to hear the clips.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open that project.');
    }
  }, []);

  return {
    project,
    clips,
    playing,
    playheadRef,
    busy,
    error,
    dismissError: useCallback(() => setError(null), []),

    togglePlay,
    stop,
    setBpm: useCallback((bpm) => setProject((c) => ({ ...c, bpm: clampBpm(bpm) })), []),
    rename: useCallback((name) => setProject((c) => ({ ...c, name })), []),

    importFiles,
    placeClip,
    dropClip: useCallback((clipId) => setProject((c) => removeClip(c, clipId)), []),
    relocateClip: useCallback(
      (clipId, startBeat, trackId) => setProject((c) => moveClip(c, clipId, startBeat, trackId)),
      [],
    ),
    discardImport,

    patchTrack: useCallback((trackId, patch) => setProject((c) => updateTrack(c, trackId, patch)), []),
    insertEffect: useCallback((trackId, effectId) => {
      const def = findEffect(effectId);
      if (!def) return;
      const params = Object.fromEntries(def.params.map((param) => [param.id, param.defaultValue]));
      setProject((c) => addEffect(c, trackId, effectId, params));
    }, []),
    dropEffect: useCallback((trackId, instanceId) => setProject((c) => removeEffect(c, trackId, instanceId)), []),
    tweakEffect: useCallback(
      (trackId, instanceId, paramId, value) =>
        setProject((c) => setEffectParam(c, trackId, instanceId, paramId, value)),
      [],
    ),
    master: engineInstance.master,
    graph: engineInstance.graph,
    solo: useCallback((trackId) => setProject((c) => toggleSolo(c, trackId)), []),
    newTrack: useCallback(() => setProject((c) => addTrack(c)), []),
    dropTrack: useCallback((trackId) => setProject((c) => removeTrack(c, trackId)), []),

    exportWav,
    exportProject: useCallback(() => {
      const current = projectRef.current;
      downloadBlob(exportProjectFile(current), exportFilename(current, '616song'));
    }, []),
    openProject,
  };
}

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
import { getStudioEngine, unlockStudioAudio } from '@/game/audio/studio/engine';
import type { TrackGraph } from '@/game/audio/studio/tracks';
import { startStudioClock, stopStudioClock, tickStudioClock } from '@/game/audio/studio/clock';
import {
  adoptImportedBufferId,
  clipLengthInBeats,
  importAudioFile,
  ImportError,
  releaseBuffer,
  type ImportedBuffer,
} from '@/game/audio/studio/importer';
import {
  loadStudioAudioAssets,
  loadStudioWorkspace,
  saveStudioAudioFile,
  saveStudioWorkspace,
} from '@/game/audio/studio/persistence';
import { isMediaAssetId, LocalMediaStorageError } from '@/game/audio/localMediaStore';

/** Tried in order; the first the browser's `MediaRecorder` supports wins. */
const MIC_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
import {
  addClip,
  addEffect,
  addNote,
  addTrack,
  clampBpm,
  loadStoredProject,
  moveClip,
  projectLengthBeats,
  moveNote,
  removeClip,
  removeEffect,
  removeNote,
  removeTrack,
  setEffectParam,
  setTrackInstrument,
  storeProject,
  toggleSolo,
  updateTrack,
  type StudioNote,
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
  /** Confirmation of something that worked, as distinct from a failure. */
  notice: string | null;
  persistenceState: 'loading' | 'saving' | 'saved' | 'session-only';
  lastSavedAt: number | null;
  restoredAssetCount: number;
  dismissError: () => void;
  dismissNotice: () => void;

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
  setInstrument: (trackId: string, instrumentId: string | undefined) => void;
  placeNote: (trackId: string, note: Omit<StudioNote, 'id'>) => void;
  relocateNote: (trackId: string, noteId: string, pitch: number, startBeat: number) => void;
  dropNote: (trackId: string, noteId: string) => void;
  dropTrack: (trackId: string) => void;

  /** The track pad taps write notes into, or a mic recording captures onto. */
  armedTrackId: string | null;
  armTrack: (trackId: string) => void;
  recordingMic: boolean;
  micSupported: boolean;
  startMicRecording: () => Promise<void>;
  stopMicRecording: () => void;

  exportWav: () => Promise<void>;
  sendToSoundtrack: () => Promise<void>;
  exportProject: () => void;
  openProject: (file: File) => Promise<void>;
}

export function useStudio(): StudioController {
  const { getAudioContext, addFiles } = useMusicPlayer();
  const [project, setProject] = useState<StudioProject>(loadStoredProject);
  const [clips, setClips] = useState<ImportedBuffer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [persistenceState, setPersistenceState] = useState<StudioController['persistenceState']>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restoredAssetCount, setRestoredAssetCount] = useState(0);
  const playheadRef = useRef(0);
  const persistenceReadyRef = useRef(false);
  const persistenceDisabledRef = useRef(false);
  const sessionOnlySourceIdsRef = useRef(new Set<string>());

  const [armedTrackId, setArmedTrackId] = useState<string | null>(null);
  const [recordingMic, setRecordingMic] = useState(false);
  /** Latest armed track, for the async getUserMedia/MediaRecorder callbacks. */
  const armedTrackIdRef = useRef<string | null>(null);
  armedTrackIdRef.current = armedTrackId;
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  /** Snapshotted at record-start, so arming a different track mid-take can't retarget it. */
  const recordTrackIdRef = useRef<string | null>(null);
  const recordStartBeatRef = useRef(0);

  // Built eagerly, adopting the soundtrack player's context when it has one.
  // Eager rather than lazy so `master` is a real node on the first render --
  // the pads bind to it once and would otherwise stay silent forever. Creating
  // a context here is safe: it starts suspended and a gesture unlocks it.
  const [engineInstance] = useState(() => getStudioEngine(getAudioContext()));
  const engine = () => engineInstance;

  /** Latest project, for callbacks that must not re-bind on every edit. */
  const projectRef = useRef(project);
  projectRef.current = project;

  /** Stable ids in the Clips panel plus any source already placed on a lane. */
  const persistedAssetIds = useCallback((currentProject: StudioProject, currentClips: ImportedBuffer[]) => {
    return [
      ...new Set(
        [
          ...currentClips.map((clip) => clip.id),
          ...currentProject.tracks.flatMap((track) => track.clips.map((clip) => clip.bufferId)),
        ].filter(isMediaAssetId),
      ),
    ];
  }, []);

  // Keep the audio graph and the saved copy in step with the model.
  useEffect(() => {
    engine().graph.sync(project);
    storeProject(project);
    // Tempo is live: dragging the BPM field while playing should be audible.
    Tone.getTransport().bpm.value = project.bpm;
  }, [project]);

  // Restore the active project and rebuild decoded runtime buffers from the
  // original player-owned files. A broken source is skipped; the rest of the
  // project still opens and remains editable.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await loadStudioWorkspace();
        if (cancelled) return;

        if (!stored) {
          const migrated = await saveStudioWorkspace(projectRef.current, []);
          if (cancelled) return;
          persistenceReadyRef.current = true;
          setLastSavedAt(migrated.updatedAt);
          setPersistenceState('saved');
          return;
        }

        setBusy('Restoring local Studio project...');
        const assets = await loadStudioAudioAssets(stored.assetIds);
        const restored: ImportedBuffer[] = [];
        let unreadable = 0;
        for (const asset of assets) {
          try {
            const file = new File([asset.blob], asset.fileName, {
              type: asset.mimeType,
              lastModified: asset.createdAt,
            });
            restored.push(await importAudioFile(file, engineInstance.context, asset.id));
          } catch {
            unreadable += 1;
          }
        }
        if (cancelled) return;

        setProject(stored.project);
        setClips(restored);
        setRestoredAssetCount(restored.length);
        setLastSavedAt(stored.updatedAt);
        persistenceReadyRef.current = true;
        setPersistenceState('saved');

        const missing = Math.max(0, stored.assetIds.length - assets.length) + unreadable;
        if (missing > 0) {
          setError(
            `${missing} saved Studio source${missing === 1 ? '' : 's'} could not be restored. ` +
              'The rest of the project is still available.',
          );
        }
      } catch (cause) {
        if (cancelled) return;
        persistenceReadyRef.current = true;
        persistenceDisabledRef.current = true;
        setPersistenceState('session-only');
        setError(
          cause instanceof LocalMediaStorageError
            ? cause.message
            : 'The Studio can run for this session, but its local project could not be restored.',
        );
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engineInstance]);

  // Debounced IndexedDB autosave keeps fader drags from creating a write per
  // pointer event. The synchronous localStorage copy above remains a small
  // recovery fallback while this version migrates existing projects.
  useEffect(() => {
    if (!persistenceReadyRef.current || persistenceDisabledRef.current) return;
    setPersistenceState('saving');
    const timeout = window.setTimeout(() => {
      void saveStudioWorkspace(project, persistedAssetIds(project, clips))
        .then((record) => {
          setLastSavedAt(record.updatedAt);
          setPersistenceState(sessionOnlySourceIdsRef.current.size > 0 ? 'session-only' : 'saved');
        })
        .catch((cause: unknown) => {
          persistenceDisabledRef.current = true;
          setPersistenceState('session-only');
          setError(
            cause instanceof LocalMediaStorageError
              ? cause.message
              : 'The Studio could not autosave. Export a project backup before leaving.',
          );
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [clips, persistedAssetIds, project]);

  // Stopping when the screen unmounts is not optional -- the transport is a
  // singleton and would otherwise keep publishing a grid over a game run.
  useEffect(() => {
    return () => {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      engineInstance.graph.clearSchedule();
      stopStudioClock();
      // A recording in progress must not leave the mic hot after navigating away.
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    const sessionOnly: string[] = [];

    for (const file of list) {
      try {
        let decoded = await importAudioFile(file, engine().context);
        try {
          const asset = await saveStudioAudioFile(file);
          decoded = adoptImportedBufferId(decoded, asset.id);
        } catch {
          sessionOnlySourceIdsRef.current.add(decoded.id);
          sessionOnly.push(file.name);
        }
        imported.push(decoded);
      } catch (cause) {
        failures.push(cause instanceof ImportError ? cause.message : `Could not read ${file.name}.`);
      }
    }

    if (imported.length > 0) {
      setClips((previous) => {
        const merged = new Map(previous.map((clip) => [clip.id, clip]));
        for (const clip of imported) merged.set(clip.id, clip);
        return [...merged.values()];
      });
    }
    setBusy(null);
    if (failures.length > 0 || sessionOnly.length > 0) {
      setError(
        [
          ...failures,
          ...(sessionOnly.length > 0
            ? [
                `${sessionOnly.length} imported source${sessionOnly.length === 1 ? '' : 's'} will work for this session but could not be saved on this device.`,
              ]
            : []),
        ].join('\n'),
      );
    }
    if (sessionOnly.length > 0) setPersistenceState('session-only');
  }, []);

  const placeClip = useCallback(
    (bufferId: string, trackId: string, startBeat: number) => {
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
    },
    [clips],
  );

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
    sessionOnlySourceIdsRef.current.delete(bufferId);
    if (sessionOnlySourceIdsRef.current.size === 0 && !persistenceDisabledRef.current) {
      setPersistenceState('saved');
    }
  }, []);

  const armTrack = useCallback((trackId: string) => {
    setArmedTrackId((current) => (current === trackId ? null : trackId));
  }, []);

  /**
   * Decodes a finished mic take through the same import path a dropped file
   * takes, then places it directly on the track it was recorded into -- a
   * take belongs on the timeline, not in the unplaced-clips library.
   */
  const finishMicRecording = useCallback(async (mimeType: string) => {
    const trackId = recordTrackIdRef.current;
    recordTrackIdRef.current = null;
    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    setRecordingMic(false);
    if (!trackId || chunks.length === 0) return;

    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([new Blob(chunks, { type: mimeType })], `Mic take ${Date.now()}.${extension}`, {
      type: mimeType,
    });

    setBusy('Processing recording...');
    try {
      let imported = await importAudioFile(file, engine().context);
      try {
        const asset = await saveStudioAudioFile(file);
        imported = adoptImportedBufferId(imported, asset.id);
      } catch {
        sessionOnlySourceIdsRef.current.add(imported.id);
        setPersistenceState('session-only');
        setError('The recording is available for this session, but could not be saved on this device.');
      }
      setClips((previous) => {
        const withoutDuplicate = previous.filter((clip) => clip.id !== imported.id);
        return [...withoutDuplicate, imported];
      });
      const startBeat = Math.max(0, Math.round(recordStartBeatRef.current));
      setProject((current) =>
        addClip(current, trackId, {
          bufferId: imported.id,
          name: imported.name,
          startBeat,
          lengthBeats: clipLengthInBeats(imported.buffer, current.bpm),
        }),
      );
    } catch (cause) {
      setError(cause instanceof ImportError ? cause.message : 'Could not process the recording.');
    } finally {
      setBusy(null);
    }
  }, []);

  const startMicRecording = useCallback(async () => {
    const trackId = armedTrackIdRef.current;
    const track = trackId ? projectRef.current.tracks.find((t) => t.id === trackId) : undefined;
    if (!track) {
      setError('Arm a track to record into first.');
      return;
    }
    if (track.instrumentId) {
      setError(`"${track.name}" has an instrument assigned -- arm an audio-clips track for a mic recording.`);
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot record audio.');
      return;
    }

    // Same reasoning as togglePlay: a suspended context never fires what gets
    // scheduled on it, and the first gesture on the page is often this one.
    await unlockStudioAudio();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in your browser settings to record.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not access the microphone.',
      );
      return;
    }

    const mimeType = MIC_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recordedChunksRef.current = [];
    recordTrackIdRef.current = track.id;
    recordStartBeatRef.current = playheadRef.current;
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      void finishMicRecording(recorder.mimeType || mimeType || 'audio/webm');
    };

    recorder.start();
    setRecordingMic(true);
  }, [finishMicRecording]);

  const stopMicRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  /**
   * Renders the project, or explains why there is nothing to render. Shared by
   * every path that turns the arrangement into audio.
   */
  const renderCurrent = useCallback(async (busyLabel: string): Promise<Blob | null> => {
    const current = projectRef.current;
    const hasAudio = current.tracks.some(
      (track) => track.clips.length > 0 || (track.instrumentId && track.notes.length > 0),
    );
    if (!hasAudio) {
      setError('Nothing to render yet -- add a clip or write some notes first.');
      return null;
    }
    setBusy(busyLabel);
    setNotice(null);
    try {
      return await renderProjectToWav(current);
    } catch {
      setError('Render failed. Try again, or save the project file instead.');
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const exportWav = useCallback(async () => {
    const blob = await renderCurrent('Rendering...');
    if (blob) downloadBlob(blob, exportFilename(projectRef.current, 'wav'));
  }, [renderCurrent]);

  /**
   * Pours the finished beat into the soundtrack.
   *
   * This is the only route from the studio into the rest of the game, and it is
   * deliberately the same route an imported mp3 takes: render to audio, hand it
   * to the player's existing `addFiles`, and let it be an ordinary track. The
   * game then reacts to it through the one detection path that already exists,
   * rather than the studio needing a second, privileged channel into the run.
   */
  const sendToSoundtrack = useCallback(async () => {
    const blob = await renderCurrent('Rendering for the soundtrack...');
    if (!blob) return;
    const current = projectRef.current;
    const filename = exportFilename(current, 'wav');
    // `addFiles` takes Files, so the render is wrapped as one -- no new player
    // API, and the track behaves exactly like anything else the player added.
    const added = addFiles([new File([blob], filename, { type: 'audio/wav' })]);
    setNotice(
      added > 0
        ? `Added to your soundtrack and saved on this device. Play it from the Soundtrack panel and the game will move to it. Use WAV or a project backup for a portable copy.`
        : 'The soundtrack would not accept that render.',
    );
  }, [addFiles, renderCurrent]);

  const openProject = useCallback(async (file: File) => {
    try {
      const loaded = await readProjectFile(file);
      setProject(loaded);
      // Clips reference buffers by id, and ids are per-session -- a project
      // opened in a fresh session needs its audio re-imported to be heard.
      setNotice('Project loaded. Re-import its audio files to hear the clips.');
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
    notice,
    persistenceState,
    lastSavedAt,
    restoredAssetCount,
    dismissError: useCallback(() => setError(null), []),
    dismissNotice: useCallback(() => setNotice(null), []),

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
    setInstrument: useCallback(
      (trackId, instrumentId) => setProject((c) => setTrackInstrument(c, trackId, instrumentId)),
      [],
    ),
    placeNote: useCallback((trackId, note) => setProject((c) => addNote(c, trackId, note)), []),
    relocateNote: useCallback(
      (trackId, noteId, pitch, startBeat) => setProject((c) => moveNote(c, trackId, noteId, pitch, startBeat)),
      [],
    ),
    dropNote: useCallback((trackId, noteId) => setProject((c) => removeNote(c, trackId, noteId)), []),
    dropTrack: useCallback((trackId) => {
      // A deleted track can't stay armed -- nothing left to record into.
      setArmedTrackId((current) => (current === trackId ? null : current));
      setProject((c) => removeTrack(c, trackId));
    }, []),

    armedTrackId,
    armTrack,
    recordingMic,
    micSupported: typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    startMicRecording,
    stopMicRecording,

    exportWav,
    sendToSoundtrack,
    exportProject: useCallback(() => {
      const current = projectRef.current;
      downloadBlob(exportProjectFile(current), exportFilename(current, '616song'));
    }, []),
    openProject,
  };
}

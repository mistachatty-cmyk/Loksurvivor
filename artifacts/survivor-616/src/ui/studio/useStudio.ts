/**
 * The one bridge between the studio engine and React.
 *
 * Engine state lives in the engine. React holds only what is actually rendered,
 * and the playhead -- which moves every frame -- is deliberately *not* React
 * state: it is exposed as a ref the timeline canvas reads in its own animation
 * loop. Re-rendering a component tree sixty times a second to move a one-pixel
 * line is how studio UIs end up dropping audio.
 */

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import * as Tone from 'tone';

import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { findEffect } from '@/game/audio/studio/effects';
import { createProjectBundle, readProjectBundle } from '@/game/audio/studio/bundle';
import { getStudioEngine, unlockStudioAudio } from '@/game/audio/studio/engine';
import type { TrackGraph } from '@/game/audio/studio/tracks';
import { startStudioClock, stopStudioClock, tickStudioClock } from '@/game/audio/studio/clock';
import {
  adoptImportedBufferId,
  clipLengthInBeats,
  getBuffer,
  importAudioFile,
  ImportError,
  releaseBuffer,
  type ImportedBuffer,
} from '@/game/audio/studio/importer';
import {
  createStudioProjectWorkspace,
  deleteStudioProject,
  duplicateStudioProject,
  importStudioProjectWorkspace,
  referencedStudioAssetIds,
  listStudioProjects,
  listReusableStudioKits,
  loadStudioAudioAssets,
  loadStudioWorkspace,
  openStudioProject,
  renameStudioProject,
  saveStudioAudioFile,
  saveStudioWorkspace,
  type StudioProjectSummary,
  type StudioWorkspaceRecord,
} from '@/game/audio/studio/persistence';
import { isMediaAssetId, LocalMediaStorageError } from '@/game/audio/localMediaStore';

/** Tried in order; the first the browser's `MediaRecorder` supports wins. */
const MIC_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
import {
  addClip,
  addDrumClip,
  addEffect,
  addNote,
  addTrack,
  clampBpm,
  createPattern,
  duplicatePattern,
  duplicateClip,
  loadStoredProject,
  moveClip,
  projectLengthBeats,
  secondsPerBeat,
  moveNote,
  removeClip,
  removeEffect,
  removeNote,
  removeTrack,
  patchAudioClip,
  patchNote,
  quantizeTrackNotes,
  setEffectParam,
  setPatternHit,
  studioId,
  setTrackInstrument,
  storeProject,
  splitAudioClip,
  trimAudioClip,
  toggleSolo,
  updateTrack,
  type StudioNote,
  type StudioDrumPad,
  type StudioDrumKit,
  type StudioProject,
  type StudioTrack,
} from '@/game/audio/studio/project';
import {
  downloadBlob,
  exportFilename,
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
  masterPeak: number;
  inputPeak: number;
  metronomeEnabled: boolean;
  setMetronomeEnabled: (enabled: boolean) => void;
  countInBars: number;
  setCountInBars: (bars: number) => void;
  countingIn: boolean;
  recordOffsetMs: number;
  setRecordOffsetMs: (ms: number) => void;
  loopEnabled: boolean;
  setLoopEnabled: (enabled: boolean) => void;
  projects: StudioProjectSummary[];
  reusableKits: Array<{ projectName: string; kit: StudioDrumKit }>;
  activeProjectId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  dismissError: () => void;
  dismissNotice: () => void;

  togglePlay: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  rename: (name: string) => void;
  createLocalProject: () => Promise<void>;
  openLocalProject: (projectId: string) => Promise<void>;
  renameLocalProject: (projectId: string, name: string) => Promise<void>;
  duplicateLocalProject: (projectId: string) => Promise<void>;
  deleteLocalProject: (projectId: string) => Promise<void>;

  importFiles: (files: FileList | File[]) => Promise<void>;
  placeClip: (bufferId: string, trackId: string, startBeat: number) => void;
  dropClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  splitClip: (clipId: string, atBeat: number) => void;
  trimClip: (clipId: string, edge: 'start' | 'end', amountBeats: number) => void;
  patchClip: (clipId: string, patch: { gain?: number; fadeInSeconds?: number; fadeOutSeconds?: number }) => void;
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
  patchNote: (trackId: string, noteId: string, patch: { lengthBeats?: number; velocity?: number }) => void;
  quantizeNotes: (trackId: string) => void;
  dropTrack: (trackId: string) => void;
  setDrumHit: (patternId: string, step: number, pad: number, velocity: number) => void;
  patchPattern: (patternId: string, patch: { name?: string; bars?: number; swing?: number }) => void;
  newPattern: () => void;
  copyPattern: (patternId: string) => void;
  placePattern: (patternId: string, kitId: string) => void;
  copyKit: (kitId: string) => void;
  renameKit: (kitId: string, name: string) => void;
  patchPad: (kitId: string, padIndex: number, patch: Partial<StudioDrumPad>) => void;
  importPadSample: (kitId: string, padIndex: number, file: File) => Promise<void>;
  reuseKit: (kitId: string) => Promise<void>;

  /** The track pad taps write notes into, or a mic recording captures onto. */
  armedTrackId: string | null;
  armTrack: (trackId: string) => void;
  recordingMic: boolean;
  micSupported: boolean;
  startMicRecording: () => Promise<void>;
  stopMicRecording: () => void;

  exportWav: () => Promise<void>;
  sendToSoundtrack: () => Promise<void>;
  exportProject: () => Promise<void>;
  openProject: (file: File) => Promise<void>;
}

export function useStudio(): StudioController {
  const { getAudioContext, addFiles } = useMusicPlayer();
  const [project, setProjectState] = useState<StudioProject>(loadStoredProject);
  const [clips, setClips] = useState<ImportedBuffer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [persistenceState, setPersistenceState] = useState<StudioController['persistenceState']>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restoredAssetCount, setRestoredAssetCount] = useState(0);
  const [masterPeak, setMasterPeak] = useState(0);
  const [inputPeak, setInputPeak] = useState(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInBars, setCountInBars] = useState(1);
  const [countingIn, setCountingIn] = useState(false);
  const [recordOffsetMs, setRecordOffsetMs] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [reusableKits, setReusableKits] = useState<Array<{ projectName: string; kit: StudioDrumKit }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const playheadRef = useRef(0);
  const persistenceReadyRef = useRef(false);
  const persistenceDisabledRef = useRef(false);
  const sessionOnlySourceIdsRef = useRef(new Set<string>());
  const activeProjectIdRef = useRef<string | null>(null);
  const pendingProjectWriteRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceGenerationRef = useRef(0);

  const [armedTrackId, setArmedTrackId] = useState<string | null>(null);
  const [recordingMic, setRecordingMic] = useState(false);
  /** Latest armed track, for the async getUserMedia/MediaRecorder callbacks. */
  const armedTrackIdRef = useRef<string | null>(null);
  armedTrackIdRef.current = armedTrackId;
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micMeterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micMeterRef = useRef<AnalyserNode | null>(null);
  const micMeterSinkRef = useRef<GainNode | null>(null);
  const micMeterTimerRef = useRef<number | null>(null);
  const countInTokenRef = useRef(0);
  const clickVoiceRef = useRef<Tone.Synth | null>(null);
  const clickEventRef = useRef<number | null>(null);
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
  const undoRef = useRef<StudioProject[]>([]);
  const redoRef = useRef<StudioProject[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const setProject = useCallback((action: SetStateAction<StudioProject>) => {
    const before = projectRef.current;
    const after = typeof action === 'function' ? action(before) : action;
    if (after === before) return;
    undoRef.current.push(before);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    projectRef.current = after;
    setProjectState(after);
    setHistoryVersion((version) => version + 1);
  }, []);
  const replaceProject = useCallback((next: StudioProject) => {
    undoRef.current = [];
    redoRef.current = [];
    projectRef.current = next;
    setProjectState(next);
    setHistoryVersion((version) => version + 1);
  }, []);
  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(projectRef.current);
    projectRef.current = previous;
    setProjectState(previous);
    setHistoryVersion((version) => version + 1);
  }, []);
  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(projectRef.current);
    projectRef.current = next;
    setProjectState(next);
    setHistoryVersion((version) => version + 1);
  }, []);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  activeProjectIdRef.current = activeProjectId;

  /** Stable ids in the Clips panel plus any source already placed on a lane. */
  const persistedAssetIds = useCallback((currentProject: StudioProject, currentClips: ImportedBuffer[]) => {
    return [
      ...new Set(
        [
          ...currentClips.map((clip) => clip.id),
          ...referencedStudioAssetIds(currentProject),
        ].filter(isMediaAssetId),
      ),
    ];
  }, []);

  const refreshProjectSummaries = useCallback(async () => {
    const [summaries, kits] = await Promise.all([listStudioProjects(), listReusableStudioKits()]);
    setProjects(summaries);
    setReusableKits(kits);
  }, []);

  /** Rebuilds decoded runtime buffers when the active document changes. */
  const restoreWorkspace = useCallback(
    async (workspace: StudioWorkspaceRecord): Promise<number> => {
      const assets = await loadStudioAudioAssets(workspace.assetIds);
      // Release before decoding. Equal content-addressed ids can appear in two
      // projects; releasing afterwards would remove the newly restored buffer.
      for (const id of new Set([...clipsRef.current.map((source) => source.id), ...referencedStudioAssetIds(projectRef.current)])) releaseBuffer(id);
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

      sessionOnlySourceIdsRef.current.clear();
      setArmedTrackId(null);
      replaceProject(workspace.project);
      setClips(restored);
      setRestoredAssetCount(restored.length);
      activeProjectIdRef.current = workspace.id;
      setActiveProjectId(workspace.id);
      setLastSavedAt(workspace.updatedAt);
      setPersistenceState('saved');
      return Math.max(0, workspace.assetIds.length - assets.length) + unreadable;
    },
    [engineInstance, replaceProject],
  );

  // Keep the audio graph and the saved copy in step with the model.
  useEffect(() => {
    engine().graph.sync(project);
    storeProject(project);
    // Tempo is live: dragging the BPM field while playing should be audible.
    Tone.getTransport().bpm.value = project.bpm;
  }, [project]);

  useEffect(() => {
    if (!playing) { setMasterPeak(0); return; }
    const samples = new Float32Array(engineInstance.analyser.fftSize);
    const timer = window.setInterval(() => {
      engineInstance.analyser.getFloatTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      setMasterPeak(peak);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, engineInstance]);

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
          setActiveProjectId(migrated.id);
          persistenceReadyRef.current = true;
          setLastSavedAt(migrated.updatedAt);
          setPersistenceState('saved');
          await refreshProjectSummaries();
          return;
        }

        setBusy('Restoring local Studio project...');
        const missing = await restoreWorkspace(stored);
        if (cancelled) return;
        persistenceReadyRef.current = true;
        await refreshProjectSummaries();

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
  }, [refreshProjectSummaries, restoreWorkspace]);

  // Debounced IndexedDB autosave keeps fader drags from creating a write per
  // pointer event. The synchronous localStorage copy above remains a small
  // recovery fallback while this version migrates existing projects.
  useEffect(() => {
    if (!persistenceReadyRef.current || persistenceDisabledRef.current || !activeProjectId) return;
    setPersistenceState('saving');
    const savingProjectId = activeProjectId;
    const savingGeneration = workspaceGenerationRef.current;
    const timeout = window.setTimeout(() => {
      if (workspaceGenerationRef.current !== savingGeneration) return;
      const operation = pendingProjectWriteRef.current.then(() =>
        workspaceGenerationRef.current === savingGeneration
          ? saveStudioWorkspace(project, persistedAssetIds(project, clips), savingProjectId)
          : null,
      );
      pendingProjectWriteRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      void operation
        .then((record) => {
          if (!record) return;
          if (activeProjectIdRef.current !== savingProjectId) return;
          setLastSavedAt(record.updatedAt);
          setPersistenceState(sessionOnlySourceIdsRef.current.size > 0 ? 'session-only' : 'saved');
          void refreshProjectSummaries().catch(() => {
            // The project itself is safely written; a stale browser list can
            // retry on the next successful save or lifecycle operation.
          });
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
  }, [activeProjectId, clips, persistedAssetIds, project, refreshProjectSummaries]);

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
    countInTokenRef.current += 1;
    setCountingIn(false);
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    transport.loop = false;
    engine().graph.clearSchedule();
    stopStudioClock();
    playheadRef.current = 0;
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || !metronomeEnabled) return;
    const voice = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 } });
    const level = new Tone.Gain(0.12).connect(engineInstance.master);
    voice.connect(level);
    clickVoiceRef.current = voice;
    clickEventRef.current = Tone.getTransport().scheduleRepeat((time) => voice.triggerAttackRelease('C6', '32n', time), '4n');
    return () => {
      if (clickEventRef.current !== null) Tone.getTransport().clear(clickEventRef.current);
      clickEventRef.current = null;
      clickVoiceRef.current = null;
      voice.dispose();
      level.dispose();
    };
  }, [playing, metronomeEnabled, engineInstance]);

  const persistCurrentWorkspace = useCallback(async () => {
    if (persistenceDisabledRef.current) {
      throw new LocalMediaStorageError('Local project management is unavailable for this session.', 'unavailable');
    }
    const currentId = activeProjectIdRef.current;
    if (!currentId) return null;
    const operation = pendingProjectWriteRef.current.then(() =>
      saveStudioWorkspace(projectRef.current, persistedAssetIds(projectRef.current, clipsRef.current), currentId),
    );
    pendingProjectWriteRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }, [persistedAssetIds]);

  const reportProjectOperationError = useCallback((cause: unknown) => {
    setError(
      cause instanceof LocalMediaStorageError || cause instanceof Error
        ? cause.message
        : 'The Studio could not update its local projects.',
    );
  }, []);

  const projectChangeBlocked = useCallback(() => {
    if (!mediaRecorderRef.current) return false;
    setError('Stop the microphone recording before changing projects.');
    return true;
  }, []);

  const openLocalProject = useCallback(
    async (projectId: string) => {
      if (projectId === activeProjectIdRef.current) return;
      if (projectChangeBlocked()) return;
      setBusy('Opening local project...');
      setNotice(null);
      try {
        await pendingProjectWriteRef.current;
        await persistCurrentWorkspace();
        workspaceGenerationRef.current += 1;
        stop();
        const record = await openStudioProject(projectId);
        const missing = await restoreWorkspace(record);
        await refreshProjectSummaries();
        setNotice(
          missing > 0
            ? `Opened “${record.project.name}” with ${missing} unavailable source${missing === 1 ? '' : 's'}.`
            : `Opened “${record.project.name}”.`,
        );
      } catch (cause) {
        reportProjectOperationError(cause);
      } finally {
        setBusy(null);
      }
    },
    [
      persistCurrentWorkspace,
      projectChangeBlocked,
      refreshProjectSummaries,
      reportProjectOperationError,
      restoreWorkspace,
      stop,
    ],
  );

  const createLocalProject = useCallback(async () => {
    if (projectChangeBlocked()) return;
    setBusy('Creating local project...');
    setNotice(null);
    try {
      await pendingProjectWriteRef.current;
      await persistCurrentWorkspace();
      workspaceGenerationRef.current += 1;
      stop();
      const record = await createStudioProjectWorkspace();
      await restoreWorkspace(record);
      await refreshProjectSummaries();
      setNotice('Created a new local Studio project.');
    } catch (cause) {
      reportProjectOperationError(cause);
    } finally {
      setBusy(null);
    }
  }, [
    persistCurrentWorkspace,
    projectChangeBlocked,
    refreshProjectSummaries,
    reportProjectOperationError,
    restoreWorkspace,
    stop,
  ]);

  const renameLocalProject = useCallback(
    async (projectId: string, name: string) => {
      const nextName = name.trim() || 'Untitled';
      const operation = pendingProjectWriteRef.current.then(async () => {
        if (projectId === activeProjectIdRef.current) {
          const renamed = { ...projectRef.current, name: nextName };
          setProject(renamed);
          setProjects((current) =>
            current.map((project) => (project.id === projectId ? { ...project, name: nextName } : project)),
          );
          await saveStudioWorkspace(renamed, persistedAssetIds(renamed, clipsRef.current), projectId);
        } else {
          await renameStudioProject(projectId, nextName);
        }
        await refreshProjectSummaries();
      });
      pendingProjectWriteRef.current = operation.catch(() => undefined);
      try {
        await operation;
      } catch (cause) {
        reportProjectOperationError(cause);
      }
    },
    [persistedAssetIds, refreshProjectSummaries, reportProjectOperationError],
  );

  const duplicateLocalProject = useCallback(
    async (projectId: string) => {
      if (projectChangeBlocked()) return;
      setBusy('Duplicating local project...');
      setNotice(null);
      try {
        await pendingProjectWriteRef.current;
        await persistCurrentWorkspace();
        workspaceGenerationRef.current += 1;
        stop();
        const record = await duplicateStudioProject(projectId);
        const missing = await restoreWorkspace(record);
        await refreshProjectSummaries();
        setNotice(
          missing > 0
            ? `Duplicated “${record.project.name}”; ${missing} unavailable source${missing === 1 ? '' : 's'} could not be copied.`
            : `Duplicated “${record.project.name}” without copying its audio bytes.`,
        );
      } catch (cause) {
        reportProjectOperationError(cause);
      } finally {
        setBusy(null);
      }
    },
    [
      persistCurrentWorkspace,
      projectChangeBlocked,
      refreshProjectSummaries,
      reportProjectOperationError,
      restoreWorkspace,
      stop,
    ],
  );

  const deleteLocalProject = useCallback(
    async (projectId: string) => {
      if (projectChangeBlocked()) return;
      setBusy('Deleting local project...');
      setNotice(null);
      try {
        await pendingProjectWriteRef.current;
        await persistCurrentWorkspace();
        const deletingActive = projectId === activeProjectIdRef.current;
        if (deletingActive) workspaceGenerationRef.current += 1;
        const result = await deleteStudioProject(projectId);
        if (deletingActive) {
          stop();
          await restoreWorkspace(result.active);
        }
        await refreshProjectSummaries();
        setNotice(
          `Deleted the project.${
            result.removedAssetCount > 0
              ? ` Recovered ${result.removedAssetCount} unused local source${result.removedAssetCount === 1 ? '' : 's'}.`
              : ''
          }`,
        );
      } catch (cause) {
        reportProjectOperationError(cause);
      } finally {
        setBusy(null);
      }
    },
    [
      persistCurrentWorkspace,
      projectChangeBlocked,
      refreshProjectSummaries,
      reportProjectOperationError,
      restoreWorkspace,
      stop,
    ],
  );

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
      transport.loop = loopEnabled;
      transport.loopStart = 0;
      transport.loopEnd = projectLengthBeats(current) * secondsPerBeat(current.bpm);
      graph.sync(current);
      graph.schedule(current);
      startStudioClock(current.beatsPerBar);
      transport.start();
      setPlaying(true);
    })();
  }, [playing, stop, loopEnabled]);

  // Stop at the end of the arrangement rather than looping forever over silence.
  useEffect(() => {
    if (!playing || loopEnabled) return;
    const end = projectLengthBeats(project);
    const check = setInterval(() => {
      if (playheadRef.current >= end) stop();
    }, 200);
    return () => clearInterval(check);
  }, [playing, project, stop, loopEnabled]);

  useEffect(() => {
    const transport = Tone.getTransport();
    transport.loop = playing && loopEnabled;
    if (loopEnabled) transport.loopEnd = projectLengthBeats(project) * secondsPerBeat(project.bpm);
  }, [playing, loopEnabled, project]);

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
    if (!referencedStudioAssetIds(projectRef.current).includes(bufferId)) releaseBuffer(bufferId);
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
      const startBeat = Math.max(0, Math.round((recordStartBeatRef.current - recordOffsetMs / 1000 / secondsPerBeat(projectRef.current.bpm)) * 4) / 4);
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
  }, [recordOffsetMs]);

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

    const meterSource = engineInstance.context.createMediaStreamSource(stream);
    const meter = engineInstance.context.createAnalyser();
    meter.fftSize = 1024;
    const meterSink = engineInstance.context.createGain();
    meterSink.gain.value = 0;
    meterSource.connect(meter);
    meter.connect(meterSink).connect(engineInstance.context.destination);
    micMeterSourceRef.current = meterSource;
    micMeterRef.current = meter;
    micMeterSinkRef.current = meterSink;
    const meterSamples = new Float32Array(meter.fftSize);
    micMeterTimerRef.current = window.setInterval(() => {
      meter.getFloatTimeDomainData(meterSamples);
      let peak = 0;
      for (const sample of meterSamples) peak = Math.max(peak, Math.abs(sample));
      setInputPeak(peak);
    }, 100);

    recordedChunksRef.current = [];
    recordTrackIdRef.current = track.id;
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      if (micMeterTimerRef.current !== null) window.clearInterval(micMeterTimerRef.current);
      micMeterTimerRef.current = null;
      micMeterSourceRef.current?.disconnect();
      micMeterRef.current?.disconnect();
      micMeterSinkRef.current?.disconnect();
      micMeterSourceRef.current = null;
      micMeterRef.current = null;
      micMeterSinkRef.current = null;
      setInputPeak(0);
      void finishMicRecording(recorder.mimeType || mimeType || 'audio/webm');
    };

    if (countInBars > 0) {
      const token = ++countInTokenRef.current;
      setCountingIn(true);
      const click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 } }).connect(engineInstance.master);
      const beatSeconds = secondsPerBeat(projectRef.current.bpm);
      for (let beat = 0; beat < countInBars * 4; beat += 1) click.triggerAttackRelease(beat % 4 === 0 ? 'E6' : 'C6', '32n', Tone.now() + beat * beatSeconds);
      await new Promise<void>((resolve) => window.setTimeout(resolve, countInBars * 4 * beatSeconds * 1000));
      click.dispose();
      if (token !== countInTokenRef.current) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        meterSource.disconnect();
        meter.disconnect();
        meterSink.disconnect();
        if (micMeterTimerRef.current !== null) window.clearInterval(micMeterTimerRef.current);
        micMeterTimerRef.current = null;
        micMeterSourceRef.current = null;
        micMeterRef.current = null;
        micMeterSinkRef.current = null;
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setInputPeak(0);
        return;
      }
      setCountingIn(false);
    }
    recordStartBeatRef.current = playheadRef.current;
    if (!playing) togglePlay();
    recorder.start();
    setRecordingMic(true);
  }, [countInBars, engineInstance, finishMicRecording, playing, togglePlay]);

  const stopMicRecording = useCallback(() => {
    countInTokenRef.current += 1;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  /**
   * Renders the project, or explains why there is nothing to render. Shared by
   * every path that turns the arrangement into audio.
   */
  const renderCurrent = useCallback(async (busyLabel: string): Promise<Blob | null> => {
    const current = projectRef.current;
    const hasAudio = current.tracks.some(
      (track) => track.clips.length > 0 || track.drumClips.length > 0 || (track.instrumentId && (track.notes.length > 0 || track.midiClips.length > 0)),
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
    const added = addFiles([new File([blob], filename, { type: 'audio/wav' })], { authoredBpm: current.bpm, downbeatSeconds: 0 });
    setNotice(
      added > 0
        ? `Added to your soundtrack and saved on this device. Play it from the Soundtrack panel and the game will move to it. Use WAV or a project backup for a portable copy.`
        : 'The soundtrack would not accept that render.',
    );
  }, [addFiles, renderCurrent]);

  const exportProject = useCallback(async () => {
    setBusy('Packing project and sounds...');
    setError(null);
    try {
      if (sessionOnlySourceIdsRef.current.size > 0) {
        throw new Error('Some sounds are session only. Free device storage and re-import them before backing up.');
      }
      const current = projectRef.current;
      const sourceIds = [
        ...clipsRef.current.map((clip) => clip.id),
        ...referencedStudioAssetIds(current),
      ];
      const bundle = await createProjectBundle(current, sourceIds);
      downloadBlob(bundle, exportFilename(current, '616project'));
      setNotice('Portable project backup downloaded with its sounds.');
    } catch (cause) {
      reportProjectOperationError(cause);
    } finally {
      setBusy(null);
    }
  }, [reportProjectOperationError]);

  const openProject = useCallback(async (file: File) => {
    if (projectChangeBlocked()) return;
    setBusy('Opening project backup...');
    setError(null);
    try {
      const portable = file.name.toLowerCase().endsWith('.616project');
      const imported = portable
        ? await readProjectBundle(file)
        : { project: await readProjectFile(file), assetIds: [] as string[] };
      if (!portable) imported.assetIds = referencedStudioAssetIds(imported.project);
      const legacyUnavailable = portable ? 0 : [
        ...imported.project.tracks.flatMap((track) => track.clips.map((clip) => clip.bufferId)),
        ...imported.project.kits.flatMap((kit) => kit.pads.flatMap((pad) => pad.sourceId ? [pad.sourceId] : [])),
      ].filter((id) => !isMediaAssetId(id)).length;
      await pendingProjectWriteRef.current;
      await persistCurrentWorkspace();
      workspaceGenerationRef.current += 1;
      stop();
      const record = await importStudioProjectWorkspace(imported.project, imported.assetIds);
      const missing = (await restoreWorkspace(record)) + legacyUnavailable;
      await refreshProjectSummaries();
      setNotice(
        missing > 0
          ? `Project opened with ${missing} unavailable source${missing === 1 ? '' : 's'}. Re-import those sounds to hear every clip.`
          : `Opened “${record.project.name}” as a new local project.`,
      );
    } catch (cause) {
      reportProjectOperationError(cause);
    } finally {
      setBusy(null);
    }
  }, [persistCurrentWorkspace, projectChangeBlocked, refreshProjectSummaries, reportProjectOperationError, restoreWorkspace, stop]);

  const importPadSample = useCallback(async (kitId: string, padIndex: number, file: File) => {
    setBusy(`Loading ${file.name}...`);
    setError(null);
    try {
      let decoded = await importAudioFile(file, engineInstance.context);
      const asset = await saveStudioAudioFile(file);
      decoded = adoptImportedBufferId(decoded, asset.id);
      setProject((current) => ({
        ...current,
        kits: current.kits.map((kit) => kit.id === kitId ? {
          ...kit,
          pads: kit.pads.map((pad, index) => index === padIndex ? { ...pad, name: file.name.replace(/\.[^.]+$/, ''), sourceId: decoded.id } : pad),
        } : kit),
      }));
      setNotice(`${file.name} is ready on pad ${padIndex + 1}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load that pad sample.');
    } finally {
      setBusy(null);
    }
  }, [engineInstance, setProject]);

  const reuseKit = useCallback(async (kitId: string) => {
    const source = reusableKits.find((entry) => entry.kit.id === kitId)?.kit;
    if (!source) return;
    setBusy(`Loading ${source.name}...`);
    setError(null);
    const generation = workspaceGenerationRef.current;
    try {
      const ids = [...new Set(source.pads.flatMap((pad) => pad.sourceId && !getBuffer(pad.sourceId) ? [pad.sourceId] : []))];
      const assets = await loadStudioAudioAssets(ids);
      if (assets.length !== ids.length) throw new Error('A saved kit sound is missing from device storage. Restore its project backup first.');
      for (const asset of assets) {
        await importAudioFile(new File([asset.blob], asset.fileName, { type: asset.mimeType }), engineInstance.context, asset.id);
      }
      if (generation !== workspaceGenerationRef.current) return;
      setProject((current) => ({ ...current, kits: [...current.kits, { ...source, id: studioId('kit'), name: source.name, pads: source.pads.map((pad) => ({ ...pad })) }] }));
      setNotice(`${source.name} is ready in this project.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reuse that kit.');
    } finally {
      setBusy(null);
    }
  }, [engineInstance, reusableKits, setProject]);

  useEffect(() => {
    const handleHistoryKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleHistoryKey);
    return () => window.removeEventListener('keydown', handleHistoryKey);
  }, [undo, redo]);

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
    masterPeak,
    inputPeak,
    metronomeEnabled,
    setMetronomeEnabled,
    countInBars,
    setCountInBars,
    countingIn,
    recordOffsetMs,
    setRecordOffsetMs,
    loopEnabled,
    setLoopEnabled,
    projects,
    reusableKits,
    activeProjectId,
    canUndo: historyVersion >= 0 && undoRef.current.length > 0,
    canRedo: historyVersion >= 0 && redoRef.current.length > 0,
    undo,
    redo,
    setDrumHit: (patternId, step, pad, velocity) => setProject((current) => setPatternHit(current, patternId, step, pad, velocity)),
    patchPattern: (patternId, patch) => setProject((current) => ({
      ...current,
      patterns: current.patterns.map((pattern) => pattern.id === patternId ? {
        ...pattern,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.bars !== undefined ? { bars: Math.max(1, Math.min(4, Math.round(patch.bars))), hits: pattern.hits.filter((hit) => hit.step < patch.bars! * 16) } : {}),
        ...(patch.swing !== undefined ? { swing: Math.max(0, Math.min(0.75, patch.swing)) } : {}),
      } : pattern),
    })),
    newPattern: () => setProject((current) => ({ ...current, patterns: [...current.patterns, createPattern(`Pattern ${current.patterns.length + 1}`)] })),
    copyPattern: (patternId) => setProject((current) => duplicatePattern(current, patternId)),
    placePattern: (patternId, kitId) => setProject((current) => {
      const trackId = armedTrackIdRef.current ?? current.tracks[0]?.id;
      return trackId ? addDrumClip(current, trackId, patternId, kitId, Math.ceil(playheadRef.current / 4) * 4) : current;
    }),
    copyKit: (kitId) => setProject((current) => {
      const kit = current.kits.find((item) => item.id === kitId);
      return kit ? { ...current, kits: [...current.kits, { ...kit, id: studioId('kit'), name: `${kit.name} Copy`, palette: 'custom' as const, pads: kit.pads.map((pad) => ({ ...pad })) }] } : current;
    }),
    reuseKit,
    renameKit: (kitId, name) => setProject((current) => ({ ...current, kits: current.kits.map((kit) => kit.id === kitId ? { ...kit, name } : kit) })),
    patchPad: (kitId, padIndex, patch) => setProject((current) => ({
      ...current,
      kits: current.kits.map((kit) => kit.id === kitId ? { ...kit, pads: kit.pads.map((pad, index) => index === padIndex ? { ...pad, ...patch } : pad) } : kit),
    })),
    importPadSample,
    dismissError: useCallback(() => setError(null), []),
    dismissNotice: useCallback(() => setNotice(null), []),

    togglePlay,
    stop,
    setBpm: useCallback((bpm) => setProject((c) => ({ ...c, bpm: clampBpm(bpm) })), []),
    rename: useCallback((name) => setProject((c) => ({ ...c, name })), []),
    createLocalProject,
    openLocalProject,
    renameLocalProject,
    duplicateLocalProject,
    deleteLocalProject,

    importFiles,
    placeClip,
    duplicateClip: (clipId) => setProject((current) => duplicateClip(current, clipId)),
    splitClip: (clipId, atBeat) => setProject((current) => splitAudioClip(current, clipId, atBeat)),
    trimClip: (clipId, edge, amountBeats) => setProject((current) => trimAudioClip(current, clipId, edge, amountBeats)),
    patchClip: (clipId, patch) => setProject((current) => patchAudioClip(current, clipId, patch)),
    dropClip: useCallback(
      (clipId: string) => {
        const current = projectRef.current;
        const removed = current.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
        setProject((c) => removeClip(c, clipId));
        if (!removed) return;
        // A buffer isn't owned by one clip: it can sit on several tracks at
        // once, or still be visible in the unplaced-clips library for
        // re-placement. Only release it once nothing references it anymore --
        // otherwise a mic take (which never enters the library) leaks its
        // buffer forever once its one placement is deleted, but releasing
        // unconditionally would break playback of any other clip sharing it.
        const stillNeeded =
          clips.some((imported) => imported.id === removed.bufferId) ||
          current.tracks.some((track) =>
            track.clips.some((clip) => clip.bufferId === removed.bufferId && clip.id !== clipId),
          );
        if (!stillNeeded) releaseBuffer(removed.bufferId);
      },
      [clips],
    ),
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
    patchNote: (trackId, noteId, patch) => setProject((current) => patchNote(current, trackId, noteId, patch)),
    quantizeNotes: (trackId) => setProject((current) => quantizeTrackNotes(current, trackId)),
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
    exportProject,
    openProject,
  };
}

/**
 * The studio: import stems, arrange them on a grid, mix, and export.
 *
 * Also the game's most accurate music source -- while the transport runs it
 * publishes an exact beat grid, so anything on screen that reacts to music is
 * reacting to ground truth rather than to a tempo estimate.
 *
 * Owned by the design pass -- keep the export name and props stable, and keep
 * every control wired.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileAudio,
  FileJson,
  FolderOpen,
  ListMusic,
  Mic,
  MicOff,
  Monitor,
  Music4,
  Pause,
  Play,
  Plus,
  Smartphone,
  Square,
  Trash2,
  Upload,
  X,
  BookOpen,
} from 'lucide-react';

import { ScreenLayout } from './ScreenLayout';
import { ArrangeView } from './studio/ArrangeView';
import { PadGrid } from './studio/PadGrid';
import { StepSequencer } from './studio/StepSequencer';
import { PianoRoll } from './studio/PianoRoll';
import { PluginRack } from './studio/PluginRack';
import { StudioProjectBrowser } from './studio/StudioProjectBrowser';
import { useStudio } from './studio/useStudio';
import { useAudioFrame } from '@/game/audio/useAudioFrame';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { EFFECTS, findEffect } from '@/game/audio/studio/effects';
import { INSTRUMENTS } from '@/game/audio/studio/instruments';
import { useMeta } from '@/game/state/metaStore';
import { MAX_BPM, MIN_BPM } from '@/game/audio/studio/project';
import { JERAMY_FROGSTER } from '@/game/data/npcCast';
import { RigPortrait } from './RigPortrait';
import { LorePopup } from './LorePopup';

const STUDIO_TABS = [
  { id: 'clips', label: 'Clips' },
  { id: 'arrange', label: 'Arrange' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'keys', label: 'Keys' },
  { id: 'pads', label: 'Pads' },
] as const;
type StudioTab = (typeof STUDIO_TABS)[number]['id'];

export interface StudioScreenProps {
  onBack: () => void;
}

export function StudioScreen({ onBack }: StudioScreenProps) {
  const studio = useStudio();
  const { meta, setStudioLayout } = useMeta();
  const music = useMusicPlayer();
  const audioFrame = useAudioFrame();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<StudioTab>('arrange');
  const [showJeramyLore, setShowJeramyLore] = useState(false);
  const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);

  const targetTrackId = studio.project.tracks[0]?.id;
  const hasInstrumentTrack = studio.project.tracks.some((track) => track.instrumentId);
  const armedTrack = studio.project.tracks.find((track) => track.id === studio.armedTrackId) ?? null;
  const selectedAudioClip = studio.project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);

  // 'auto' follows the device's own viewport; 'mobile'/'desktop' force a
  // layout regardless of it, so a phone can opt into the full mixer and a
  // desktop tester can preview the tabbed layout without resizing anything.
  const isMobileViewport = useIsMobile();
  const mobileMode = meta.studioLayout === 'desktop' ? false : meta.studioLayout === 'mobile' ? true : isMobileViewport;
  const activeTab = mobileTab === 'keys' && !hasInstrumentTrack ? 'arrange' : mobileTab;

  useEffect(() => {
    setSelectedClipId(null);
  }, [studio.activeProjectId]);

  useEffect(() => {
    // Excludes the currently-playing track when there's a choice: playTrack()
    // toggles play/pause when handed the id already playing, so re-picking it
    // would silently pause the room instead of starting a fresh song.
    const pool = music.tracks.filter((track) => track.id !== music.currentTrack?.id);
    const candidates = pool.length > 0 ? pool : music.tracks;
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
    music.playTrack(pick.id);
    // Runs once per visit to the Studio, not on every re-render (mixer edits,
    // transport changes) or every soundtrack tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ambianceStyle = {
    background: `radial-gradient(circle at 25% 15%, hsla(${
      200 - audioFrame.bands.high * 160
    }, 85%, 55%, ${0.22 + audioFrame.bands.high * 0.3}) 0%, transparent 85%),
      radial-gradient(circle at 80% 85%, hsla(${
        350 - audioFrame.bands.bass * 60
      }, 85%, 50%, ${0.22 + audioFrame.bands.bass * 0.35}) 0%, transparent 90%)`,
    opacity: 0.65 + audioFrame.energy * 0.35,
    transition: 'background 100ms linear, opacity 100ms linear',
  };

  // ---- panels, shared between the desktop grid and the mobile tab view ----

  const clipsPanel = (
    <section className="min-w-0">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Clips</h2>
      {studio.clips.length === 0 ? (
        <p className="border border-dashed border-border p-4 text-xs text-muted-foreground">
          Drop stems here, or use Import. Everything stays on this device.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="list-studio-clips">
          {studio.clips.map((clip) => (
            <li
              key={clip.id}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/studio-buffer', clip.id)}
              className={`flex items-center gap-2 border border-border bg-card/60 text-xs text-white ${
                mobileMode ? 'p-3' : 'p-2'
              }`}
            >
              <Music4 className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                {clip.name}
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {/* A low-confidence estimate is shown as a guess rather
                      than as a number the player might trust. */}
                  {clip.bpmConfidence > 0.35 ? `~${clip.estimatedBpm} bpm` : 'tempo unclear'}
                </span>
              </span>
              {targetTrackId && (
                <button
                  type="button"
                  onClick={() => studio.placeClip(clip.id, targetTrackId, 0)}
                  className={`shrink-0 text-muted-foreground transition-colors hover:text-primary ${
                    mobileMode ? 'p-2' : ''
                  }`}
                  aria-label={`Add ${clip.name} to first track`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => studio.discardImport(clip.id)}
                className={`shrink-0 text-muted-foreground transition-colors hover:text-destructive ${
                  mobileMode ? 'p-2' : ''
                }`}
                aria-label={`Remove ${clip.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const arrangePanel = (
    <div className="flex min-w-0 flex-col gap-6">
      <StepSequencer studio={studio} />
      <div className="min-w-0 overflow-x-auto">
        <ArrangeView
          project={studio.project}
          playheadRef={studio.playheadRef}
          playing={studio.playing}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
          onMoveClip={studio.relocateClip}
          onDropBuffer={studio.placeClip}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={studio.newTrack}
          className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
          data-testid="button-studio-add-track"
        >
          <Plus className="h-4 w-4" /> Track
        </button>
        {selectedClipId && (
          <button type="button" onClick={() => studio.duplicateClip(selectedClipId)} className="border border-border bg-card px-3 py-2 text-xs font-bold uppercase text-white">Duplicate clip</button>
        )}
        {selectedAudioClip && (
          <>
            <button type="button" onClick={() => studio.splitClip(selectedAudioClip.id, Math.max(selectedAudioClip.startBeat + 0.25, Math.min(selectedAudioClip.startBeat + selectedAudioClip.lengthBeats - 0.25, studio.playheadRef.current)))} className="border border-border bg-card px-3 py-2 text-xs font-bold uppercase text-white">Split at playhead</button>
            <button type="button" onClick={() => studio.trimClip(selectedAudioClip.id, 'start', 0.25)} className="border border-border bg-card px-3 py-2 text-xs font-bold uppercase text-white">Trim start +¼</button>
            <button type="button" onClick={() => studio.trimClip(selectedAudioClip.id, 'end', -0.25)} className="border border-border bg-card px-3 py-2 text-xs font-bold uppercase text-white">Trim end −¼</button>
            <label className="text-xs text-white">Clip gain <input type="range" min="0" max="2" step="0.05" value={selectedAudioClip.gain ?? 1} onChange={(event) => studio.patchClip(selectedAudioClip.id, { gain: Number(event.target.value) })} /></label>
            <label className="text-xs text-white">Fade in <input type="number" min="0" step="0.05" value={selectedAudioClip.fadeInSeconds ?? 0} onChange={(event) => studio.patchClip(selectedAudioClip.id, { fadeInSeconds: Number(event.target.value) })} className="w-16 border border-border bg-background px-1" />s</label>
            <label className="text-xs text-white">Fade out <input type="number" min="0" step="0.05" value={selectedAudioClip.fadeOutSeconds ?? 0} onChange={(event) => studio.patchClip(selectedAudioClip.id, { fadeOutSeconds: Number(event.target.value) })} className="w-16 border border-border bg-background px-1" />s</label>
          </>
        )}
        {selectedClipId && (
          <button
            type="button"
            onClick={() => {
              studio.dropClip(selectedClipId);
              setSelectedClipId(null);
            }}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-destructive hover:text-destructive"
            data-testid="button-studio-delete-clip"
          >
            <Trash2 className="h-4 w-4" /> Clip
          </button>
        )}
      </div>
    </div>
  );

  const mixerPanel = (
    <div
      className={mobileMode ? 'flex flex-col gap-4' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}
      data-testid="list-studio-tracks"
    >
      {studio.project.tracks.map((track) => (
        <div
          key={track.id}
          className={`flex flex-col gap-2 border border-border bg-card/60 ${mobileMode ? 'p-4' : 'p-3'}`}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={track.name}
              onChange={(event) => studio.patchTrack(track.id, { name: event.target.value })}
              aria-label="Track name"
              className="min-w-0 flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-white outline-none"
            />
            <button
              type="button"
              onClick={() => studio.dropTrack(track.id)}
              disabled={studio.project.tracks.length <= 1}
              className={`text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30 ${
                mobileMode ? 'p-2' : ''
              }`}
              aria-label={`Remove ${track.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={track.gain}
              onChange={(event) =>
                studio.patchTrack(track.id, {
                  gain: Number(event.target.value),
                })
              }
              className="min-w-0 flex-1"
              aria-label={`${track.name} volume`}
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Pan
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={track.pan}
              onChange={(event) => studio.patchTrack(track.id, { pan: Number(event.target.value) })}
              className="min-w-0 flex-1"
              aria-label={`${track.name} pan`}
            />
          </label>

          {/* An instrument track and an audio track differ only by
              this field, so the mixer above applies to both. */}
          <select
            value={track.instrumentId ?? ''}
            onChange={(event) => studio.setInstrument(track.id, event.target.value || undefined)}
            className={`border border-border bg-background px-2 text-[10px] uppercase tracking-widest text-muted-foreground ${
              mobileMode ? 'py-2' : 'py-1'
            }`}
            aria-label={`Instrument for ${track.name}`}
            data-testid={`select-instrument-${track.id}`}
          >
            <option value="">Audio clips</option>
            {INSTRUMENTS.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => studio.patchTrack(track.id, { muted: !track.muted })}
              className={`flex-1 border px-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                mobileMode ? 'py-3' : 'py-1'
              } ${
                track.muted
                  ? 'border-destructive bg-destructive/20 text-destructive'
                  : 'border-border text-muted-foreground hover:text-white'
              }`}
              data-testid={`button-mute-${track.id}`}
            >
              Mute
            </button>
            <button
              type="button"
              onClick={() => studio.solo(track.id)}
              className={`flex-1 border px-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                mobileMode ? 'py-3' : 'py-1'
              } ${
                track.soloed
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-white'
              }`}
              data-testid={`button-solo-${track.id}`}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => studio.armTrack(track.id)}
              aria-pressed={studio.armedTrackId === track.id}
              title={track.instrumentId ? 'Arm to record pad taps as notes' : 'Arm to record a microphone take'}
              className={`flex-1 border px-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                mobileMode ? 'py-3' : 'py-1'
              } ${
                studio.armedTrackId === track.id
                  ? 'border-destructive bg-destructive/20 text-destructive'
                  : 'border-border text-muted-foreground hover:text-white'
              }`}
              data-testid={`button-arm-${track.id}`}
            >
              Arm
            </button>
          </div>

          {/* insert chain -- order here is the signal path */}
          {track.effects.map((effect) => {
            const def = findEffect(effect.effectId);
            if (!def) return null;
            return (
              <div key={effect.id} className="border border-border/60 bg-background/40 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{def.label}</span>
                  <button
                    type="button"
                    onClick={() => studio.dropEffect(track.id, effect.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${def.label} from ${track.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {def.params.map((param) => (
                  <label
                    key={param.id}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    <span className="w-14 shrink-0">{param.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={effect.params[param.id] ?? param.defaultValue}
                      onChange={(event) =>
                        studio.tweakEffect(track.id, effect.id, param.id, Number(event.target.value))
                      }
                      className="min-w-0 flex-1"
                      aria-label={`${def.label} ${param.label} on ${track.name}`}
                    />
                  </label>
                ))}
              </div>
            );
          })}

          <select
            value=""
            onChange={(event) => {
              if (event.target.value) studio.insertEffect(track.id, event.target.value);
              event.target.value = '';
            }}
            className={`border border-border bg-background px-2 text-[10px] uppercase tracking-widest text-muted-foreground ${
              mobileMode ? 'py-2' : 'py-1'
            }`}
            aria-label={`Add an effect to ${track.name}`}
            data-testid={`select-effect-${track.id}`}
          >
            <option value="">+ Effect</option>
            {EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>

          {meta.studioPluginsEnabled && <PluginRack trackId={track.id} trackName={track.name} graph={studio.graph} />}
        </div>
      ))}
    </div>
  );

  const keysPanel = (
    <div className="flex flex-col gap-6">
      {studio.project.tracks
        .filter((track) => track.instrumentId)
        .map((track) => (
          <PianoRoll
            key={track.id}
            track={track}
            beatsPerBar={studio.project.beatsPerBar}
            playheadRef={studio.playheadRef}
            playing={studio.playing}
            onAddNote={(note) => studio.placeNote(track.id, note)}
            onMoveNote={(noteId, pitch, startBeat) => studio.relocateNote(track.id, noteId, pitch, startBeat)}
            onRemoveNote={(noteId) => studio.dropNote(track.id, noteId)}
            onPatchNote={(noteId, patch) => studio.patchNote(track.id, noteId, patch)}
            onQuantize={() => studio.quantizeNotes(track.id)}
          />
        ))}
    </div>
  );

  const padsPanel = (
    <PadGrid
      destination={studio.master}
      playing={studio.playing}
      playheadRef={studio.playheadRef}
      armedInstrumentId={armedTrack?.instrumentId}
      onRecordNote={armedTrack?.instrumentId ? (note) => studio.placeNote(armedTrack.id, note) : undefined}
    />
  );

  return (
    <ScreenLayout title="Studio" subtitle="Gorilla Studios · 616 Records" onBack={onBack}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        data-testid="studio-ambiance"
        style={ambianceStyle}
      />
      <div
        className="relative z-10 flex min-w-0 flex-col gap-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // Dropping anywhere but a lane imports without placing; the lane's own
          // handler stops propagation of drops it consumes.
          if (event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          void studio.importFiles(event.dataTransfer.files);
        }}
      >
        <section className="flex flex-wrap items-center gap-4 border border-fuchsia-300/35 bg-slate-950/75 p-3 sm:p-4" data-testid="studio-jeramy-host">
          <div className="grid h-28 w-28 shrink-0 place-items-center border border-cyan-300/40 bg-violet-950/70" data-testid="portrait-jeramy-frogster">
            <RigPortrait rig={JERAMY_FROGSTER.rig} palette={JERAMY_FROGSTER.palette} size={108} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Gorilla Studios · Room engineer</p>
            <h2 className="text-xl font-black text-white">Jeramy</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/70">Same silver hair and sharp glasses as his twin Jeremey at the Circuit Frog Ranch. Jeramy keeps the boards warm and gives every survivor a place to turn a rough night into a track.</p>
          </div>
          <button type="button" onClick={() => setShowJeramyLore(true)} className="flex min-h-10 items-center gap-2 border border-fuchsia-300/50 px-3 font-mono text-xs font-bold uppercase text-fuchsia-100 hover:bg-fuchsia-300/10" data-testid="button-jeramy-lore"><BookOpen size={15} /> Meet the twins</button>
        </section>
        {/* ---- transport ---- */}
        <div className="flex flex-wrap items-center gap-3 border border-border bg-card/60 p-4">
          <button
            type="button"
            onClick={studio.togglePlay}
            className="flex h-11 w-11 items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-white"
            style={{ touchAction: 'none' }}
            data-testid="button-studio-play"
            aria-label={studio.playing ? 'Pause' : 'Play'}
          >
            {studio.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={studio.stop}
            className="flex h-11 w-11 items-center justify-center border border-border bg-card text-white transition-colors hover:border-primary hover:text-primary"
            style={{ touchAction: 'none' }}
            data-testid="button-studio-stop"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
          <button type="button" onClick={studio.undo} disabled={!studio.canUndo} aria-label="Undo edit" title="Undo (Ctrl+Z)" className="border border-border px-3 py-2 text-xs text-white disabled:opacity-30">Undo</button>
          <button type="button" onClick={studio.redo} disabled={!studio.canRedo} aria-label="Redo edit" title="Redo (Ctrl+Shift+Z)" className="border border-border px-3 py-2 text-xs text-white disabled:opacity-30">Redo</button>
          <div className="flex w-20 flex-col gap-1" title="Master input level before limiter"><span className="text-[9px] uppercase text-muted-foreground">Master</span><div className="h-2 border border-border bg-background"><div className={`h-full ${studio.masterPeak >= 0.99 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, studio.masterPeak * 100)}%` }} /></div><span className="text-[9px] text-muted-foreground">{studio.masterPeak >= 0.99 ? 'Clip' : `${Math.round(studio.masterPeak * 100)}%`}</span></div>
          <button
            type="button"
            onClick={() => (studio.recordingMic ? studio.stopMicRecording() : void studio.startMicRecording())}
            disabled={studio.countingIn}
            className={`flex h-11 w-11 items-center justify-center border transition-colors ${
              studio.recordingMic
                ? 'animate-pulse border-destructive bg-destructive/20 text-destructive'
                : 'border-border bg-card text-white hover:border-primary hover:text-primary'
            }`}
            style={{ touchAction: 'none' }}
            data-testid="button-studio-record"
            aria-label={studio.recordingMic ? 'Stop recording' : 'Record from microphone'}
            title="Record the armed track from your microphone"
          >
            {studio.micSupported ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <label className="flex items-center gap-1 text-xs text-white"><input type="checkbox" checked={studio.metronomeEnabled} onChange={(event) => studio.setMetronomeEnabled(event.target.checked)} /> Click</label>
          <label className="flex items-center gap-1 text-xs text-white"><input type="checkbox" checked={studio.loopEnabled} onChange={(event) => studio.setLoopEnabled(event.target.checked)} /> Loop</label>
          <label className="text-xs text-muted-foreground">Count in <select value={studio.countInBars} onChange={(event) => studio.setCountInBars(Number(event.target.value))} className="border border-border bg-background px-1 text-white"><option value={0}>Off</option><option value={1}>1 bar</option><option value={2}>2 bars</option></select></label>
          {studio.countingIn && <span className="text-xs font-bold text-primary">Counting in…</span>}
          <div className="flex w-20 flex-col gap-1" title="Microphone input level"><span className="text-[9px] uppercase text-muted-foreground">Input</span><div className="h-2 border border-border bg-background"><div className={`h-full ${studio.inputPeak >= 0.99 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, studio.inputPeak * 100)}%` }} /></div><span className="text-[9px] text-muted-foreground">{studio.inputPeak >= 0.99 ? 'Clip' : `${Math.round(studio.inputPeak * 100)}%`}</span></div>
          <label className="text-xs text-muted-foreground" title="If a take lands late, enter a positive offset to move it earlier">Mic offset <input type="number" min="-500" max="500" step="10" value={studio.recordOffsetMs} onChange={(event) => studio.setRecordOffsetMs(Number(event.target.value))} className="w-16 border border-border bg-background px-1 text-white" /> ms</label>

          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            BPM
            <input
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              value={studio.project.bpm}
              onChange={(event) => studio.setBpm(Number(event.target.value))}
              className="w-20 border border-border bg-background px-2 py-1 text-base font-bold text-white"
              data-testid="input-studio-bpm"
            />
          </label>

          <input
            type="text"
            value={studio.project.name}
            onChange={(event) => studio.rename(event.target.value)}
            placeholder="Untitled"
            aria-label="Project name"
            className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-white"
            data-testid="input-studio-name"
          />

          <button
            type="button"
            onClick={() => setProjectBrowserOpen((open) => !open)}
            disabled={
              studio.persistenceState === 'loading' ||
              studio.persistenceState === 'session-only' ||
              studio.busy !== null ||
              studio.recordingMic
            }
            aria-expanded={projectBrowserOpen}
            className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
              projectBrowserOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-white hover:border-primary hover:text-primary'
            }`}
            data-testid="button-studio-projects"
          >
            <FolderOpen className="h-4 w-4" /> Projects ({studio.projects.length})
          </button>

          {/* The main way a finished beat leaves the studio: it becomes an
              ordinary soundtrack track, and the game reacts to it from there.
              These are direct children of the transport bar's own flex-wrap
              (not grouped in a nested flex container) so each button wraps
              to its own line on a narrow screen instead of the whole group
              overflowing -- a flex-wrap container's intrinsic width is the
              sum of its children as if nothing wrapped, so nesting one
              inside another flex-wrap row does not let it shrink to fit. */}
          <button
            type="button"
            onClick={() => void studio.sendToSoundtrack()}
            disabled={studio.busy !== null}
            className="flex items-center gap-2 bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-white disabled:opacity-50"
            data-testid="button-studio-to-soundtrack"
          >
            <ListMusic className="h-4 w-4" /> To Soundtrack
          </button>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
            data-testid="button-studio-import"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            type="button"
            onClick={() => void studio.exportWav()}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
            data-testid="button-studio-export-wav"
          >
            <FileAudio className="h-4 w-4" /> WAV
          </button>
          <button
            type="button"
            onClick={() => void studio.exportProject()}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
            data-testid="button-studio-export-project"
          >
            <FileJson className="h-4 w-4" /> Backup
          </button>
          <button
            type="button"
            onClick={() => projectInputRef.current?.click()}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
            data-testid="button-studio-open-project"
          >
            <Download className="h-4 w-4" /> Open
          </button>

          <div className="flex shrink-0 border border-border" role="group" aria-label="Studio layout">
            <button
              type="button"
              onClick={() => setStudioLayout('auto')}
              aria-pressed={meta.studioLayout === 'auto'}
              aria-label="Automatic layout"
              title="Automatic (follows this device)"
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                meta.studioLayout === 'auto'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-white'
              }`}
              data-testid="button-studio-layout-auto"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setStudioLayout('mobile')}
              aria-pressed={meta.studioLayout === 'mobile'}
              aria-label="Mobile layout"
              title="Mobile layout"
              className={`flex items-center border-l border-border px-3 py-2 transition-colors ${
                meta.studioLayout === 'mobile'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-white'
              }`}
              data-testid="button-studio-layout-mobile"
            >
              <Smartphone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStudioLayout('desktop')}
              aria-pressed={meta.studioLayout === 'desktop'}
              aria-label="Desktop layout"
              title="Desktop layout"
              className={`flex items-center border-l border-border px-3 py-2 transition-colors ${
                meta.studioLayout === 'desktop'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-white'
              }`}
              data-testid="button-studio-layout-desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>

          <p
            className="basis-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            data-testid="text-studio-persistence"
            aria-live="polite"
          >
            Local only ·{' '}
            {studio.persistenceState === 'loading'
              ? 'restoring project…'
              : studio.persistenceState === 'saving'
                ? 'saving…'
                : studio.persistenceState === 'session-only'
                  ? 'session only — export a backup'
                  : `saved on this device${studio.restoredAssetCount > 0 ? ` · ${studio.restoredAssetCount} sources restored` : ''}`}
          </p>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            data-testid="input-studio-audio"
            onChange={(event) => {
              if (event.target.files) void studio.importFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            ref={projectInputRef}
            type="file"
            accept=".616project,.616song,application/zip,application/json"
            className="hidden"
            data-testid="input-studio-project"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void studio.openProject(file);
              event.target.value = '';
            }}
          />
        </div>

        {projectBrowserOpen ? (
          <StudioProjectBrowser
            projects={studio.projects}
            activeProjectId={studio.activeProjectId}
            busy={
              studio.busy !== null ||
              studio.persistenceState === 'loading' ||
              studio.persistenceState === 'session-only' ||
              studio.recordingMic
            }
            onClose={() => setProjectBrowserOpen(false)}
            onCreate={studio.createLocalProject}
            onOpen={studio.openLocalProject}
            onRename={studio.renameLocalProject}
            onDuplicate={studio.duplicateLocalProject}
            onDelete={studio.deleteLocalProject}
          />
        ) : null}

        {studio.busy && (
          <p className="text-xs uppercase tracking-widest text-primary" data-testid="text-studio-busy">
            {studio.busy}
          </p>
        )}
        {studio.notice && (
          <div
            className="flex items-start justify-between gap-4 border border-primary/50 bg-primary/10 p-3 text-sm text-primary"
            data-testid="text-studio-notice"
          >
            <p className="whitespace-pre-line">{studio.notice}</p>
            <button type="button" onClick={studio.dismissNotice} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {studio.error && (
          <div
            className="flex items-start justify-between gap-4 border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            data-testid="text-studio-error"
          >
            <p className="whitespace-pre-line">{studio.error}</p>
            <button type="button" onClick={studio.dismissError} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {mobileMode ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div
              className="flex gap-1 overflow-x-auto border border-border bg-card/60 p-1"
              role="tablist"
              aria-label="Studio sections"
            >
              {STUDIO_TABS.filter((tab) => tab.id !== 'keys' || hasInstrumentTrack).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setMobileTab(tab.id)}
                  className={`min-w-[72px] flex-1 whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                  data-testid={`tab-studio-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="min-w-0">
              {activeTab === 'clips' && clipsPanel}
              {activeTab === 'arrange' && arrangePanel}
              {activeTab === 'mixer' && mixerPanel}
              {activeTab === 'keys' && keysPanel}
              {activeTab === 'pads' && padsPanel}
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {clipsPanel}
            <section className="flex min-w-0 flex-col gap-6">
              {arrangePanel}
              {mixerPanel}
              {hasInstrumentTrack && keysPanel}
              {padsPanel}
            </section>
          </div>
        )}
      </div>
      {showJeramyLore && <LorePopup onClose={() => setShowJeramyLore(false)} initialChapterId={JERAMY_FROGSTER.loreId} />}
    </ScreenLayout>
  );
}

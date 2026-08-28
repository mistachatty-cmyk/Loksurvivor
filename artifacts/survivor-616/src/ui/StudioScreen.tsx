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

import { useRef, useState } from 'react';
import {
  Download,
  FileAudio,
  FileJson,
  ListMusic,
  Music4,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { ScreenLayout } from './ScreenLayout';
import { ArrangeView } from './studio/ArrangeView';
import { PadGrid } from './studio/PadGrid';
import { PianoRoll } from './studio/PianoRoll';
import { PluginRack } from './studio/PluginRack';
import { useStudio } from './studio/useStudio';
import { EFFECTS, findEffect } from '@/game/audio/studio/effects';
import { INSTRUMENTS } from '@/game/audio/studio/instruments';
import { useMeta } from '@/game/state/metaStore';
import { MAX_BPM, MIN_BPM } from '@/game/audio/studio/project';

export interface StudioScreenProps {
  onBack: () => void;
}

export function StudioScreen({ onBack }: StudioScreenProps) {
  const studio = useStudio();
  const { meta } = useMeta();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const targetTrackId = studio.project.tracks[0]?.id;

  return (
    <ScreenLayout title="Studio" subtitle="616 Records" onBack={onBack}>
      <div
        className="flex min-w-0 flex-col gap-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // Dropping anywhere but a lane imports without placing; the lane's own
          // handler stops propagation of drops it consumes.
          if (event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          void studio.importFiles(event.dataTransfer.files);
        }}
      >
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

          <div className="flex shrink-0 gap-2">
            {/* The main way a finished beat leaves the studio: it becomes an
                ordinary soundtrack track, and the game reacts to it from there. */}
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
              onClick={studio.exportProject}
              className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
              data-testid="button-studio-export-project"
            >
              <FileJson className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              onClick={() => projectInputRef.current?.click()}
              className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-primary hover:text-primary"
              data-testid="button-studio-open-project"
            >
              <Download className="h-4 w-4" /> Open
            </button>
          </div>

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
            accept=".616song,application/json"
            className="hidden"
            data-testid="input-studio-project"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void studio.openProject(file);
              event.target.value = '';
            }}
          />
        </div>

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

        <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* ---- clip library ---- */}
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
                    className="flex items-center gap-2 border border-border bg-card/60 p-2 text-xs text-white"
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
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        aria-label={`Add ${clip.name} to first track`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => studio.discardImport(clip.id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${clip.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- arrangement + mixer ---- */}
          <section className="flex min-w-0 flex-col gap-6">
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="list-studio-tracks">
              {studio.project.tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-2 border border-border bg-card/60 p-3">
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
                      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
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
                      onChange={(event) => studio.patchTrack(track.id, { gain: Number(event.target.value) })}
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
                    className="border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
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
                      className={`flex-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
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
                      className={`flex-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        track.soloed
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-border text-muted-foreground hover:text-white'
                      }`}
                      data-testid={`button-solo-${track.id}`}
                    >
                      Solo
                    </button>
                  </div>

                  {/* insert chain -- order here is the signal path */}
                  {track.effects.map((effect) => {
                    const def = findEffect(effect.effectId);
                    if (!def) return null;
                    return (
                      <div key={effect.id} className="border border-border/60 bg-background/40 p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {def.label}
                          </span>
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
                    className="border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
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

                  {meta.studioPluginsEnabled && (
                    <PluginRack trackId={track.id} trackName={track.name} graph={studio.graph} />
                  )}
                </div>
              ))}
            </div>

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
                  onMoveNote={(noteId, pitch, startBeat) =>
                    studio.relocateNote(track.id, noteId, pitch, startBeat)
                  }
                  onRemoveNote={(noteId) => studio.dropNote(track.id, noteId)}
                />
              ))}

            <PadGrid destination={studio.master} />
          </section>
        </div>
      </div>
    </ScreenLayout>
  );
}

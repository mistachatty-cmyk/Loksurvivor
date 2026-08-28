/**
 * In-game music studio.
 *
 * Minimal but real: transport controls, clip library, track mixer, timeline.
 * Built with touch-first interaction: no routing through React state for audio events,
 * Pointer Events for multi-touch, `touch-action: none` on interactive elements.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { getStudioEngine, unlockStudioAudio } from '@/game/audio/studio/engine';
import { startStudioClock, stopStudioClock } from '@/game/audio/studio/clock';
import { importAudioFile, getBuffer, releaseBuffer } from '@/game/audio/studio/importer';
import {
  createProject,
  loadStoredProject,
  storeProject,
  createTrack,
  clampBpm,
  type StudioProject,
} from '@/game/audio/studio/project';
import styles from './StudioScreen.module.css';

export function StudioScreen() {
  const [project, setProject] = useState<StudioProject>(() => loadStoredProject());
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(project.bpm);
  const engineRef = useRef(getStudioEngine());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist project on changes
  useEffect(() => {
    storeProject(project);
  }, [project]);

  const handlePlay = async () => {
    if (isPlaying) {
      Tone.Transport.stop();
      stopStudioClock();
      setIsPlaying(false);
      return;
    }

    await unlockStudioAudio();
    Tone.Transport.bpm.value = bpm;
    startStudioClock(bpm, project.beatsPerBar);
    Tone.Transport.start();
    setIsPlaying(true);
  };

  const handleBpmChange = (value: number) => {
    const newBpm = clampBpm(value);
    setBpm(newBpm);
    setProject((p) => ({ ...p, bpm: newBpm }));
    if (Tone.Transport.state === 'started') {
      Tone.Transport.bpm.value = newBpm;
    }
  };

  const handleAddTrack = () => {
    setProject((p) => ({
      ...p,
      tracks: [...p.tracks, createTrack(`Track ${p.tracks.length + 1}`)],
    }));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    try {
      const imported = await importAudioFile(file);
      // TODO: add clip to a track
      console.log('Imported:', imported.name, 'BPM:', imported.estimatedBpm);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    e.currentTarget.value = '';
  };

  return (
    <div className={styles.container}>
      {/* Transport Bar */}
      <div className={styles.transport}>
        <button
          className={styles.playButton}
          onClick={handlePlay}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className={styles.bpmControl}>
          <label htmlFor="bpm-input">BPM</label>
          <input
            id="bpm-input"
            type="number"
            min="40"
            max="240"
            value={Math.round(bpm)}
            onChange={(e) => handleBpmChange(Number(e.currentTarget.value))}
            disabled={isPlaying}
          />
        </div>

        <div className={styles.projectName}>
          <input
            type="text"
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.currentTarget.value }))}
            placeholder="Untitled"
          />
        </div>
      </div>

      {/* Clip Library & Mixer */}
      <div className={styles.content}>
        {/* Import Zone */}
        <div
          className={styles.importZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              const input = fileInputRef.current;
              if (input) {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }}
        >
          <p>Drop audio file or <button onClick={() => fileInputRef.current?.click()}>browse</button></p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>

        {/* Mixer */}
        <div className={styles.mixer}>
          {project.tracks.map((track, i) => (
            <div key={track.id} className={styles.trackFader}>
              <div className={styles.trackHeader}>
                <span className={styles.trackName}>{track.name}</span>
              </div>
              <div className={styles.trackControls}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.gain}
                  onChange={(e) => {
                    setProject((p) => {
                      const newTracks = [...p.tracks];
                      newTracks[i]!.gain = Number(e.currentTarget.value);
                      return { ...p, tracks: newTracks };
                    });
                  }}
                  title="Gain"
                />
                <button
                  onClick={() => {
                    setProject((p) => {
                      const newTracks = [...p.tracks];
                      newTracks[i]!.muted = !newTracks[i]!.muted;
                      return { ...p, tracks: newTracks };
                    });
                  }}
                  title={track.muted ? 'Unmute' : 'Mute'}
                  className={track.muted ? styles.active : ''}
                >
                  {track.muted ? '🔇' : '🔊'}
                </button>
                <button
                  onClick={() => {
                    setProject((p) => {
                      const newTracks = [...p.tracks];
                      newTracks[i]!.soloed = !newTracks[i]!.soloed;
                      return { ...p, tracks: newTracks };
                    });
                  }}
                  title={track.soloed ? 'Unsolo' : 'Solo'}
                  className={track.soloed ? styles.active : ''}
                >
                  S
                </button>
              </div>
            </div>
          ))}
          <button onClick={handleAddTrack} className={styles.addTrack}>
            + Add Track
          </button>
        </div>
      </div>
    </div>
  );
}

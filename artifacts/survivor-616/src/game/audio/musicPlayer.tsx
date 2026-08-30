/**
 * Soundtrack player.
 *
 * The player picks audio files off their own device -- released tracks,
 * unreleased demos, whatever they want scoring the run. Files never leave
 * the browser: each one becomes an object URL that is revoked when the
 * track is removed or the tab closes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MusicAnalyser } from './analysis';
import { beatBus } from './beatBus';
import dontFly from '@assets/Don\'t_Fly_1787686881680.mp3?url';
import fat from '@assets/F.A.T.$_2_1787686881680.m4a?url';
import layback from '@assets/Layback_1787686881680.wav?url';
import dodds from '@assets/Dodds_Ave_289-~Somethin_1787686881680.m4a?url';
import rbm from '@assets/RBM_1787686881680.m4a?url';
import neverMind from '@assets/NeverMind-Brkn-Part2_1787686881680.mp3?url';
import demoTape from '@assets/That_One_Song-Demo_Tape_1787686881680.mp3?url';
import goinLoco from '@assets/Goin_Loco_Mary_Sue_1787686881680.mp3?url';
import dontFly2 from '@assets/Don\'t_Fly_2_1787686881680.mp3?url';

export interface Track {
  id: string;
  /** Display name, defaults to the filename without extension. */
  title: string;
  /** Object URL for the local file. */
  url: string;
  /** Bytes, used for the "local file" label. */
  size: number;
  /** Seconds; filled in once metadata loads. */
  duration: number | null;
  source: 'bundled' | 'local';
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface MusicPlayerValue {
  tracks: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  progressSec: number;
  durationSec: number;
  error: string | null;
  addFiles: (files: FileList | File[]) => number;
  removeTrack: (id: string) => void;
  clearTracks: () => void;
  playTrack: (id: string) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  dismissError: () => void;
  /**
   * The one `AudioContext` the app owns, or null before playback has unlocked
   * it. The studio adopts this rather than creating a second context -- two
   * contexts fight over the output device and iOS suspends one of them.
   */
  getAudioContext: () => AudioContext | null;
}

const MusicContext = createContext<MusicPlayerValue | null>(null);

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i;

const BUNDLED_TRACKS: Track[] = ([
  { id: 'dont-fly', title: "Don't Fly", url: dontFly, source: 'bundled' },
  { id: 'fat-2', title: 'F.A.T.$ 2', url: fat, source: 'bundled' },
  { id: 'layback', title: 'Layback', url: layback, source: 'bundled' },
  { id: 'dodds-ave-somethin', title: 'Dodds Ave ~ Somethin', url: dodds, source: 'bundled' },
  { id: 'rbm', title: 'RBM', url: rbm, source: 'bundled' },
  { id: 'never-mind-brkn-part-2', title: 'NeverMind — Brkn Part 2', url: neverMind, source: 'bundled' },
  { id: 'that-one-song-demo-tape', title: 'That One Song — Demo Tape', url: demoTape, source: 'bundled' },
  { id: 'goin-loco-mary-sue', title: 'Goin Loco — Mary Sue', url: goinLoco, source: 'bundled' },
  { id: 'dont-fly-2', title: "Don't Fly 2", url: dontFly2, source: 'bundled' },
] as const).map((track) => ({ ...track, size: 0, duration: null }));

function titleFromFile(file: File): string {
  return file.name.replace(AUDIO_EXTENSIONS, '').replace(/[_-]+/g, ' ').trim() || file.name;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analysisRef = useRef<MusicAnalyser | null>(null);

  const [tracks, setTracks] = useState<Track[]>(BUNDLED_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [progressSec, setProgressSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reactiveRootRef = useRef<HTMLDivElement | null>(null);

  tracksRef.current = tracks;

  // One audio element for the whole app so music survives screen changes.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const currentTrack = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null;

  const stopEnergyMeter = useCallback(() => {
    analysisRef.current?.stop();
    reactiveRootRef.current?.style.setProperty('--music-energy', '0');
  }, []);

  /**
   * Starts tempo/onset analysis of the playing track. The analyser owns the
   * only animation-frame loop here and publishes to `beatBus`; the CSS variable
   * this used to write directly is now just one consumer of that feed.
   */
  const startEnergyMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    if (!analysisRef.current) {
      analysisRef.current = new MusicAnalyser(analyser, {
        onEnergy: (energy) => {
          reactiveRootRef.current?.style.setProperty('--music-energy', String(energy));
        },
      });
    }
    analysisRef.current.start();
  }, []);

  const connectAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return;
    const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 1024;
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audio);
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume();
    } catch {
      // Playback still works if Web Audio analysis is unavailable.
    }
  }, []);

  const pickNextIndex = useCallback(
    (from: number, direction: 1 | -1): number => {
      const list = tracksRef.current;
      if (list.length === 0) return -1;
      if (shuffle && list.length > 1) {
        let candidate = from;
        while (candidate === from) {
          candidate = Math.floor(Math.random() * list.length);
        }
        return candidate;
      }
      const next = from + direction;
      if (next >= list.length) return repeat === 'off' ? -1 : 0;
      if (next < 0) return list.length - 1;
      return next;
    },
    [shuffle, repeat],
  );

  const playIndex = useCallback((index: number) => {
    const audio = audioRef.current;
    const track = tracksRef.current[index];
    if (!audio || !track) return;
    setCurrentIndex(index);
    audio.src = track.url;
    audio.currentTime = 0;
    // Track identity goes out on the beat bus, the one seam consumers read for
    // anything music-related. A now-playing cue watches for this changing
    // rather than subscribing to the player a second time.
    beatBus.publish({ track: { id: track.id, title: track.title } }, 'detected');
    void audio
      .play()
      .then(() => {
        connectAnalyser();
        // A new track has a new tempo -- drop the old grid rather than easing
        // toward the new one from a stale estimate.
        analysisRef.current?.reset();
        startEnergyMeter();
        setIsPlaying(true);
        setError(null);
      })
      .catch(() => {
        setIsPlaying(false);
        setError(`Could not play "${track.title}". The browser may not support this format.`);
      });
  }, [connectAnalyser, startEnergyMeter]);

  /* --------------------------------------------------------------- */
  /* Audio element wiring                                             */
  /* --------------------------------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setProgressSec(audio.currentTime);
    const onMeta = () => setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      stopEnergyMeter();
    };
    const onError = () => {
      setIsPlaying(false);
      const title = tracksRef.current[currentIndex]?.title;
      setError(title ? `"${title}" could not be decoded.` : 'That audio file could not be played.');
    };
    const onEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0;
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      const next = pickNextIndex(currentIndex, 1);
      if (next === -1) {
        setIsPlaying(false);
        return;
      }
      playIndex(next);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, pickNextIndex, playIndex, repeat, stopEnergyMeter]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Release every object URL when the app unmounts.
  useEffect(() => {
    return () => {
      for (const track of tracksRef.current) {
        if (track.source === 'local') URL.revokeObjectURL(track.url);
      }
      audioRef.current?.pause();
      stopEnergyMeter();
      analysisRef.current = null;
      beatBus.reset();
      void audioContextRef.current?.close();
    };
  }, [stopEnergyMeter]);

  /* --------------------------------------------------------------- */
  /* Playlist management                                              */
  /* --------------------------------------------------------------- */

  const addFiles = useCallback((files: FileList | File[]): number => {
    const incoming = Array.from(files);
    const accepted: Track[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      const looksAudio = file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name);
      if (!looksAudio) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        title: titleFromFile(file),
        url: URL.createObjectURL(file),
        size: file.size,
        duration: null,
        source: 'local',
      });
    }

    if (rejected.length > 0) {
      setError(
        rejected.length === 1
          ? `"${rejected[0]}" is not an audio file.`
          : `${rejected.length} files were skipped because they are not audio.`,
      );
    } else if (accepted.length > 0) {
      setError(null);
    }

    if (accepted.length > 0) {
      setTracks((prev) => {
        const merged = [...prev, ...accepted];
        tracksRef.current = merged;
        return merged;
      });
      // Read durations without disturbing playback.
      for (const track of accepted) {
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.src = track.url;
        probe.addEventListener('loadedmetadata', () => {
          const seconds = Number.isFinite(probe.duration) ? probe.duration : null;
          setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, duration: seconds } : t)));
        });
      }
    }

    return accepted.length;
  }, []);

  const removeTrack = useCallback(
    (id: string) => {
      setTracks((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        if (prev[index]!.source === 'bundled') return prev;
        if (prev[index]!.source === 'local') URL.revokeObjectURL(prev[index]!.url);
        const next = prev.filter((t) => t.id !== id);
        tracksRef.current = next;

        if (index === currentIndex) {
          audioRef.current?.pause();
          beatBus.publish({ track: null }, 'detected');
          setIsPlaying(false);
          setCurrentIndex(-1);
          setProgressSec(0);
          setDurationSec(0);
        } else if (index < currentIndex) {
          setCurrentIndex((i) => i - 1);
        }
        return next;
      });
    },
    [currentIndex],
  );

  const clearTracks = useCallback(() => {
    audioRef.current?.pause();
    for (const track of tracksRef.current) {
      if (track.source === 'local') URL.revokeObjectURL(track.url);
    }
    tracksRef.current = BUNDLED_TRACKS;
    setTracks(BUNDLED_TRACKS);
    beatBus.publish({ track: null }, 'detected');
    setCurrentIndex(-1);
    setIsPlaying(false);
    setProgressSec(0);
    setDurationSec(0);
  }, []);

  /* --------------------------------------------------------------- */
  /* Transport                                                        */
  /* --------------------------------------------------------------- */

  const playTrack = useCallback(
    (id: string) => {
      const index = tracksRef.current.findIndex((t) => t.id === id);
      if (index === -1) return;
      if (index === currentIndex && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        return;
      }
      playIndex(index);
    },
    [currentIndex, playIndex],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (tracksRef.current.length === 0) {
      setError('Load a few tracks first -- nothing is queued up.');
      return;
    }
    if (currentIndex === -1) {
      playIndex(0);
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => {
        setIsPlaying(false);
        setError('Playback was blocked. Tap play once more.');
      });
    } else {
      audio.pause();
    }
  }, [currentIndex, playIndex]);

  const next = useCallback(() => {
    const index = pickNextIndex(currentIndex, 1);
    if (index === -1) return;
    playIndex(index);
  }, [currentIndex, pickNextIndex, playIndex]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    // Standard behavior: restart the track if we are more than 3s in.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const index = pickNextIndex(currentIndex, -1);
    if (index === -1) return;
    playIndex(index);
  }, [currentIndex, pickNextIndex, playIndex]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    setProgressSec(audio.currentTime);
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );
  const dismissError = useCallback(() => setError(null), []);
  const getAudioContext = useCallback(() => audioContextRef.current, []);

  const value = useMemo<MusicPlayerValue>(
    () => ({
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      volume,
      muted,
      shuffle,
      repeat,
      progressSec,
      durationSec,
      error,
      addFiles,
      removeTrack,
      clearTracks,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      dismissError,
      getAudioContext,
    }),
    [
      tracks, currentTrack, currentIndex, isPlaying, volume, muted, shuffle, repeat,
      progressSec, durationSec, error, addFiles, removeTrack, clearTracks, playTrack,
      togglePlay, next, previous, seek, setVolume, toggleMute, toggleShuffle,
      cycleRepeat, dismissError, getAudioContext,
    ],
  );

  return (
    <MusicContext.Provider value={value}>
      <div
        className="music-reactive-root"
        ref={reactiveRootRef}
        style={{ '--music-energy': 0 } as CSSProperties}
      >
        {children}
      </div>
    </MusicContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerValue {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusicPlayer must be used inside <MusicProvider>');
  }
  return ctx;
}

export function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

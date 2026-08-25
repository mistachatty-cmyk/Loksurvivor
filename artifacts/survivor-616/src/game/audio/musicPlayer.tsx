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
  type ReactNode,
} from 'react';

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
}

const MusicContext = createContext<MusicPlayerValue | null>(null);

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i;

function titleFromFile(file: File): string {
  return file.name.replace(AUDIO_EXTENSIONS, '').replace(/[_-]+/g, ' ').trim() || file.name;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [progressSec, setProgressSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  tracksRef.current = tracks;

  // One audio element for the whole app so music survives screen changes.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const currentTrack = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null;

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
    void audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setError(null);
      })
      .catch(() => {
        setIsPlaying(false);
        setError(`Could not play "${track.title}". The browser may not support this format.`);
      });
  }, []);

  /* --------------------------------------------------------------- */
  /* Audio element wiring                                             */
  /* --------------------------------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setProgressSec(audio.currentTime);
    const onMeta = () => setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
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
  }, [currentIndex, pickNextIndex, playIndex, repeat]);

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
        URL.revokeObjectURL(track.url);
      }
      audioRef.current?.pause();
    };
  }, []);

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
        URL.revokeObjectURL(prev[index]!.url);
        const next = prev.filter((t) => t.id !== id);
        tracksRef.current = next;

        if (index === currentIndex) {
          audioRef.current?.pause();
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
      URL.revokeObjectURL(track.url);
    }
    tracksRef.current = [];
    setTracks([]);
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
    }),
    [
      tracks, currentTrack, currentIndex, isPlaying, volume, muted, shuffle, repeat,
      progressSec, durationSec, error, addFiles, removeTrack, clearTracks, playTrack,
      togglePlay, next, previous, seek, setVolume, toggleMute, toggleShuffle,
      cycleRepeat, dismissError,
    ],
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
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

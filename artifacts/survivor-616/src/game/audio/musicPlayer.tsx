/**
 * Soundtrack player.
 *
 * The player picks audio (or video-with-audio) files off their own device,
 * or pastes a direct link to one -- released tracks, unreleased demos,
 * whatever they want scoring the run. Files never leave the browser: each
 * one becomes an object URL that is revoked when the track is removed or
 * the tab closes. A pasted link is fetched client-side and treated exactly
 * like a dropped file; nothing routes through a server this app doesn't have.
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
import { ConversionError, convertToMp3 } from './convert';
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
  /**
   * True for a video container (mp4/mov/webm/mkv) added for its audio track.
   * Gates the "Convert to MP3" affordance -- there is no reason to offer it
   * on a file that is already a plain audio format.
   */
  isVideoContainer?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  /** Track ids in play order. Ids the library no longer has are skipped at read time. */
  trackIds: string[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface ConversionState {
  trackId: string;
  phase: 'decoding' | 'encoding';
  ratio: number;
}

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
  /**
   * Fetches a direct link to a media file and adds it like a dropped file.
   * Resolves false (and sets `error`) on a bad URL, a blocked streaming-service
   * link, or a fetch a CORS policy refused -- there is no server here to route
   * around that. Resolves true once the track is queued.
   */
  addFromUrl: (url: string) => Promise<boolean>;
  linkLoading: boolean;
  /** Re-encodes a local video-container track (mp4/mov/webm/mkv) to a real .mp3 in place. */
  convertTrackToMp3: (id: string) => Promise<void>;
  conversion: ConversionState | null;
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
   * The one `AudioContext` the app owns, or null before it has been created.
   * The studio adopts this rather than creating a second context -- two
   * contexts fight over the output device and iOS suspends one of them.
   */
  getAudioContext: () => AudioContext | null;

  /* -------------------------- playlists -------------------------- */
  playlists: Playlist[];
  /** null means "all tracks" -- the historical, still-default queue. */
  activePlaylistId: string | null;
  activePlaylist: Playlist | null;
  setActivePlaylist: (id: string | null) => void;
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  /** Replaces a playlist's track order wholesale -- built for a drag-reorder
   * UI that already has the full new order on hand, rather than one move at a time. */
  reorderPlaylistTracks: (playlistId: string, trackIds: string[]) => void;
}

const MusicContext = createContext<MusicPlayerValue | null>(null);

/** Plain audio formats -- decoded and played as-is, no conversion offered. */
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i;
/** Containers that carry a video track alongside audio; `<audio>` still plays
 * just the audio track, but these are the ones "Convert to MP3" applies to. */
const VIDEO_CONTAINER_EXTENSIONS = /\.(mp4|m4v|mov|webm|mkv)$/i;
const MEDIA_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|mp4|m4v|mov|webm|mkv)$/i;

/** Direct-link import fetches whatever URL it's given; these are refused up
 * front rather than attempted, since scraping them isn't what "paste a link"
 * means here and each one has its own DRM/ToS that a plain fetch can't clear. */
const STREAMING_SERVICE_HOSTS = [
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'spotify.com',
  'open.spotify.com',
  'soundcloud.com',
  'music.apple.com',
  'tidal.com',
  'deezer.com',
];

const PLAYLISTS_STORAGE_KEY = 'survivor616.playlists.v1';

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
  return file.name.replace(MEDIA_EXTENSIONS, '').replace(/[_-]+/g, ' ').trim() || file.name;
}

function looksLikeMedia(file: { type: string; name: string }): boolean {
  return file.type.startsWith('audio/') || file.type.startsWith('video/') || MEDIA_EXTENSIONS.test(file.name);
}

function looksLikeVideoContainer(file: { type: string; name: string }): boolean {
  return file.type.startsWith('video/') || VIDEO_CONTAINER_EXTENSIONS.test(file.name);
}

function isStreamingServiceUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return STREAMING_SERVICE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

interface StoredPlaylists {
  playlists: Playlist[];
  activePlaylistId: string | null;
}

function loadStoredPlaylists(): StoredPlaylists {
  const empty: StoredPlaylists = { playlists: [], activePlaylistId: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StoredPlaylists> | null;
    if (!parsed || !Array.isArray(parsed.playlists)) return empty;
    const playlists = parsed.playlists
      .filter(
        (p): p is Playlist =>
          typeof p?.id === 'string' && typeof p?.name === 'string' && Array.isArray(p?.trackIds),
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        trackIds: p.trackIds.filter((tid): tid is string => typeof tid === 'string'),
      }));
    return {
      playlists,
      activePlaylistId: typeof parsed.activePlaylistId === 'string' ? parsed.activePlaylistId : null,
    };
  } catch {
    return empty;
  }
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
  const [linkLoading, setLinkLoading] = useState(false);
  const [conversion, setConversion] = useState<ConversionState | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadStoredPlaylists().playlists);
  const [activePlaylistId, setActivePlaylistIdState] = useState<string | null>(
    () => loadStoredPlaylists().activePlaylistId,
  );
  const reactiveRootRef = useRef<HTMLDivElement | null>(null);

  tracksRef.current = tracks;

  // One audio element for the whole app so music survives screen changes.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const currentTrack = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null;
  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId],
  );

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

  /**
   * Lazily creates the app's single `AudioContext`, or returns the existing
   * one. Shared by playback analysis and MP3 conversion so a conversion run
   * before the player has ever played anything doesn't spin up a second
   * context -- see the studio-engine "one AudioContext, always" rule.
   */
  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioContextConstructor =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContextConstructor();
      } catch {
        return null;
      }
    }
    if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume();
    return audioContextRef.current;
  }, []);

  const connectAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const context = ensureAudioContext();
    if (!context) return;
    try {
      if (!analyserRef.current) {
        analyserRef.current = context.createAnalyser();
        analyserRef.current.fftSize = 1024;
        sourceNodeRef.current = context.createMediaElementSource(audio);
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(context.destination);
      }
    } catch {
      // Playback still works if Web Audio analysis is unavailable.
    }
  }, [ensureAudioContext]);

  /** The id queue playback actually walks: the active playlist, filtered to
   * tracks that still exist, or every track when no playlist is selected. */
  const activeQueueIds = useCallback((): string[] => {
    if (!activePlaylistId) return tracksRef.current.map((t) => t.id);
    const playlist = playlists.find((p) => p.id === activePlaylistId);
    if (!playlist) return tracksRef.current.map((t) => t.id);
    const known = new Set(tracksRef.current.map((t) => t.id));
    return playlist.trackIds.filter((id) => known.has(id));
  }, [playlists, activePlaylistId]);

  const pickNextIndex = useCallback(
    (currentId: string | null, direction: 1 | -1): number => {
      const ids = activeQueueIds();
      if (ids.length === 0) return -1;
      if (shuffle && ids.length > 1) {
        let pick = currentId;
        while (pick === currentId) {
          pick = ids[Math.floor(Math.random() * ids.length)]!;
        }
        return tracksRef.current.findIndex((t) => t.id === pick);
      }
      const at = currentId ? ids.indexOf(currentId) : -1;
      let nextPos = at + direction;
      if (nextPos >= ids.length) {
        if (repeat === 'off') return -1;
        nextPos = 0;
      } else if (nextPos < 0) {
        nextPos = ids.length - 1;
      }
      return tracksRef.current.findIndex((t) => t.id === ids[nextPos]);
    },
    [shuffle, repeat, activeQueueIds],
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
      const currentId = tracksRef.current[currentIndex]?.id ?? null;
      const next = pickNextIndex(currentId, 1);
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

  // Persist playlists (metadata + order only -- see Playlist management below
  // for why local-file entries don't survive a reload).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredPlaylists = { playlists, activePlaylistId };
      window.localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be unavailable (private browsing, quota) -- playlists just won't persist.
    }
  }, [playlists, activePlaylistId]);

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
  /*                                                                   */
  /* Playlists store track *ids*, not tracks. Bundled ids are stable   */
  /* across sessions so those entries survive a reload; a local file's */
  /* id is tied to an object URL that dies with the tab, so those      */
  /* entries are silently dropped at read time (`activeQueueIds`) and  */
  /* actively pruned below whenever a track is actually removed -- the */
  /* same "reference the player's files, don't carry them, skip what's */
  /* missing" tradeoff the studio's project model makes.               */
  /* --------------------------------------------------------------- */

  const createPlaylist = useCallback((name: string): string => {
    const id = `playlist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const trimmed = name.trim() || 'New Playlist';
    setPlaylists((prev) => [...prev, { id, name: trimmed, trackIds: [] }]);
    return id;
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setActivePlaylistIdState((current) => (current === id ? null : current));
  }, []);

  const setActivePlaylist = useCallback((id: string | null) => {
    setActivePlaylistIdState(id);
  }, []);

  const addToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId] }
          : p,
      ),
    );
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p)),
    );
  }, []);

  const reorderPlaylistTracks = useCallback((playlistId: string, trackIds: string[]) => {
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? { ...p, trackIds } : p)));
  }, []);

  /* --------------------------------------------------------------- */
  /* Library management                                               */
  /* --------------------------------------------------------------- */

  const addFiles = useCallback((files: FileList | File[]): number => {
    const incoming = Array.from(files);
    const accepted: Track[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (!looksLikeMedia(file)) {
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
        isVideoContainer: looksLikeVideoContainer(file),
      });
    }

    if (rejected.length > 0) {
      setError(
        rejected.length === 1
          ? `"${rejected[0]}" is not an audio or video file.`
          : `${rejected.length} files were skipped because they are not audio or video.`,
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
      // Read durations without disturbing playback. Works for a video
      // container too -- an <audio> element still reads container metadata.
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

  /**
   * Fetches a direct link to a media file client-side and adds it exactly
   * like a dropped file. There is no backend here to route around CORS or to
   * extract audio from a streaming service, so this only ever works for a
   * URL that already resolves straight to a file the player controls.
   */
  const addFromUrl = useCallback(
    async (rawUrl: string): Promise<boolean> => {
      const trimmed = rawUrl.trim();
      if (!trimmed) return false;

      let url: URL;
      try {
        url = new URL(trimmed);
      } catch {
        setError('That is not a valid URL.');
        return false;
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        setError('Links must start with http:// or https://.');
        return false;
      }
      if (isStreamingServiceUrl(url)) {
        setError(
          'Streaming-service links (YouTube, Spotify, SoundCloud, etc.) aren\'t supported here -- ' +
            'save the file to your device and drop it in instead.',
        );
        return false;
      }

      setLinkLoading(true);
      try {
        const response = await fetch(url.toString());
        if (!response.ok) {
          setError(`That link returned an error (${response.status}).`);
          return false;
        }
        const blob = await response.blob();
        const rawName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? 'track');
        const looksMediaByUrl =
          blob.type.startsWith('audio/') || blob.type.startsWith('video/') || MEDIA_EXTENSIONS.test(rawName);
        if (!looksMediaByUrl) {
          setError('That link did not point to an audio or video file.');
          return false;
        }
        const name = MEDIA_EXTENSIONS.test(rawName) ? rawName : `${rawName || 'track'}.mp3`;
        const file = new File([blob], name, { type: blob.type });
        const added = addFiles([file]);
        if (added === 0) {
          setError('That link did not point to an audio or video file.');
          return false;
        }
        return true;
      } catch {
        setError(
          "Could not load that link directly -- the site likely blocks cross-origin downloads. " +
            'Save the file and drop it in instead.',
        );
        return false;
      } finally {
        setLinkLoading(false);
      }
    },
    [addFiles],
  );

  /**
   * Re-encodes a local video-container track to a real .mp3 in place. The id
   * stays the same, so anything referencing it -- a playlist, the currently
   * playing track -- keeps working across the swap.
   */
  const convertTrackToMp3 = useCallback(
    async (id: string): Promise<void> => {
      const track = tracksRef.current.find((t) => t.id === id);
      if (!track || track.source !== 'local') return;

      const context = ensureAudioContext();
      if (!context) {
        setError('This browser does not support in-browser audio conversion.');
        return;
      }

      setConversion({ trackId: id, phase: 'decoding', ratio: 0 });
      try {
        // The object URL is the only handle left on the original bytes --
        // fetching it back out is cheaper than keeping every File around.
        const response = await fetch(track.url);
        const blob = await response.blob();
        const sourceFile = new File([blob], track.title, { type: blob.type || 'video/mp4' });

        const mp3Blob = await convertToMp3(sourceFile, context, (progress) =>
          setConversion({ trackId: id, ...progress }),
        );
        const newUrl = URL.createObjectURL(mp3Blob);

        setTracks((prev) => {
          const next = prev.map((t) =>
            t.id === id ? { ...t, url: newUrl, size: mp3Blob.size, isVideoContainer: false } : t,
          );
          tracksRef.current = next;
          return next;
        });
        URL.revokeObjectURL(track.url);

        const audio = audioRef.current;
        if (audio && tracksRef.current[currentIndex]?.id === id) {
          const resumeAt = audio.currentTime;
          const wasPlaying = !audio.paused;
          audio.src = newUrl;
          audio.currentTime = resumeAt;
          if (wasPlaying) void audio.play().catch(() => setIsPlaying(false));
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof ConversionError ? err.message : `Could not convert "${track.title}" to MP3.`,
        );
      } finally {
        setConversion(null);
      }
    },
    [ensureAudioContext, currentIndex],
  );

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
          setIsPlaying(false);
          setCurrentIndex(-1);
          setProgressSec(0);
          setDurationSec(0);
        } else if (index < currentIndex) {
          setCurrentIndex((i) => i - 1);
        }
        return next;
      });
      setPlaylists((prev) => prev.map((p) => ({ ...p, trackIds: p.trackIds.filter((tid) => tid !== id) })));
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
    setCurrentIndex(-1);
    setIsPlaying(false);
    setProgressSec(0);
    setDurationSec(0);
    const bundledIds = new Set(BUNDLED_TRACKS.map((t) => t.id));
    setPlaylists((prev) => prev.map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => bundledIds.has(id)) })));
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
    if (currentIndex === -1) {
      const ids = activeQueueIds();
      if (ids.length === 0) {
        setError(
          activePlaylistId
            ? 'This playlist is empty -- add a few tracks to it first.'
            : 'Load a few tracks first -- nothing is queued up.',
        );
        return;
      }
      const firstIndex = tracksRef.current.findIndex((t) => t.id === ids[0]);
      if (firstIndex === -1) return;
      playIndex(firstIndex);
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
  }, [currentIndex, playIndex, activeQueueIds, activePlaylistId]);

  const next = useCallback(() => {
    const currentId = tracksRef.current[currentIndex]?.id ?? null;
    const index = pickNextIndex(currentId, 1);
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
    const currentId = tracksRef.current[currentIndex]?.id ?? null;
    const index = pickNextIndex(currentId, -1);
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
      addFromUrl,
      linkLoading,
      convertTrackToMp3,
      conversion,
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
      playlists,
      activePlaylistId,
      activePlaylist,
      setActivePlaylist,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylistTracks,
    }),
    [
      tracks, currentTrack, currentIndex, isPlaying, volume, muted, shuffle, repeat,
      progressSec, durationSec, error, addFiles, addFromUrl, linkLoading, convertTrackToMp3,
      conversion, removeTrack, clearTracks, playTrack, togglePlay, next, previous, seek,
      setVolume, toggleMute, toggleShuffle, cycleRepeat, dismissError, getAudioContext,
      playlists, activePlaylistId, activePlaylist, setActivePlaylist, createPlaylist,
      renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, reorderPlaylistTracks,
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

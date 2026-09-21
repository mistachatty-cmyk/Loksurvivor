import { Music, Pause, Play, Shuffle, SkipForward } from 'lucide-react';
import { useMusicPlayer } from '@/game/audio/musicPlayer';

/**
 * Persistent transport for the soundtrack. It intentionally lives above the
 * screen switch so music and its controls survive navigation.
 */
export function MusicNowPlaying() {
  const player = useMusicPlayer();
  const playRandomUnlocked = () => {
    const unlocked = player.tracks.filter((track) => !track.locked);
    if (unlocked.length === 0) return;
    const alternatives = unlocked.filter((track) => track.id !== player.currentTrack?.id);
    const pool = alternatives.length > 0 ? alternatives : unlocked;
    const track = pool[Math.floor(Math.random() * pool.length)];
    if (!track) return;
    player.ensureAudioContext();
    player.playTrack(track.id);
  };

  if (!player.currentTrack) {
    return (
      <button
        type="button"
        onClick={playRandomUnlocked}
        className="fixed right-3 top-3 z-[100] inline-flex min-h-10 items-center gap-2 border border-primary/50 bg-black/85 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-black/30 backdrop-blur-sm transition hover:border-primary hover:text-primary"
        aria-label="Play a random unlocked soundtrack track"
        data-testid="button-global-random-music"
      >
        <Music className="h-4 w-4 text-primary" aria-hidden="true" />
        <span>Play soundtrack</span>
        <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="fixed right-3 top-3 z-[100] flex max-w-[min(18rem,calc(100vw-1.5rem))] items-center gap-2 border border-primary/50 bg-black/85 px-2 py-1.5 text-white shadow-lg shadow-black/30 backdrop-blur-sm"
      data-testid="music-now-playing-global"
    >
      <Music className={`h-3.5 w-3.5 shrink-0 text-primary ${player.isPlaying ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-wider" title={player.currentTrack.title}>
        {player.currentTrack.title}
      </span>
      <button
        type="button"
        onClick={playRandomUnlocked}
        className="grid h-7 w-7 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
        aria-label="Play a random unlocked soundtrack track"
        data-testid="button-global-random-music"
      >
        <Shuffle className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={player.togglePlay}
        className="grid h-7 w-7 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
        aria-label={player.isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        data-testid="button-global-music-toggle"
      >
        {player.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={player.next}
        className="grid h-7 w-7 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
        aria-label="Skip to next track"
        data-testid="button-global-music-next"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

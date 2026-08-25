import { Music, Pause, Play, SkipForward } from 'lucide-react';
import { useMusicPlayer } from '@/game/audio/musicPlayer';

/**
 * Persistent transport for the soundtrack. It intentionally lives above the
 * screen switch so music and its controls survive navigation.
 */
export function MusicNowPlaying() {
  const player = useMusicPlayer();
  if (!player.currentTrack) return null;

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
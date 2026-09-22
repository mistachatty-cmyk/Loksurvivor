import { useState } from 'react';
import { Music, Pause, Play, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useMusicPlayer } from '@/game/audio/musicPlayer';

/**
 * Persistent transport for the soundtrack. It intentionally lives above the
 * screen switch so music and its controls survive navigation.
 *
 * Docked to the top-left corner (not bottom-center) so it never sits on top
 * of centered screen copy -- the intro's credit line in particular -- or
 * crowds the intro's theme switcher and Reset button, which both live in
 * the bottom corners. Stays as a small round chip until tapped open; the
 * full transport only takes up space once someone actually wants it.
 */
export function MusicNowPlaying() {
  const player = useMusicPlayer();
  const [expanded, setExpanded] = useState(false);

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
        className="fixed left-3 top-3 z-[100] grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/35 text-white/55 opacity-75 backdrop-blur-sm transition hover:border-primary hover:text-primary hover:opacity-100"
        aria-label="Play a random unlocked soundtrack track"
        data-testid="button-global-random-music"
      >
        <Music className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      </button>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed left-3 top-3 z-[100] grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/35 text-white/65 opacity-75 backdrop-blur-sm transition hover:border-primary hover:text-primary hover:opacity-100"
        aria-label={`Now playing: ${player.currentTrack.title}. Open music controls.`}
        title={player.currentTrack.title}
        data-testid="music-now-playing-global"
      >
        <Music className={`h-3.5 w-3.5 text-primary ${player.isPlaying ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="fixed left-3 top-3 z-[100] flex max-w-[min(18rem,calc(100vw-1.5rem))] items-center gap-2 border border-white/15 bg-black/35 px-2 py-1 text-white/65 opacity-75 backdrop-blur-sm transition-opacity hover:opacity-100"
      data-testid="music-now-playing-global"
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="grid h-7 w-7 shrink-0 place-items-center text-primary"
        aria-label="Collapse music controls"
        data-testid="button-global-music-collapse"
      >
        <Music className={`h-3.5 w-3.5 ${player.isPlaying ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-wider" title={player.currentTrack.title}>
        {player.currentTrack.title}
      </span>
      <button
        type="button"
        onClick={player.previous}
        className="grid h-7 w-7 shrink-0 place-items-center border border-white/15 text-white/65 hover:border-primary hover:text-primary"
        aria-label="Previous intro soundtrack track"
        data-testid="button-global-music-previous"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>
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

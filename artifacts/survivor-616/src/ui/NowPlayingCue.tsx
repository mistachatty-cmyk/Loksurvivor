/**
 * "Now playing" cue for the run HUD.
 *
 * Purely visual, and deliberately fed from `beatBus` rather than the music
 * player: the bus is the one seam anything music-related reads, so a track
 * change has a single detection path. It subscribes to the bus (a UI-rate
 * event, not the animation-frame poll the run loop uses) and never touches
 * the simulation -- the run loop's own `beatBus.read()` inside its substep
 * loop is untouched by this component.
 */

import { Music } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { beatBus } from '@/game/audio/beatBus';

/** How long the title stays up after a track change. */
const VISIBLE_MS = 5000;
/** Fade-out length; the element stays mounted for this long after hiding. */
const FADE_MS = 500;

export function NowPlayingCue() {
  const [title, setTitle] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const lastTrackId = useRef<string | null>(null);

  useEffect(() => {
    let hideTimer = 0;
    let clearTimer = 0;

    const unsubscribe = beatBus.subscribe((frame) => {
      const trackId = frame.track?.id ?? null;
      if (trackId === lastTrackId.current) return;
      lastTrackId.current = trackId;
      if (!frame.track) return;

      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
      setTitle(frame.track.title);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
      clearTimer = window.setTimeout(() => setTitle(null), VISIBLE_MS + FADE_MS);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  if (title === null) return null;

  return (
    <div
      className={`flex max-w-[min(16rem,60vw)] items-center gap-1.5 border border-primary/40 bg-black/75 px-2 py-1 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      data-testid="hud-now-playing"
    >
      <Music className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest text-white/80" title={title}>
        {title}
      </span>
    </div>
  );
}

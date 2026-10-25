import { useEffect, useRef } from 'react';

import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { addSeconds, listeningHistoryPref, PLAY_THRESHOLD_SEC, readListening, recordPlay, writeListening } from '@/lib/listening';

const TICK_MS = 5000;

/**
 * Counts what is really listened to: every few seconds the current song earns that time, and once it
 * has been heard for 20 seconds it counts as a play (a skip does not). Works anywhere the soundtrack
 * plays. Draws nothing, writes only to this device, and does nothing while history is switched off.
 */
export function ListeningTracker() {
  const { currentTrack, isPlaying } = useMusicPlayer();
  const trackId = currentTrack?.id ?? null;
  const heard = useRef({ id: null as string | null, seconds: 0, counted: false });

  useEffect(() => {
    if (heard.current.id !== trackId) heard.current = { id: trackId, seconds: 0, counted: false };
  }, [trackId]);

  useEffect(() => {
    if (!isPlaying || !trackId) return undefined;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      // A throttled background tab can fire late; never credit more than a few ticks at once.
      const gained = Math.min((now - last) / 1000, (TICK_MS * 3) / 1000);
      last = now;
      if (!listeningHistoryPref.get() || heard.current.id !== trackId) return;
      let next = addSeconds(readListening(), trackId, gained);
      heard.current.seconds += gained;
      if (!heard.current.counted && heard.current.seconds >= PLAY_THRESHOLD_SEC) {
        heard.current.counted = true;
        next = recordPlay(next, trackId, now);
      }
      writeListening(next);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, trackId]);

  return null;
}

export default ListeningTracker;

/**
 * The soundtrack as slow-turning discs floating above the rain on the "Outside
 * the hideout" arrival screen. Chrome-free and transparent on purpose: just the
 * discs sliding in and out, so it screenshots cleanly. Silent until the player
 * taps the chosen disc (a tap is the gesture browsers need before sound).
 *
 * The shelves themselves (one row per album, swipe up and down, pull a song out)
 * live in `DiscShelves`, shared with the Jukebox Room.
 *
 * Loaded lazily by `HideoutArrivalOverlay` and only when the opt-in flag is on,
 * so it costs nothing in the first-load bundle. Reads the same tracks and lock
 * state as the Soundtrack panel; it adds no audio files and no network calls.
 */
import { useEffect } from 'react';

import { watchDiscGuard } from '@/lib/discGuard';
import { useT } from '@/lib/i18n';
import { DiscShelves } from './DiscShelves';

const DISC_SIZE = 'clamp(150px, 46vw, 300px)';

export default function ArrivalDiscShelf({ lite, onPlay }: { lite?: boolean; onPlay?: () => void }) {
  useEffect(() => watchDiscGuard(), []);
  const t = useT();
  return (
    <DiscShelves
      lite={lite ?? true}
      discSize={DISC_SIZE}
      ariaLabel="Soundtrack discs"
      crashPrefix="disc"
      onPlay={onPlay}
      emptyText={t('arrival.discsEmpty.body')}
    />
  );
}

/**
 * The soundtrack as slow-turning discs floating above the rain on the "Outside
 * the hideout" arrival screen. Chrome-free and transparent on purpose: just the
 * discs sliding in and out, so it screenshots cleanly. Silent until the player
 * taps the chosen disc (a tap is the gesture browsers need before sound).
 *
 * Loaded lazily by `HideoutArrivalOverlay` and only when the opt-in flag is on,
 * so it costs nothing in the first-load bundle. Reads the same tracks and lock
 * state as the Soundtrack panel; it adds no audio files and no network calls.
 */
import { useEffect, useMemo, useState } from 'react';

import DiscCascadeCarousel from '@/components/ui/disc-cascade-carousel';
import { albumTracks, discItemFor, startingDisc, type DiscTrack } from '@/game/audio/jukeboxDiscs';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { watchDiscGuard } from '@/lib/discGuard';
import { setCrashScreen } from '@/lib/lokCrash';
import { SealedDiscHint } from './SealedDiscHint';

const SHELF_HEIGHT = '54dvh';

export default function ArrivalDiscShelf({ lite }: { lite?: boolean }) {
  useEffect(() => watchDiscGuard(), []);
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, soundtrackObjectiveCompletions } = useMusicPlayer();
  const [hint, setHint] = useState<DiscTrack | null>(null);
  const discTracks = useMemo(() => albumTracks(tracks), [tracks]);
  const items = useMemo(() => discTracks.map(discItemFor), [discTracks]);
  // Fixed at mount: the carousel owns the position after that, and a changing
  // default would only matter if the list itself changed under it.
  const first = useMemo(() => startingDisc(discTracks, currentTrack?.id ?? null), [discTracks, currentTrack?.id]);

  if (items.length === 0) return null;

  return (
    <>
    <DiscCascadeCarousel
      items={items}
      defaultIndex={first}
      loop
      lite={lite ?? true}
      height={SHELF_HEIGHT}
      discSize="clamp(150px, 46vw, 300px)"
      background="transparent"
      frame={false}
      details={false}
      reviews={false}
      controls={false}
      hint=""
      indexLabel=""
      brand=""
      ariaLabel="Soundtrack discs"
      onSelect={(_item, index) => {
        const track = discTracks[index];
        if (!track) return;
        setCrashScreen(`disc:${track.id}`);
        if (track.locked) {
          setHint(track);
          return;
        }
        setHint(null);
        if (currentTrack?.id === track.id && isPlaying) togglePlay();
        else playTrack(track.id);
      }}
    />
    {hint ? (
      <div className="absolute inset-x-0 top-[78%] z-50">
        <SealedDiscHint track={hint} completed={soundtrackObjectiveCompletions} onClose={() => setHint(null)} />
      </div>
    ) : null}
    </>
  );
}

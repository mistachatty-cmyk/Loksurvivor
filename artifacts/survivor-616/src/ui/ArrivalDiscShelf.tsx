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
import { useT } from '@/lib/i18n';
import { setCrashScreen } from '@/lib/lokCrash';
import { readDiscPulse } from '@/lib/discPulse';
import { DiscPulse } from './DiscPulse';
import { SealedDiscHint } from './SealedDiscHint';

const SHELF_HEIGHT = '54dvh';
const DISC_SIZE = 'clamp(150px, 46vw, 300px)';

export default function ArrivalDiscShelf({ lite, onPlay }: { lite?: boolean; onPlay?: () => void }) {
  useEffect(() => watchDiscGuard(), []);
  const t = useT();
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, soundtrackObjectiveCompletions } = useMusicPlayer();
  const [hint, setHint] = useState<DiscTrack | null>(null);
  const [pulseLevel] = useState(readDiscPulse);
  const discTracks = useMemo(() => albumTracks(tracks), [tracks]);
  const items = useMemo(() => discTracks.map(discItemFor), [discTracks]);
  // Fixed at mount: the carousel owns the position after that, and a changing
  // default would only matter if the list itself changed under it.
  const first = useMemo(() => startingDisc(discTracks, currentTrack?.id ?? null), [discTracks, currentTrack?.id]);

  const [center, setCenter] = useState<number | null>(null);
  if (items.length === 0) {
    return (
      <p className="mx-auto mt-[6dvh] max-w-xs px-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/50" data-testid="arrival-discs-empty">
        {t('arrival.discsEmpty.body')}
      </p>
    );
  }
  const centerIndex = center ?? first;
  const centerTrack = discTracks[centerIndex];

  return (
    <>
    <DiscPulse
      color={items[centerIndex]?.palette?.[1] ?? '#7dd3fc'}
      active={isPlaying && Boolean(centerTrack) && currentTrack?.id === centerTrack?.id}
      playing={isPlaying}
      level={pulseLevel}
      discSize={DISC_SIZE}
    />
    <DiscCascadeCarousel
      items={items}
      defaultIndex={first}
      loop
      lite={lite ?? true}
      height={SHELF_HEIGHT}
      discSize={DISC_SIZE}
      onIndexChange={setCenter}
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
        onPlay?.();
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

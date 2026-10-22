import { useEffect } from 'react';

import { sealedProgress, type DiscTrack } from '@/game/audio/jukeboxDiscs';
import { useT } from '@/lib/i18n';

/** A small blueprint-style card with Lok's hint for how to open a sealed disc. Closes itself after a few seconds. */
export function SealedDiscHint({ track, completed, onClose }: { track: DiscTrack; completed: number; onClose: () => void }) {
  const t = useT();
  const { need, have, left } = sealedProgress(track, completed);
  useEffect(() => {
    const id = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(id);
  }, [track.id, onClose]);

  return (
    <div
      role="status"
      className="pointer-events-auto mx-auto w-[min(90vw,22rem)] border border-sky-300/60 bg-[#0a2540]/95 px-4 py-3 text-left text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.2)] backdrop-blur-sm"
      data-testid="sealed-disc-hint"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
        {t('jukebox.sealed.title', { n: String(track.trackNumber ?? 0).padStart(2, '0') })}
      </p>
      <p className="mt-1.5 text-sm leading-snug">{t('jukebox.sealed.hint', { need: String(need), have: String(have), left: String(left) })}</p>
      <button type="button" onClick={onClose} className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-sky-300 hover:text-white">
        {t('jukebox.sealed.close')}
      </button>
    </div>
  );
}

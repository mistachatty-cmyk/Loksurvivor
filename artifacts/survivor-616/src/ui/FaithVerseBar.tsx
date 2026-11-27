import { useEffect, useRef, useState } from 'react';
import { FAITH_PREFS_EVENT, readFaithPrefs, reducedMotion } from '@/faith/faithSettings';
import { mountVerseBar } from '@/faith/verseBar';

/** One quiet line of scripture under the title, when Faith is on (Settings > Faith). Tap it for the verse card. */
export function FaithVerseBar() {
  const host = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(() => {
    const p = readFaithPrefs();
    return p.religion !== 'none' && p.verseBar;
  });
  useEffect(() => {
    const sync = () => {
      const p = readFaithPrefs();
      setShow(p.religion !== 'none' && p.verseBar);
    };
    window.addEventListener(FAITH_PREFS_EVENT, sync);
    return () => window.removeEventListener(FAITH_PREFS_EVENT, sync);
  }, []);
  useEffect(() => {
    if (!show || !host.current) return undefined;
    return mountVerseBar(host.current, { reduced: reducedMotion() });
  }, [show]);
  return show ? <div ref={host} className="mt-3 w-full max-w-sm sm:max-w-md" data-testid="faith-verse-bar-host" /> : null;
}

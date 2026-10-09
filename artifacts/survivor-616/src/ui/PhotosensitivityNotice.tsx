/**
 * A seizure and photosensitivity warning shown between the title screen and the
 * hideout. It fades in, waits for the player, then fades out before handing over,
 * so the move from the title to the hideout stays smooth. Reduced motion skips the fades.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';

import { useT } from '@/lib/i18n';

const HIDE_KEY = 'survivor616.photosensitivityNoticeHidden';
const FADE_S = 0.45;

/** Whether the player asked not to see the notice again. Storage may be blocked, so this never throws. */
export function photosensitivityNoticeHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(HIDE_KEY, '1');
    else window.localStorage.removeItem(HIDE_KEY);
  } catch {
    /* storage unavailable: the notice simply shows next time */
  }
}

export function PhotosensitivityNotice({ onContinue }: { onContinue: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  const proceed = () => {
    if (leaving) return;
    rememberHidden(dontShow);
    if (reduce) {
      onContinue();
      return;
    }
    setLeaving(true);
    window.setTimeout(onContinue, FADE_S * 1000);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4"
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : FADE_S, ease: 'easeInOut' }}
      role="alertdialog"
      aria-labelledby="photosensitivity-title"
      aria-describedby="photosensitivity-body"
      data-testid="screen-photosensitivity-notice"
    >
      <div className="w-full max-w-md border border-border bg-black/40 p-6 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-amber-300">{t('photosensitivity.kicker')}</p>
        <h1 id="photosensitivity-title" className="mt-2 text-xl font-black uppercase tracking-wide">{t('photosensitivity.title')}</h1>
        <p id="photosensitivity-body" className="mt-3 text-sm text-muted-foreground">{t('photosensitivity.body')}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t('photosensitivity.tip')}</p>
        <label className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} data-testid="checkbox-photosensitivity-hide" />
          {t('photosensitivity.hide')}
        </label>
        <button
          type="button"
          autoFocus
          onClick={proceed}
          className="mt-5 w-full border border-primary bg-primary/20 px-4 py-2 text-sm font-black uppercase tracking-wide text-primary hover:bg-primary/30"
          data-testid="button-photosensitivity-continue"
        >
          {t('photosensitivity.continue')}
        </button>
      </div>
    </motion.div>
  );
}

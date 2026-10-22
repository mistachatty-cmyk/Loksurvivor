/**
 * A seizure and photosensitivity warning shown between the title screen and the
 * hideout. One calm column: a glowing warning mark, the plain-language warning,
 * three things to expect, and when to stop. The glow breathes slowly and gently
 * (a few percent, several seconds per cycle); nothing here ever flashes.
 * Reduced-motion preferences turn every animation off.
 */
import { ArrowRight, Move, ShieldAlert, Sun, Zap } from 'lucide-react';
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
  const reduce = Boolean(useReducedMotion());
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

  // A slow, shallow breath. Long cycle, small change: never a flash.
  const breathe = (from: number | string, to: number | string, seconds: number) =>
    reduce ? undefined : { animate: { opacity: [from, to, from] as (number | string)[] }, transition: { duration: seconds, repeat: Infinity, ease: 'easeInOut' as const } };

  const triggers = [
    { Icon: Zap, text: t('photosensitivity.trigger1'), color: 'text-amber-300' },
    { Icon: Sun, text: t('photosensitivity.trigger2'), color: 'text-orange-300' },
    { Icon: Move, text: t('photosensitivity.trigger3'), color: 'text-cyan-300' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06070b] px-4 py-6 text-white"
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : FADE_S, ease: 'easeInOut' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="photosensitivity-title"
      aria-describedby="photosensitivity-body"
      data-testid="screen-photosensitivity-notice"
    >
      {/* Backdrop: a low amber glow rising from the bottom, like a lit window in the rain. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(251,146,60,0.22),transparent_65%)]"
          initial={{ opacity: 0.7 }}
          {...breathe(0.6, 1, 7)}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(104deg,transparent_0_26px,rgba(255,255,255,.9)_26px_27px)]" />
      </div>

      <motion.main
        className="relative my-auto w-full max-w-md text-center"
        initial={reduce ? false : { y: 10, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-amber-400/25 blur-xl"
            initial={{ opacity: 0.6 }}
            {...breathe(0.45, 0.9, 5)}
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/50 bg-[#10131b] text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
            <ShieldAlert size={30} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </div>

        <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">{t('photosensitivity.kicker')}</p>
        <h1 id="photosensitivity-title" className="mt-2 text-2xl font-black uppercase leading-tight tracking-wide text-white sm:text-3xl">
          {t('photosensitivity.title')}
        </h1>
        <p id="photosensitivity-body" className="mt-4 text-sm leading-relaxed text-white/70">{t('photosensitivity.body')}</p>

        <ul className="mt-6 space-y-2 text-left" aria-label={t('photosensitivity.triggersTitle')}>
          {triggers.map(({ Icon, text, color }, index) => (
            <motion.li
              key={index}
              className="flex items-center gap-3 border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + 0.1 * index }}
            >
              <Icon className={`shrink-0 ${color}`} size={16} aria-hidden="true" />
              <span className="text-xs leading-snug text-white/75">{text}</span>
            </motion.li>
          ))}
        </ul>

        <section className="mt-4 border-l-2 border-rose-400/70 bg-rose-400/[0.07] px-3.5 py-3 text-left" aria-labelledby="photosensitivity-stop-title">
          <h2 id="photosensitivity-stop-title" className="text-xs font-black uppercase tracking-wide text-rose-100">{t('photosensitivity.stopTitle')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{t('photosensitivity.stop')}</p>
        </section>

        <p className="mt-4 text-xs leading-relaxed text-white/45">{t('photosensitivity.safer')}</p>
        <p className="mt-2 text-xs leading-relaxed text-cyan-100/70">{t('photosensitivity.tip')}</p>

        <button
          type="button"
          autoFocus
          onClick={proceed}
          className="group mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-amber-300/60 bg-amber-300/10 px-5 py-3 text-sm font-black uppercase tracking-wider text-amber-50 shadow-[0_0_22px_rgba(251,191,36,0.12)] transition-colors hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          data-testid="button-photosensitivity-continue"
        >
          {t('photosensitivity.continue')}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
        </button>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(event) => setDontShow(event.target.checked)}
            className="size-4 accent-amber-300"
            data-testid="checkbox-photosensitivity-hide"
          />
          {t('photosensitivity.hide')}
        </label>
      </motion.main>
    </motion.div>
  );
}

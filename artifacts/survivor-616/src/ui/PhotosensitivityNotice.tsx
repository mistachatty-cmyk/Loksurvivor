/**
 * A seizure and photosensitivity warning shown between the title screen and the
 * hideout. Kept short enough to never need scrolling: a glowing warning mark,
 * the title, ONE short sentence whose words rise in one by one, and Continue.
 * "More info" opens the full guidance for anyone who wants it. The glow and the
 * title shimmer are slow and shallow; nothing here ever flashes. Reduced-motion
 * preferences turn every animation off.
 */
import { ArrowRight, ChevronDown, Move, ShieldAlert, Sun, Zap } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';

import { useTheaterLevel } from '@/lib/useTheaterLevel';

import { useT } from '@/lib/i18n';

const HIDE_KEY = 'survivor616.photosensitivityNoticeHidden';
const FADE_S = 0.45;

let seenThisSession = false;
/** True once the notice was shown and acknowledged during this page load, so it is never shown twice in a row. */
export function photosensitivityNoticeSeenThisSession(): boolean {
  return seenThisSession;
}

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

/** Backdrop strength for each of the three theater levels: clear, then fainter, then nearly gone until a touch wakes it. */
const BACKDROP_OPACITY = [0, 0.55, 0.28, 0.1] as const;

export function PhotosensitivityNotice({ onContinue, backdrop }: { onContinue: () => void; backdrop?: ReactNode }) {
  const t = useT();
  const { level, wake } = useTheaterLevel({ paused: false, theaterMix: false });
  const reduce = Boolean(useReducedMotion());
  const [leaving, setLeaving] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [more, setMore] = useState(false);

  const proceed = () => {
    if (leaving) return;
    seenThisSession = true;
    rememberHidden(dontShow);
    if (reduce) {
      onContinue();
      return;
    }
    setLeaving(true);
    window.setTimeout(onContinue, FADE_S * 1000);
  };

  // A slow, shallow breath. Long cycle, small change: never a flash.
  const breathe = (from: number, to: number, seconds: number) =>
    reduce ? undefined : { animate: { opacity: [from, to, from] }, transition: { duration: seconds, repeat: Infinity, ease: 'easeInOut' as const } };

  const words = t('photosensitivity.short.line').split(' ');
  const triggers = [
    { Icon: Zap, text: t('photosensitivity.trigger1'), color: 'text-amber-300' },
    { Icon: Sun, text: t('photosensitivity.trigger2'), color: 'text-orange-300' },
    { Icon: Move, text: t('photosensitivity.trigger3'), color: 'text-cyan-300' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-y-auto bg-[#06070b] px-5 py-5 text-white"
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : FADE_S, ease: 'easeInOut' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="photosensitivity-title"
      aria-describedby="photosensitivity-body"
      data-testid="screen-photosensitivity-notice"
      onPointerDown={wake}
      onKeyDown={wake}
    >
      {backdrop ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 flex h-[46%] items-end overflow-hidden transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: reduce ? BACKDROP_OPACITY[2] : BACKDROP_OPACITY[level.level] ?? 0.1 }}
        >
          {backdrop}
        </div>
      ) : null}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[65%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(251,146,60,0.2),transparent_65%)]"
          initial={{ opacity: 0.7 }}
          {...breathe(0.55, 1, 7)}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.07),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(104deg,transparent_0_26px,rgba(255,255,255,.9)_26px_27px)]" />
      </div>

      <main className="relative my-auto w-full max-w-sm text-center">
        <motion.div
          className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center"
          initial={reduce ? false : { scale: 0.8, opacity: 0 }}
          animate={reduce ? undefined : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl"
            initial={{ opacity: 0.6 }}
            {...breathe(0.4, 0.95, 4.5)}
          />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/55 bg-[#10131b] text-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.28)]">
            <ShieldAlert size={26} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </motion.div>

        <motion.h1
          id="photosensitivity-title"
          className="mt-5 bg-[linear-gradient(100deg,#fff_35%,#fde68a_50%,#fff_65%)] bg-[length:250%_100%] bg-clip-text text-2xl font-black uppercase leading-tight tracking-wide text-transparent"
          initial={{ backgroundPositionX: '100%' }}
          animate={reduce ? { backgroundPositionX: '0%' } : { backgroundPositionX: ['100%', '0%', '0%', '100%'] }}
          transition={reduce ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.6, 1] }}
        >
          {t('photosensitivity.short.title')}
        </motion.h1>

        <p id="photosensitivity-body" className="mx-auto mt-3 max-w-[18rem] text-base leading-snug text-white/75" aria-label={t('photosensitivity.short.line')}>
          {words.map((word, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="inline-block pr-[0.28em]"
              initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.35 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}
            </motion.span>
          ))}
        </p>

        <motion.div
          className="flex flex-col items-center"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 + words.length * 0.07 + 0.1 }}
        >
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

          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="mx-auto mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-cyan-100/70 hover:text-cyan-50"
            data-testid="button-photosensitivity-more"
          >
            {more ? t('photosensitivity.less') : t('photosensitivity.more')}
            <ChevronDown size={14} className={`transition-transform ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {more ? (
            <motion.div
              className="mt-3 max-h-[42dvh] space-y-3 overflow-y-auto border border-white/10 bg-white/[0.03] p-3 text-left"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-xs leading-relaxed text-white/70">{t('photosensitivity.body')}</p>
              <ul className="space-y-2">
                {triggers.map(({ Icon, text, color }, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 shrink-0 ${color}`} size={14} aria-hidden="true" />
                    <span className="text-xs leading-snug text-white/70">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="border-l-2 border-rose-400/70 bg-rose-400/[0.07] px-3 py-2">
                <h2 className="text-xs font-black uppercase tracking-wide text-rose-100">{t('photosensitivity.stopTitle')}</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{t('photosensitivity.stop')}</p>
              </div>
              <p className="text-xs leading-relaxed text-white/50">{t('photosensitivity.safer')}</p>
              <p className="text-xs leading-relaxed text-cyan-100/70">{t('photosensitivity.tip')}</p>
            </motion.div>
          ) : null}

          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(event) => setDontShow(event.target.checked)}
              className="size-4 accent-amber-300"
              data-testid="checkbox-photosensitivity-hide"
            />
            {t('photosensitivity.hide')}
          </label>
        </motion.div>
      </main>
    </motion.div>
  );
}

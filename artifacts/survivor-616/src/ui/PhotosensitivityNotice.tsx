/**
 * A seizure and photosensitivity warning shown between the title screen and the
 * hideout. The scene uses slow, low-amplitude movement only; it never flashes.
 * Reduced-motion preferences disable the decorative and transition animations.
 */
import { Activity, ArrowRight, Eye, Move, ShieldAlert, Sun, Zap } from 'lucide-react';
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

const floatTransition = (reduce: boolean, delay = 0) => reduce
  ? { duration: 0 }
  : { duration: 10, delay, repeat: Infinity, ease: 'easeInOut' as const };

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#07080d] px-3 py-4 text-white sm:px-6"
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : FADE_S, ease: 'easeInOut' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="photosensitivity-title"
      aria-describedby="photosensitivity-body"
      data-testid="screen-photosensitivity-notice"
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(25,89,106,0.2),transparent_55%),radial-gradient(ellipse_at_90%_100%,rgba(123,69,31,0.13),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:36px_36px]" />
        <motion.span
          className="absolute -left-10 top-[20%] h-40 w-40 rounded-full border border-cyan-200/10"
          animate={reduce ? undefined : { x: [0, 12, 0], y: [0, 8, 0] }}
          transition={floatTransition(Boolean(reduce))}
        />
        <motion.span
          className="absolute -right-16 bottom-[10%] h-64 w-64 rounded-full border border-amber-200/10"
          animate={reduce ? undefined : { x: [0, -10, 0], y: [0, -8, 0] }}
          transition={floatTransition(Boolean(reduce), 1.5)}
        />
      </div>

      <motion.main
        className="relative my-auto w-full max-w-2xl overflow-hidden border border-white/15 bg-[#10131b]/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)]"
        initial={reduce ? false : { y: 12, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="h-1 bg-gradient-to-r from-cyan-300/60 via-amber-300 to-rose-300/60" />
        <div className="p-4 sm:p-7">
          <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-cyan-200/35 bg-cyan-300/10 text-cyan-100">
                <Activity size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/75">SURVIVOR 616</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/45">{t('photosensitivity.kicker')}</p>
              </div>
            </div>
            <span className="shrink-0 border border-amber-200/25 px-2 py-1 font-mono text-[9px] font-bold tracking-widest text-amber-100/80">S616 · 01</span>
          </header>

          <section className="relative mt-5 overflow-hidden border border-white/10 bg-[#090c12] px-4 py-5 sm:px-7" aria-hidden="true">
            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(34,211,238,0.07),transparent_42%,rgba(251,191,36,0.06))]" />
            <div className="relative mx-auto flex min-h-32 max-w-lg items-center justify-center gap-5 sm:gap-8">
              <motion.div
                className="relative flex h-24 w-24 shrink-0 items-center justify-center border border-amber-200/45 bg-amber-300/[0.06] text-amber-200 sm:h-28 sm:w-28"
                animate={reduce ? undefined : { y: [0, -3, 0] }}
                transition={floatTransition(Boolean(reduce), 0.4)}
              >
                <div className="absolute inset-1.5 border border-amber-200/15" />
                <ShieldAlert size={46} strokeWidth={1.15} />
                <span className="absolute -bottom-2 bg-[#090c12] px-2 font-mono text-[9px] font-bold tracking-[0.2em] text-amber-100/80">NOTICE 616</span>
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2 text-cyan-100/65"><Eye size={15} aria-hidden="true" /></div>
                <h1 id="photosensitivity-title" className="max-w-md text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl">
                  {t('photosensitivity.title')}
                </h1>
                <div className="mt-3 flex items-center gap-1.5" aria-hidden="true"><span className="h-px w-7 bg-cyan-200/40" /><span className="h-px w-3 bg-cyan-200/25" /><span className="h-px w-1 bg-cyan-200/15" /></div>
              </div>
            </div>
          </section>

          <p id="photosensitivity-body" className="mt-4 text-sm leading-relaxed text-white/70">{t('photosensitivity.body')}</p>

          <section className="mt-5" aria-labelledby="photosensitivity-triggers-title">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-white/10" />
              <h2 id="photosensitivity-triggers-title" className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/80">{t('photosensitivity.triggersTitle')}</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { Icon: Zap, text: t('photosensitivity.trigger1'), color: 'text-amber-200' },
                { Icon: Sun, text: t('photosensitivity.trigger2'), color: 'text-orange-200' },
                { Icon: Move, text: t('photosensitivity.trigger3'), color: 'text-cyan-100' },
              ].map(({ Icon, text, color }, index) => (
                <motion.div
                  key={index}
                  className="flex min-h-[74px] items-start gap-2.5 border border-white/10 bg-white/[0.025] p-3"
                  initial={reduce ? false : { opacity: 0, y: 5 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : 0.08 * index }}
                >
                  <Icon className={`mt-0.5 shrink-0 ${color}`} size={15} aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-white/65">{text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="mt-4 border-l-2 border-rose-300/70 bg-rose-300/[0.07] p-3.5" aria-labelledby="photosensitivity-stop-title">
            <h2 id="photosensitivity-stop-title" className="text-xs font-black uppercase tracking-wide text-rose-100">{t('photosensitivity.stopTitle')}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">{t('photosensitivity.stop')}</p>
          </section>

          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
            <p className="text-xs leading-relaxed text-white/55">{t('photosensitivity.safer')}</p>
            <p className="border-l border-cyan-100/20 pl-3 text-xs leading-relaxed text-cyan-50/75">{t('photosensitivity.tip')}</p>
          </div>

          <footer className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-white/65">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(event) => setDontShow(event.target.checked)}
                className="size-4 accent-cyan-300"
                data-testid="checkbox-photosensitivity-hide"
              />
              {t('photosensitivity.hide')}
            </label>
            <button
              type="button"
              autoFocus
              onClick={proceed}
              className="group inline-flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-100/50 bg-cyan-100/10 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-cyan-50 transition-colors hover:bg-cyan-100/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:w-auto"
              data-testid="button-photosensitivity-continue"
            >
              {t('photosensitivity.continue')}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
            </button>
          </footer>
        </div>
      </motion.main>
    </motion.div>
  );
}

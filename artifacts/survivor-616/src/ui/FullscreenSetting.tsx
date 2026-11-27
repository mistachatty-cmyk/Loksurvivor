import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { pressScreenButton } from '@/lib/lokScreen';
import { readScreenPrefs, writeScreenPrefs, SCREEN_PLACES, SCREEN_PREFS_EVENT, type ScreenMode, type ScreenPrefs } from '../../../../lib/lok-universe/src/screen';

const ON = 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-cyan-300/60 hover:text-white';
const CHIP = 'min-h-11 border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200';

/**
 * Settings > Full screen and pop-out. The button itself (shared Lok SDK, screen.ts) floats over every
 * screen; this is where the player picks what it does, where it sits, and whether it fades.
 */
export function FullscreenSetting() {
  const t = useT();
  const [prefs, setPrefs] = useState<ScreenPrefs>(() => readScreenPrefs());

  useEffect(() => {
    const sync = () => setPrefs(readScreenPrefs());
    window.addEventListener(SCREEN_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SCREEN_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const set = (next: Partial<ScreenPrefs>) => setPrefs(writeScreenPrefs(next));
  const modes: ScreenMode[] = ['fullscreen', 'popout'];

  return (
    <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-fullscreen-settings">
      <h2 className="text-xl font-black uppercase text-white">{t('screen.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('screen.intro')}</p>

      <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">{t('screen.mode')}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('screen.mode')}>
        {modes.map((m) => (
          <button key={m} type="button" aria-pressed={prefs.mode === m} onClick={() => set({ mode: m })} className={`${CHIP} ${prefs.mode === m ? ON : OFF}`} data-testid={`screen-mode-${m}`}>
            {t(`screen.mode.${m}`)}
          </button>
        ))}
      </div>
      {prefs.mode === 'popout' ? <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{t('screen.popoutNote')}</p> : null}

      <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">{t('screen.place')}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('screen.place')}>
        {SCREEN_PLACES.map((p) => (
          <button key={p} type="button" aria-pressed={prefs.place === p} onClick={() => set({ place: p })} className={`${CHIP} ${prefs.place === p ? ON : OFF}`} data-testid={`screen-place-${p}`}>
            {t(`screen.place.${p}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" aria-pressed={prefs.fade} onClick={() => set({ fade: !prefs.fade })} className={`${CHIP} ${prefs.fade ? ON : OFF}`} data-testid="screen-fade">
          {t('screen.fade')}: {prefs.fade ? t('overlay.value.on') : t('overlay.value.off')}
        </button>
        <button type="button" onClick={() => void pressScreenButton()} className="min-h-11 border border-primary px-4 text-xs font-bold uppercase text-primary hover:bg-primary/10" data-testid="button-toggle-fullscreen">
          {t('screen.tryNow')}
        </button>
      </div>
    </section>
  );
}

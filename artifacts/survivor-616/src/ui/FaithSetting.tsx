import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { FAITH_PREFS_EVENT, openBible, readFaithPrefs, showBounceNow, writeFaithPrefs, type FaithPrefs } from '@/faith/faithSettings';
import { EVERY_MIN } from '@/faith/bounce';

const ON = 'border-amber-300/70 bg-amber-300/15 text-amber-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-amber-300/60 hover:text-white';
const CHIP = 'min-h-11 border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200';

/** Settings > Faith. Optional and free; nothing in the game needs it. Ported from Queens N Kings Faith Mode. */
export function FaithSetting() {
  const t = useT();
  const [p, setP] = useState<FaithPrefs>(() => readFaithPrefs());
  useEffect(() => {
    const sync = () => setP(readFaithPrefs());
    window.addEventListener(FAITH_PREFS_EVENT, sync);
    return () => window.removeEventListener(FAITH_PREFS_EVENT, sync);
  }, []);
  const set = (next: Partial<FaithPrefs>) => setP(writeFaithPrefs(next));
  const on = p.religion !== 'none';
  const chip = (active: boolean, label: string, onClick: () => void, id: string) => (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${CHIP} ${active ? ON : OFF}`} data-testid={id}>
      {label}
    </button>
  );

  return (
    <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-faith-settings">
      <h2 className="text-xl font-black uppercase text-white">{t('faith.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('faith.intro')}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('faith.title')}>
        {chip(!on, t('faith.off'), () => set({ religion: 'none' }), 'faith-off')}
        {chip(on, t('faith.christian'), () => set({ religion: 'christian' }), 'faith-christian')}
      </div>
      {on ? (
        <>
          <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">{t('faith.verseBar')}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('faith.verseBarBody')}</p>
          <div className="mt-2 flex flex-wrap gap-2">{chip(p.verseBar, p.verseBar ? t('overlay.value.on') : t('overlay.value.off'), () => set({ verseBar: !p.verseBar }), 'faith-verse-bar')}</div>

          <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">{t('faith.bounce')}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('faith.bounceBody')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chip(p.bounce, p.bounce ? t('overlay.value.on') : t('overlay.value.off'), () => set({ bounce: !p.bounce }), 'faith-bounce')}
            {p.bounce ? EVERY_MIN.map((m) => chip(p.everyMin === m, t('faith.everyMin', { n: m }), () => set({ everyMin: m }), `faith-every-${m}`)) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={openBible} className="min-h-11 border border-amber-300 px-4 text-xs font-bold uppercase text-amber-200 hover:bg-amber-300/10" data-testid="faith-open-bible">
              {t('faith.openBible')}
            </button>
            <button type="button" onClick={showBounceNow} className="min-h-11 border border-border px-4 text-xs font-bold uppercase text-muted-foreground hover:text-white" data-testid="faith-show-now">
              {t('faith.showNow')}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

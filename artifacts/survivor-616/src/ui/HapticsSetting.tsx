import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { haptic, readHapticPrefs, writeHapticPrefs, hapticSupport, HAPTIC_PREFS_EVENT, HAPTIC_STRENGTHS, type HapticPrefs, type HapticStrength } from '../../../../lib/lok-universe/src/haptics';

const ON = 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-cyan-300/60 hover:text-white';
const CHIP = 'min-h-11 border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';

/**
 * Settings > Haptics. The shared Lok SDK (haptics.ts) does the buzzing; this is where the player picks the
 * strength, turns controller rumble on or off, and tries it. Shared by every Lok app on the same site.
 */
export function HapticsSetting() {
  const t = useT();
  const [prefs, setPrefs] = useState<HapticPrefs>(() => readHapticPrefs());
  const [support, setSupport] = useState(() => hapticSupport());

  useEffect(() => {
    const sync = () => {
      setPrefs(readHapticPrefs());
      setSupport(hapticSupport());
    };
    window.addEventListener(HAPTIC_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('gamepadconnected', sync);
    return () => {
      window.removeEventListener(HAPTIC_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('gamepadconnected', sync);
    };
  }, []);

  const set = (next: Partial<HapticPrefs>) => setPrefs(writeHapticPrefs(next));
  const status = support.phone && support.controller ? 'both' : support.phone ? 'phone' : support.controller ? 'pad' : 'none';

  return (
    <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-haptics-settings">
      <h2 className="text-xl font-black uppercase text-white">{t('haptics.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('haptics.intro')}</p>
      <p className="mt-2 text-xs text-muted-foreground" role="status">{t(`haptics.support.${status}`)}</p>

      <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">{t('haptics.strength')}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('haptics.strength')}>
        {HAPTIC_STRENGTHS.map((s: HapticStrength) => (
          <button key={s} type="button" aria-pressed={prefs.strength === s} onClick={() => { set({ strength: s }); window.setTimeout(() => haptic('crown'), 30); }} className={`${CHIP} ${prefs.strength === s ? ON : OFF}`} data-testid={`haptics-strength-${s}`}>
            {t(`haptics.strength.${s}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" aria-pressed={prefs.controller} onClick={() => set({ controller: !prefs.controller })} className={`${CHIP} ${prefs.controller ? ON : OFF}`} data-testid="haptics-controller">
          {t('haptics.controller')}: {prefs.controller ? t('overlay.value.on') : t('overlay.value.off')}
        </button>
        <button type="button" onClick={() => haptic('win')} className="min-h-11 border border-primary px-4 text-xs font-bold uppercase text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid="haptics-try">
          {t('haptics.tryNow')}
        </button>
      </div>
    </section>
  );
}

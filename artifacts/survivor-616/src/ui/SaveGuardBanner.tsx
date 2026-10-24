import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { saveGuard, useSaveBehind } from '@/lib/saveGuard';

/** Appears when the game is open in two tabs and the other one saved: pick which progress to keep. */
export function SaveGuardBanner() {
  const t = useT();
  const behind = useSaveBehind();
  const { meta, importMeta } = useMeta();
  if (!behind) return null;
  return (
    <div
      role="alert"
      data-testid="save-guard-banner"
      className="fixed inset-x-3 top-3 z-[310] mx-auto max-w-sm border border-amber-300/70 bg-[#2a1c05]/95 px-4 py-3 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.25)]"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">{t('saveGuard.title')}</p>
      <p className="mt-1.5 text-sm leading-snug">{t('saveGuard.body')}</p>
      <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] font-bold uppercase tracking-widest">
        <button
          type="button"
          className="text-amber-300 hover:text-white"
          data-testid="button-save-guard-load"
          onClick={() => {
            const latest = window.localStorage.getItem('survivor616.meta.v1');
            saveGuard.resolve();
            if (latest) {
              const parsed = (() => { try { return JSON.parse(latest) as Record<string, unknown>; } catch { return null; } })();
              if (parsed) importMeta(parsed);
            }
          }}
        >
          {t('saveGuard.load')}
        </button>
        <button
          type="button"
          className="text-amber-300 hover:text-white"
          data-testid="button-save-guard-keep"
          onClick={() => {
            saveGuard.resolve();
            importMeta({ ...meta });
          }}
        >
          {t('saveGuard.keep')}
        </button>
      </div>
    </div>
  );
}

export default SaveGuardBanner;

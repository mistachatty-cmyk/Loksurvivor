import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { TEXT_SIZES, getTextSize, setTextSize, type TextSize } from '@/lib/textScale';

/** Settings row: UI text size for phones, TVs and arcade cabinets viewed from a distance. */
export function TextSizeSetting() {
  const t = useT();
  const [size, setSize] = useState<TextSize>(getTextSize);
  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4" data-testid="setting-text-size">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.textSize.title')}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.textSize.body')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1" role="group" aria-label={t('settings.textSize.title')}>
          {TEXT_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setTextSize(option);
                setSize(option);
              }}
              aria-pressed={size === option}
              className={`min-h-11 border px-4 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors active:scale-95 ${
                size === option
                  ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                  : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
              }`}
              data-testid={`button-text-size-${option}`}
            >
              {t(`settings.textSize.${option}` as const)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

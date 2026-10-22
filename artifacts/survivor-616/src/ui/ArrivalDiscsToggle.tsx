import { useState } from 'react';

import { readArrivalDiscsSetting, writeArrivalDiscsSetting } from '@/lib/arrivalDiscs';
import { resetDiscGuard } from '@/lib/discGuard';
import { useT } from '@/lib/i18n';

/** Settings row for the opt-in floating-CD shelf on the arrival screen. */
export function ArrivalDiscsToggle() {
  const t = useT();
  const [on, setOn] = useState(readArrivalDiscsSetting);

  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.arrivalDiscs.title')}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.arrivalDiscs.body')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            writeArrivalDiscsSetting(!on);
            if (!on) resetDiscGuard();
            setOn(!on);
          }}
          aria-pressed={on}
          className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            on
              ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
              : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
          }`}
          data-testid="button-toggle-arrival-discs"
        >
          {on ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

export default ArrivalDiscsToggle;

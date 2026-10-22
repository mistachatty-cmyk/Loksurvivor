import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { crashReportsEnabled, setCrashReportsEnabled } from '@/lib/lokCrash';

/** Settings row: lets a player stop crash reports from being sent (they stay on the device). */
export function CrashReportsToggle() {
  const t = useT();
  const [on, setOn] = useState(crashReportsEnabled);

  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.crashReports.title')}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.crashReports.body')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCrashReportsEnabled(!on);
            setOn(!on);
          }}
          aria-pressed={on}
          className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            on
              ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100'
              : 'border-border bg-background text-muted-foreground hover:border-cyan-300/60 hover:text-white'
          }`}
          data-testid="button-toggle-crash-reports"
        >
          {on ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

export default CrashReportsToggle;

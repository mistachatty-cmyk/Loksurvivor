/**
 * Two-page Settings: "Standard" and, once the player has cleared every standard
 * map, "End game". Switching slides the incoming page in from the side it
 * belongs on (End game is to the right of Standard). Before the end game is
 * reached there is no tab and no trace of the second page.
 */
import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

import { endgameReached } from '@/game/data/endgameUnlocks';
import { useMeta } from '@/game/state/metaStore';
import { earnedEndgameIds } from '@/game/state/operatorForgeStore';
import { useT } from '@/lib/i18n';

type Page = 'standard' | 'endgame';

export function SettingsPager({ standard, endgame }: { standard: ReactNode; endgame: ReactNode }) {
  const { meta } = useMeta();
  const t = useT();
  const [page, setPage] = useState<Page>('standard');
  const [direction, setDirection] = useState<'right' | 'left'>('right');
  const accessible = meta.devModeAllUnlocks || endgameReached(meta) || earnedEndgameIds().length > 0;

  const go = (next: Page) => {
    if (next === page) return;
    setDirection(next === 'endgame' ? 'right' : 'left');
    setPage(next);
  };

  if (!accessible) return <>{standard}</>;

  const tab = (id: Page, label: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={page === id}
      onClick={() => go(id)}
      className={`relative flex-1 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${page === id ? 'text-white' : 'text-muted-foreground hover:text-white'}`}
      data-testid={`tab-settings-${id}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div role="tablist" aria-label={t('settings.tabs.aria')} className="relative mb-5 flex border border-border bg-card/60" data-testid="settings-tabs">
        {tab('standard', t('settings.tabs.standard'))}
        {tab('endgame', (<span className="inline-flex items-center justify-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />{t('settings.tabs.endgame')}</span>))}
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 w-1/2 bg-gradient-to-r from-primary via-fuchsia-300 to-amber-300 transition-transform duration-300 ease-out"
          style={{ transform: page === 'standard' ? 'translateX(0)' : 'translateX(100%)' }}
        />
      </div>
      <div className="overflow-x-clip">
        <div key={page} className={direction === 'right' ? 'settings-slide-from-right' : 'settings-slide-from-left'} role="tabpanel" data-testid={`page-settings-${page}`}>
          {page === 'standard' ? standard : endgame}
        </div>
      </div>
    </div>
  );
}

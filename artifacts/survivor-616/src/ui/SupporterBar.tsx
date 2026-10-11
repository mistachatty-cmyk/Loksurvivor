/**
 * Live supporter hologram bar: a thank-you ticker streaming across the bottom of the game.
 * Teal/blue for Lok Pass and Lok Passport holders, gold (with a founder star) for Lifetime
 * holders. The feed is the permanent record (`lok_supporters`), so it keeps thanking people
 * after a subscription ends. Renders nothing offline or while the list is empty.
 */
import { useEffect, useState } from 'react';

import { fetchSupporterFeed, SUPPORTER_BAR_LABEL, SUPPORTER_REFRESH_MS, supporterItemText, supporterScrollSeconds, type SupporterFeedEntry } from '@workspace/lok-client';

import { lokClient } from '@/lib/lokClient';

/** One feed per page load per 10 minutes (shared by every bar on screen) -- see docs/LOK_COST_DISCIPLINE.md. */
let cache: { at: number; entries: SupporterFeedEntry[] } | null = null;

export function SupporterBar({ variant = 'strip' }: { variant?: 'strip' | 'inline' }) {
  const [entries, setEntries] = useState<SupporterFeedEntry[]>([]);

  useEffect(() => {
    if (!lokClient) return;
    let alive = true;
    const load = () => {
      if (cache && Date.now() - cache.at < SUPPORTER_REFRESH_MS) {
        setEntries(cache.entries);
        return;
      }
      void fetchSupporterFeed(lokClient!).then((result) => {
        if (!result.ok) return;
        cache = { at: Date.now(), entries: result.entries };
        if (alive) setEntries(result.entries);
      });
    };
    load();
    const id = window.setInterval(load, SUPPORTER_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (entries.length === 0) return null;
  const duration = supporterScrollSeconds(entries.length);
  const row = (suffix: string) =>
    entries.map((entry, index) => (
      <span key={`${suffix}${index}`} className="supporter-bar__item" data-tier={entry.tier} data-founder={entry.founder}>
        {supporterItemText(entry)}
      </span>
    ));

  return (
    <div className={`supporter-bar${variant === 'inline' ? ' supporter-bar--inline' : ''}`} role="region" aria-label="Lok supporters" data-testid={`supporter-bar-${variant}`}>
      <span className="supporter-bar__label">{SUPPORTER_BAR_LABEL}</span>
      <div className="supporter-bar__lane">
        <div className="supporter-bar__track" style={{ animationDuration: `${duration}s` }}>
          {row('a')}
          <span aria-hidden="true" className="contents">{row('b')}</span>
        </div>
      </div>
    </div>
  );
}

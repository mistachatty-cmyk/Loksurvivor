/**
 * Live supporter hologram bar: a thank-you ticker streaming across the bottom of the game.
 * Teal/blue for Lok Pass and Lok Passport holders, gold (with a founder star) for Lifetime
 * holders. The feed is the permanent record (`lok_supporters`), so it keeps thanking people
 * after a subscription ends. Renders nothing offline or while the list is empty.
 */
import { useEffect, useState } from 'react';

import { fetchSupporterFeed, type SupporterFeedEntry } from '@workspace/lok-client';

import { lokClient } from '@/lib/lokClient';

const REFRESH_MS = 10 * 60 * 1000;
/** Seconds each name stays on screen while it crosses; keeps the speed steady as the list grows. */
const SECONDS_PER_ENTRY = 5;

export function SupporterBar() {
  const [entries, setEntries] = useState<SupporterFeedEntry[]>([]);

  useEffect(() => {
    if (!lokClient) return;
    let alive = true;
    const load = () => {
      void fetchSupporterFeed(lokClient!).then((result) => {
        if (alive && result.ok) setEntries(result.entries);
      });
    };
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (entries.length === 0) return null;
  const duration = Math.max(30, entries.length * SECONDS_PER_ENTRY);
  const row = (suffix: string) =>
    entries.map((entry, index) => (
      <span key={`${suffix}${index}`} className="supporter-bar__item" data-tier={entry.tier} data-founder={entry.founder}>
        {entry.founder ? '★ ' : '◆ '}{entry.display}{entry.founder ? ' · FOUNDER' : ''}
      </span>
    ));

  return (
    <div className="supporter-bar" role="region" aria-label="Lok supporters" data-testid="supporter-bar">
      <span className="supporter-bar__label">LOK SUPPORTERS · THANK YOU</span>
      <div className="supporter-bar__lane">
        <div className="supporter-bar__track" style={{ animationDuration: `${duration}s` }}>
          {row('a')}
          <span aria-hidden="true" className="contents">{row('b')}</span>
        </div>
      </div>
    </div>
  );
}

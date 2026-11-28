/**
 * The Crew overlay's Games tab: every Lok mode a crew can play, from the shared Game Directory. Multiplayer
 * modes sit on top; offline ones are in a scroll underneath. The crew leader is the host: tapping an online
 * mode opens it and invites the crew, and everyone with "Follow the host" on is taken along.
 */
import { useEffect, useState } from 'react';

import { useT } from '@/lib/i18n';
import { GAME_DIRECTORY } from '@/lib/crewDirectory';
import { CREW_FOLLOW_EVENT, getFollow, markCrewLaunch, setFollow } from '@/lib/crewFollowPref';
import { isLeader } from '@/lib/social/crewRules';
import { useSocial } from '@/state/socialStore';
import type { DirectoryRow } from '../../../../lib/lok-universe/src/gameDirectory';

const BTN = 'w-full border border-border px-3 py-3 text-left font-mono text-[11px] font-bold uppercase tracking-widest text-white/85 hover:border-fuchsia-300/60 hover:text-white disabled:opacity-40';

function open(row: DirectoryRow, host: boolean) {
  if (host && row.kind === 'online') markCrewLaunch(row.id);
  window.location.assign(`/${row.route}`);
}

export function CrewGamesTab() {
  const t = useT();
  const s = useSocial();
  const [follow, setFollowState] = useState(getFollow);
  useEffect(() => {
    const sync = () => setFollowState(getFollow());
    window.addEventListener(CREW_FOLLOW_EVENT, sync);
    return () => window.removeEventListener(CREW_FOLLOW_EVENT, sync);
  }, []);
  const hasCrew = s.crew.members.length >= 2;
  const host = hasCrew && isLeader(s.crew, s.me?.userId);
  const size = Math.max(1, s.crew.members.length);
  const multi = GAME_DIRECTORY.multiplayer();
  const offline = GAME_DIRECTORY.offline();
  const name = (r: DirectoryRow) => (r.modeName ? `${r.name}: ${r.modeName}` : r.name);

  return (
    <div className="space-y-4 p-4" data-testid="crew-games">
      <label className="flex items-center justify-between gap-3 border border-border/70 p-3">
        <span>
          <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-white">{t('crew.games.follow')}</span>
          <span className="block text-xs text-muted-foreground">{t('crew.games.followHint')}</span>
        </span>
        <input type="checkbox" role="switch" checked={follow} onChange={(e) => setFollow(e.target.checked)} aria-label={t('crew.games.follow')} className="h-5 w-5" data-testid="switch-crew-follow" />
      </label>
      <p className="text-sm text-muted-foreground" role="status">
        {!hasCrew ? t('crew.games.noCrew') : host ? t('crew.games.youHost') : t('crew.games.hostPicks')}
      </p>
      <section className="space-y-2" aria-label={t('crew.games.multi')}>
        <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.25em] text-fuchsia-200">{t('crew.games.multi')}</h4>
        {multi.map((row) => {
          const fits = size >= row.minPlayers && size <= row.maxPlayers;
          return (
            <button key={row.id} type="button" className={BTN} disabled={hasCrew && !host && row.kind === 'online'} onClick={() => open(row, host)} data-testid={`crew-game-${row.id}`}>
              {name(row)}
              <span className="block text-[10px] font-normal normal-case tracking-normal text-white/55">
                {t('crew.games.players', { min: row.minPlayers, max: row.maxPlayers })}{hasCrew && !fits ? ` · ${t('crew.games.sizeNote')}` : ''}
              </span>
            </button>
          );
        })}
      </section>
      <section className="max-h-48 space-y-2 overflow-y-auto" aria-label={t('crew.games.solo')}>
        <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.25em] text-white/55">{t('crew.games.solo')}</h4>
        {offline.map((row) => (
          <button key={row.id} type="button" className={BTN} onClick={() => open(row, false)} data-testid={`crew-game-${row.id}`}>{name(row)}</button>
        ))}
      </section>
    </div>
  );
}

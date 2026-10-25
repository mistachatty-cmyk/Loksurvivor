/**
 * Everything around starting or joining a crew run: the "Start a crew run" request from the Crew overlay,
 * the "your crew is in a run" prompt, and the small dialog to pick an operator (and, for the host, an area).
 * The run itself is `game/CrewRunScreen.tsx`.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { areaOpen, useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { openCrewRun } from '@/lib/social/crewRun';
import { useSocial } from '@/state/socialStore';

export const HOST_CREW_RUN_EVENT = 'lok:host-crew-run';
export function requestHostCrewRun(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HOST_CREW_RUN_EVENT));
}

/** Screens where a prompt would get in the way. */
const QUIET_SCREENS = ['run', 'crew-run', 'arena', 'photosensitivity-notice', 'starter-lokpet-encounter', 'run-setup', 'jukebox'];

const BTN = 'border border-border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:border-fuchsia-300/60 hover:text-white';
const BTN_ON = 'border border-emerald-300/60 bg-emerald-400/15 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-100';

interface Setup { mode: 'host' | 'join'; crewId: string; hostName?: string }

export interface CrewRunLaunch { role: 'host' | 'guest'; crewId: string; characterId: string; areaId?: string }

export function CrewRunController({ screenName, onLaunch }: { screenName: string; onLaunch: (launch: CrewRunLaunch) => void }) {
  const t = useT();
  const social = useSocial();
  const { meta } = useMeta();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const characters = useMemo(
    () => CHARACTERS.filter((c) =>
      (meta.unlockedCharacterIds.includes(c.id) || meta.devModeAllUnlocks) &&
      (!c.lokPetCollector || meta.lokPetCollectorAccessUnlocked || meta.devModeAllUnlocks)),
    [meta.unlockedCharacterIds, meta.devModeAllUnlocks, meta.lokPetCollectorAccessUnlocked],
  );
  const areas = useMemo(() => AREAS.filter((a) => areaOpen(a, meta)), [meta]);
  const [characterId, setCharacterId] = useState('');
  const [areaId, setAreaId] = useState('');
  useEffect(() => {
    if (!characterId) setCharacterId(characters.find((c) => c.id === meta.selectedCharacterId)?.id ?? characters[0]?.id ?? '');
    if (!areaId) setAreaId(areas[0]?.id ?? '');
  }, [characters, areas, characterId, areaId, meta.selectedCharacterId]);

  // "Start a crew run" from the Crew overlay.
  useEffect(() => {
    const onHost = () => {
      const crewId = social.crew.crew?.id;
      if (crewId) setSetup({ mode: 'host', crewId });
    };
    window.addEventListener(HOST_CREW_RUN_EVENT, onHost);
    return () => window.removeEventListener(HOST_CREW_RUN_EVENT, onHost);
  }, [social.crew.crew?.id]);

  const open = openCrewRun(social.crew, social.online, social.me?.userId);
  // A dismissed prompt comes back for the next run, not the same one.
  useEffect(() => { if (!open) setDismissed(null); }, [open]);

  const showPrompt = Boolean(open) && dismissed !== open?.userId && !setup && !QUIET_SCREENS.includes(screenName) && social.active;

  const launch = () => {
    if (!setup || !characterId) return;
    onLaunch(setup.mode === 'host' ? { role: 'host', crewId: setup.crewId, characterId, areaId } : { role: 'guest', crewId: setup.crewId, characterId });
    setSetup(null);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {showPrompt && open ? (
        <div className="fixed bottom-[max(1rem,var(--safe-bottom))] left-1/2 z-[124] flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-3 border border-emerald-300/40 bg-slate-950/95 p-3 shadow-2xl" role="status" data-testid="crewrun-prompt">
          <p className="min-w-0 flex-1 text-sm text-white">{t('crewrun.prompt', { name: open.name })}</p>
          <button type="button" className={BTN_ON} onClick={() => setSetup({ mode: 'join', crewId: open.room, hostName: open.name })} data-testid="button-crewrun-prompt-join">{t('crewrun.promptJoin')}</button>
          <button type="button" className={BTN} onClick={() => setDismissed(open.userId)}>{t('crewrun.promptLater')}</button>
        </div>
      ) : null}
      {setup ? (
        <div className="fixed inset-0 z-[135] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSetup(null)} data-testid="crewrun-setup">
          <div className="w-full max-w-sm space-y-3 border border-border bg-slate-950 p-4" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-lg font-black uppercase text-white">{setup.mode === 'host' ? t('crewrun.setup.hostTitle') : t('crewrun.setup.joinTitle', { name: setup.hostName ?? '' })}</h3>
            <p className="text-sm text-muted-foreground">{t('crewrun.setup.body')}</p>
            <label className="block space-y-1 font-mono text-[10px] uppercase tracking-widest text-white/60">{t('crewrun.setup.operator')}
              <select value={characterId} onChange={(event) => setCharacterId(event.target.value)} className="w-full border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal text-white" data-testid="select-crewrun-character">
                {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {setup.mode === 'host' ? (
              <label className="block space-y-1 font-mono text-[10px] uppercase tracking-widest text-white/60">{t('crewrun.setup.area')}
                <select value={areaId} onChange={(event) => setAreaId(event.target.value)} className="w-full border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal text-white" data-testid="select-crewrun-area">
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            ) : null}
            <div className="flex gap-2">
              <button type="button" className={BTN_ON} onClick={launch} disabled={!characterId} data-testid="button-crewrun-go">{setup.mode === 'host' ? t('crewrun.setup.open') : t('crewrun.setup.join')}</button>
              <button type="button" className={BTN} onClick={() => setSetup(null)}>{t('crewrun.setup.cancel')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}

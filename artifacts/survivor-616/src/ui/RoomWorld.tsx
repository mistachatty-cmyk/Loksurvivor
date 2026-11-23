/**
 * The 616 bedroom and the Lok hall as one flow. Holds which room you are in, the hall lever, and short notices.
 * Panel objects hand back to the app (which opens the same screen the menu button does); doors switch rooms
 * here; the door to Queens N Kings opens that game in a new tab.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHallChoice, pullLever, resolveBedroomDoor, saveHallChoice, type HallChoice, type RoomAnchor } from '../../../../lib/lok-universe/src/rooms';
import { useMeta } from '@/game/state/metaStore';
import { bedroomStatus } from '@/game/data/roomStatus';
import { BEDROOM_616, UNIVERSAL_HALL } from '@/game/data/rooms616';
import type { CharacterDef } from '@/game/types';
import { useT, type MessageKey } from '@/lib/i18n';
import { RoomScreen } from './RoomScreen';
import { SKIN_BEDROOM_616, SKIN_LOK_HALL } from './roomSkins';

const QNK_URL = 'https://queens.gsix.online';

export interface RoomWorldProps {
  character: CharacterDef;
  onOpenPanel: (panel: string) => void;
  onExit: () => void;
  /** Which room to open in (the app returns you to the bedroom after a panel). */
  initialRoom?: 'room.616' | 'hall.lok';
  onRoomChange?: (room: 'room.616' | 'hall.lok') => void;
}

export function RoomWorld({ character, onOpenPanel, onExit, initialRoom = 'room.616', onRoomChange }: RoomWorldProps) {
  const t = useT();
  const { meta, claimDailyLogin } = useMeta();
  const status = useMemo(() => bedroomStatus(meta), [meta]);
  const [room, setRoom] = useState<'room.616' | 'hall.lok'>(initialRoom);
  const [choice, setChoice] = useState<HallChoice>(() => loadHallChoice('survivor'));
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(undefined), 3500); return () => window.clearTimeout(id); }, [notice]);

  const go = useCallback((next: 'room.616' | 'hall.lok') => { setRoom(next); onRoomChange?.(next); setNotice(undefined); }, [onRoomChange]);

  const labelFor = useCallback((a: RoomAnchor) => {
    if (a.enabled === false) return t(a.id === 'hall-616' ? 'room.door.hall616' : 'room.door.soon');
    switch (a.action.type) {
      case 'panel': { const n = status[a.id]?.count; const base = t(`hub.room.${a.action.panel}.label` as MessageKey); return a.id === 'lok-shop' || n === undefined ? base : `${base} (${n})`; }
      case 'lever': return t('room.lever');
      case 'door': return a.id === 'home' ? t('room.door.home') : t('room.door.hallLok');
      case 'external': return t('room.door.hallQnk');
      case 'note': return t(a.action.key as MessageKey);
      default: return '';
    }
  }, [t, status]);

  const onUse = useCallback((a: RoomAnchor) => {
    if (a.enabled === false) { setNotice(t(a.id === 'hall-616' ? 'room.hall616.closed' : 'room.note.moreGames')); return; }
    const act = a.action;
    if (a.id === 'stash') {
      if (status.stash?.alert) { claimDailyLogin(); setNotice(t('room.stash.claimed')); } else setNotice(t('room.stash.empty'));
      return;
    }
    if (act.type === 'panel') onOpenPanel(act.panel);
    else if (act.type === 'lever') {
      const res = pullLever('survivor', choice);
      setChoice(res.choice);
      saveHallChoice('survivor', res.choice);
      setNotice(t(res.shut ? 'room.lever.held' : res.choice === 'public' ? 'room.lever.public' : 'room.lever.universal'));
    } else if (act.type === 'door') {
      if (act.to === 'room.616') go('room.616');
      else go(resolveBedroomDoor('survivor', choice) === 'hall.lok' ? 'hall.lok' : 'hall.lok');   // no public 616 hall yet
    } else if (act.type === 'external') {
      setNotice(t('room.qnk.leaving'));
      window.open(QNK_URL, '_blank', 'noopener');
    } else if (act.type === 'note') setNotice(t(act.key as MessageKey));
  }, [choice, go, onOpenPanel, t, status, claimDailyLogin]);

  const inRoom = room === 'room.616';
  return (
    <RoomScreen
      key={room}
      layout={inRoom ? BEDROOM_616 : UNIVERSAL_HALL}
      skin={inRoom ? SKIN_BEDROOM_616 : SKIN_LOK_HALL}
      character={character}
      labelFor={labelFor}
      onUse={onUse}
      onBack={inRoom ? onExit : () => go('room.616')}
      title={t(inRoom ? 'room.title.616' : 'room.title.lok')}
      leverPublic={choice === 'public'}
      notice={notice}
      status={inRoom ? status : undefined}
      testId={inRoom ? 'room-616' : 'room-lok-hall'}
    />
  );
}

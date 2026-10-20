/**
 * Quick room-jump drawer for the Hideout: a small arrow tab docked to the
 * right edge, vertically centered so it can never collide with the other
 * fixed corner chrome (Looks & LokPets, companion chip, sticky Head out).
 * Clicking it slides the panel in/out via a plain CSS transform transition
 * (see .hideout-direction-slide in index.css) -- this is a persistent
 * toggle, not a one-shot page transition, so it doesn't need the
 * keyframe+remount trick RunSetupScreen/SettingsPager use for paging.
 *
 * Purely a second way to reach rooms the inline Hideout/Travel grid already
 * lists further down the page -- same room data, same onEnterRoom callback,
 * nothing new to persist.
 */
import { ChevronLeft, Lock } from 'lucide-react';
import { useState } from 'react';

import { describeUnlock } from '@/game/state/metaStore';
import type { HubRoomDef } from '@/game/types';
import { useT } from '@/lib/i18n';

export interface HideoutDirectionPanelProps {
  hideoutRooms: HubRoomDef[];
  travelRooms: HubRoomDef[];
  lockedHideoutRooms: HubRoomDef[];
  lockedTravelRooms: HubRoomDef[];
  roomId: string;
  onEnterRoom: (id: string) => void;
  travelEncountersEnabled: boolean;
}

function RoomGroup({
  title,
  accent,
  rooms,
  locked,
  roomId,
  onEnterRoom,
  travelEncountersEnabled,
  showBadge,
}: {
  title: string;
  accent: string;
  rooms: HubRoomDef[];
  locked: HubRoomDef[];
  roomId: string;
  onEnterRoom: (id: string) => void;
  travelEncountersEnabled: boolean;
  showBadge: boolean;
}) {
  if (rooms.length === 0 && locked.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[9px] font-black uppercase tracking-[0.2em] ${accent}`}>{title}</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {rooms.map((room) => {
          const isActive = room.id === roomId;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onEnterRoom(room.id)}
              className={`flex items-center justify-between gap-2 border px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
              }`}
              data-active={isActive}
              data-testid={`button-direction-room-${room.id}`}
            >
              <span className="truncate">{room.name}</span>
              {showBadge && room.kind === 'travel' && travelEncountersEnabled && (
                <span className="shrink-0 border border-amber-400/50 px-1 py-0.5 font-mono text-[7px] tracking-wider text-amber-300">!</span>
              )}
            </button>
          );
        })}
        {locked.map((room) => (
          <div
            key={room.id}
            className="flex items-center gap-1.5 border border-dashed border-border px-2.5 py-2 text-[10px] uppercase tracking-wide text-muted-foreground/70"
            title={describeUnlock(room.unlock)}
            data-testid={`direction-locked-room-${room.id}`}
          >
            <Lock className="h-3 w-3 shrink-0" />
            <span className="truncate">{room.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HideoutDirectionPanel({
  hideoutRooms,
  travelRooms,
  lockedHideoutRooms,
  lockedTravelRooms,
  roomId,
  onEnterRoom,
  travelEncountersEnabled,
}: HideoutDirectionPanelProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? t('hub.directionPanel.close') : t('hub.directionPanel.open')}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex min-h-11 w-6 items-center justify-center border border-border bg-card/90 text-muted-foreground backdrop-blur transition-colors hover:border-primary hover:text-white"
        data-testid="button-hideout-direction-toggle"
      >
        <ChevronLeft className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div
        className={`hideout-direction-slide fixed right-0 top-1/2 z-30 w-60 max-h-[70vh] -translate-y-1/2 overflow-y-auto border border-border bg-card/95 p-3 backdrop-blur ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        data-testid="hideout-direction-panel"
      >
        <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-primary">{t('hub.directionPanel.title')}</p>
        <div className="flex flex-col gap-3">
          <RoomGroup
            title={t('hub.nav.hideout.title')}
            accent="text-emerald-300"
            rooms={hideoutRooms}
            locked={lockedHideoutRooms}
            roomId={roomId}
            onEnterRoom={onEnterRoom}
            travelEncountersEnabled={travelEncountersEnabled}
            showBadge={false}
          />
          <RoomGroup
            title={t('hub.nav.travel.title')}
            accent="text-amber-300"
            rooms={travelRooms}
            locked={lockedTravelRooms}
            roomId={roomId}
            onEnterRoom={onEnterRoom}
            travelEncountersEnabled={travelEncountersEnabled}
            showBadge
          />
        </div>
      </div>
    </>
  );
}

export default HideoutDirectionPanel;

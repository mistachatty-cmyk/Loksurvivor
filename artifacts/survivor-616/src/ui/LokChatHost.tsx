import { useCallback } from 'react';

import { AREAS } from '@/game/data/areas';
import { getHideoutScene } from '@/game/data/hideout';
import { HUB_ROOMS_BY_ID } from '@/game/data/progression';
import { travelLeadPet } from '@/game/data/travelEncounters';
import { petCallName } from '@/game/engine/petGrowth';
import type { ChatContext } from '@/game/engine/lokChat';
import { getCrewTalkTone } from '@/game/state/crewTalkSetting';
import { useMeta } from '@/game/state/metaStore';
import { closeLokChat, useLokChatOpen } from '@/lib/lokChatOpen';
import { LokChatOverlay } from './LokChat';

/** What a crew member knows when you message them. Shared by the hideout (proactive lines) and the chat window. */
export function useChatContextBuilder(): (allyId: string, affinity: number) => ChatContext {
  const { rescuedAllies, lastRun, meta } = useMeta();
  return useCallback(
    (allyId, affinity) => {
      const ally = rescuedAllies.find((candidate) => candidate.id === allyId) ?? rescuedAllies[0]!;
      const run = lastRun ? { cleared: lastRun.cleared, kills: lastRun.kills, areaName: AREAS.find((area) => area.id === lastRun.areaId)?.name ?? lastRun.areaId } : undefined;
      const companion = travelLeadPet(meta);
      return {
        self: { id: ally.id, name: ally.name, role: ally.role },
        others: rescuedAllies.filter((other) => other.id !== ally.id).map((other) => ({ id: other.id, name: other.name, role: other.role })),
        roomName: HUB_ROOMS_BY_ID[ally.room]?.name ?? ally.room,
        crewHere: rescuedAllies.filter((other) => other.room === ally.room && other.id !== ally.id).map((other) => other.name),
        weather: getHideoutScene(ally.room).weather,
        hour: new Date().getHours(),
        lastRun: run,
        petName: companion ? petCallName(companion) : undefined,
        tone: getCrewTalkTone(),
        affinity,
      };
    },
    [rescuedAllies, lastRun, meta],
  );
}

/**
 * The one LOK Chat window, mounted above every screen so the nav dock can open it from any page.
 * Open it with `openLokChat()` from `@/lib/lokChatOpen`.
 */
export function LokChatHost() {
  const { open, view } = useLokChatOpen();
  const { rescuedAllies } = useMeta();
  const buildContext = useChatContextBuilder();
  if (!open) return null;
  return (
    <LokChatOverlay
      allies={rescuedAllies}
      buildContext={buildContext}
      roomNameOf={(ally) => HUB_ROOMS_BY_ID[ally.room]?.name ?? ally.room}
      initialView={view}
      onClose={closeLokChat}
    />
  );
}

export default LokChatHost;

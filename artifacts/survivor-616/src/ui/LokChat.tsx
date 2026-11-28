/**
 * LOK Chat in 616 Survivor: the window and launcher come from `@lok/chat/react`; this wires in the game's
 * words (`en.json`), art (the procedural rig portraits), settings and the shared chat runtime. Rendered from
 * HubScreen the way LorePopup is. Replies come from the authored chat rules, not a model.
 */
import { useMemo } from 'react';
import { LokChatLauncher as ChatLauncher, LokChatWindow, type LokChatFeatureSource, type LokChatPerson } from '@lok/chat/react';

import { prefersReducedMotion } from '@/anim/motion';
import { chatActions, chatStore } from '@/game/chat/runtime';
import { allyRig } from '@/game/data/progression';
import type { ContextBuilder } from '@/game/state/lokChatActions';
import type { AllyDef } from '@/game/types';
import { useT } from '@/lib/i18n';
import { lokChatStrings } from '@/lib/lokChatStrings';
import { lokChatFeatureOn, onLokChatSettingChange } from '@/lib/lokChatSetting';

import { RigPortrait } from './RigPortrait';

const runtime = { store: chatStore, actions: chatActions };
const features: LokChatFeatureSource = { isOn: lokChatFeatureOn, subscribe: onLokChatSettingChange };

/** The hub's button for opening LOK Chat, with an unread badge. */
export function LokChatLauncher({ onOpen, className = '' }: { onOpen: () => void; className?: string }) {
  const t = useT();
  return <ChatLauncher runtime={runtime} strings={lokChatStrings(t)} features={features} onOpen={onOpen} className={className} />;
}

export interface LokChatOverlayProps {
  /** Rescued crew, in the order to list them. */
  allies: readonly AllyDef[];
  buildContext: ContextBuilder;
  /** Display name of the room an ally is in. */
  roomNameOf: (ally: AllyDef) => string;
  /** Open this conversation first. */
  initialId?: string | null;
  onClose: () => void;
}

export function LokChatOverlay({ allies, buildContext, roomNameOf, initialId, onClose }: LokChatOverlayProps) {
  const t = useT();
  const people = useMemo<LokChatPerson[]>(() => allies.map((a) => ({ id: a.id, name: a.name, role: a.role, accent: a.palette.accent })), [allies]);
  const byId = useMemo(() => new Map(allies.map((a) => [a.id, a] as const)), [allies]);
  return (
    <LokChatWindow
      people={people}
      runtime={runtime}
      buildContext={buildContext}
      roomNameOf={(person) => { const ally = byId.get(person.id); return ally ? roomNameOf(ally) : ''; }}
      strings={lokChatStrings(t)}
      features={features}
      reduceMotion={prefersReducedMotion()}
      handleOf={(person) => `@${person.id}.lok`}
      renderAvatar={(person, size) => { const ally = byId.get(person.id); return ally ? <RigPortrait rig={allyRig(ally)} palette={ally.palette} size={size} animated={false} /> : null; }}
      initialId={initialId}
      onClose={onClose}
    />
  );
}

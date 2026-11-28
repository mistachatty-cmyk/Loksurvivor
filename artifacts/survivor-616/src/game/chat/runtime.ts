/** The one chat runtime for 616 Survivor: the shared engine, bound to this game's cast, store and settings. */
import { createChatActions, createChatEngine, createChatStore } from '@lok/chat';

import { DEFAULT_CREW_TEMPERAMENT, crewTemperamentFor } from '@/game/data/crewTemperaments';
import { lokChatFeatures } from '@/lib/lokChatSetting';
import { SURVIVOR_CAST } from './cast';

export const chatEngine = createChatEngine(SURVIVOR_CAST, { features: lokChatFeatures });
export const chatStore = createChatStore({ key: 'survivor616.lokchat.v1' });
export const chatActions = createChatActions({
  engine: chatEngine,
  store: chatStore,
  features: lokChatFeatures,
  // Quick people answer fast, slow ones take their time.
  pace: (id) => DEFAULT_CREW_TEMPERAMENT.speed / crewTemperamentFor(id).speed,
});

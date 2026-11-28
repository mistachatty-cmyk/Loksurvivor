/**
 * Sending, delivering, proactive messages and `#hideout` logging now come from `@lok/chat`
 * (`createChatActions`); this binds them to 616 Survivor's runtime and keeps the old import path.
 */
export type { ContextBuilder, SendResult } from '@lok/chat';

import { chatActions } from '@/game/chat/runtime';

export const { setOpenThread, deliver, sendToAlly, startProactive, logCrewLine, runScenes, sendToGroup, recordEvent } = chatActions;

/**
 * LOK Chat's saved conversations now come from `@lok/chat` (see `docs/LOK_CHAT.md`). This keeps the old
 * import path: the pure reducers come from the package and the store is this game's own
 * (`survivor616.lokchat.v1` in localStorage, deliberately not part of the meta save).
 */
export {
  CHANNEL_ENTRIES,
  MESSAGES_PER_THREAD,
  ME,
  addAffinity,
  appendMessage,
  emptyState,
  emptyThread,
  logChannel,
  markRead,
  normalizeLokChat,
  recordIntent,
  setConv,
  setProactiveAt,
  threadOf,
  totalUnread,
} from '@lok/chat';
export type { ChannelEntry, ChatMessage, ChatThread, LokChatState } from '@lok/chat';

import { chatStore } from '@/game/chat/runtime';

export const getLokChat = chatStore.get;
export const updateLokChat = chatStore.update;
export const subscribeLokChat = chatStore.subscribe;
export const clearLokChat = chatStore.clear;
export const resetLokChatForTests = chatStore.resetForTests;
export const newMessageId = chatStore.newMessageId;
export const useLokChat = chatStore.useChat;

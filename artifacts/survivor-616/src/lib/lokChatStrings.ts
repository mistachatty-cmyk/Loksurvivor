import type { LokChatStrings } from '@lok/chat/react';

import type { useT } from '@/lib/i18n';

/** The chat window's words from `en.json` (`lokChat.*`), so it translates like the rest of the game. */
export function lokChatStrings(t: ReturnType<typeof useT>): LokChatStrings {
  const k = (key: string, vars?: Record<string, unknown>): string => t(`lokChat.${key}` as never, vars as never) as string;
  return {
    title: k('title'),
    footer: k('footer'),
    clear: k('clear'),
    clearConfirm: k('clearConfirm'),
    close: k('close'),
    chats: k('chats'),
    channel: k('channel'),
    channelBlurb: k('channelBlurb'),
    channelEmpty: k('channelEmpty'),
    channelPlaceholder: k('channelPlaceholder'),
    noCrew: k('noCrew'),
    unreadCount: (count) => k('unreadCount', { count }),
    you: k('you'),
    tier: { new: k('tier.new'), friend: k('tier.friend'), close: k('tier.close') },
    here: (room) => k('here', { room }),
    empty: (name) => k('empty', { name }),
    typing: (name) => k('typing', { name }),
    suggested: k('suggested'),
    placeholder: (name) => k('placeholder', { name }),
    send: k('send'),
    back: k('back'),
    open: k('open'),
    openAria: k('openAria'),
    openAriaUnread: (count) => k('openAriaUnread', { count }),
    quickLabel: (key, params) => t(key as never, params as never) as string,
  };
}

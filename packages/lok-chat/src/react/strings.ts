/** Every word LOK Chat's window shows, so an app can translate or retheme it (same pattern as `@lok/error-report/react`). */
export interface LokChatStrings {
  title: string;
  footer: string;
  clear: string;
  clearConfirm: string;
  close: string;
  chats: string;
  channel: string;
  channelBlurb: string;
  channelEmpty: string;
  channelPlaceholder: string;
  noCrew: string;
  unreadCount: (count: number) => string;
  you: string;
  tier: { new: string; friend: string; close: string };
  here: (room: string) => string;
  empty: (name: string) => string;
  typing: (name: string) => string;
  suggested: string;
  placeholder: (name: string) => string;
  send: string;
  back: string;
  open: string;
  openAria: string;
  openAriaUnread: (count: number) => string;
  /** Label for a quick reply, from the engine's key (`lokChat.quick.howAreYou`) and its params. */
  quickLabel: (key: string, params?: Record<string, string>) => string;
}

const QUICK: Record<string, string> = {
  howAreYou: 'How are you?',
  story: "What's new?",
  work: 'What do you do?',
  run: 'How did my last run look?',
  pet: "How's {{pet}}?",
  crew: 'What about {{name}}?',
  advice: 'Any advice?',
  joke: 'Tell me a joke',
  weather: "How's the weather?",
  confide: 'Tell me something real',
  yes: 'Yes',
  no: 'Not really',
  unsure: 'Not sure',
  more: 'Tell me more',
};

/** English defaults, enough for a new app to ship with; apps replace them with their own translated strings. */
export const defaultChatStrings: LokChatStrings = {
  title: 'LOK Chat',
  footer: 'Replies are written by hand, not by a model',
  clear: 'Clear',
  clearConfirm: 'Clear every LOK Chat conversation on this device? This also resets how well everyone knows you.',
  close: 'Close',
  chats: 'Chats',
  channel: '#hideout',
  channelBlurb: 'What everyone says around the place, as they say it.',
  channelEmpty: 'Quiet so far.',
  channelPlaceholder: 'Say something to everyone',
  noCrew: 'Nobody to talk to yet.',
  unreadCount: (count) => `${count} unread`,
  you: 'You',
  tier: { new: 'New', friend: 'Friend', close: 'Close' },
  here: (room) => `In ${room}`,
  empty: (name) => `Say hi to ${name}.`,
  typing: (name) => `${name} is typing`,
  suggested: 'Suggested messages',
  placeholder: (name) => `Message ${name}`,
  send: 'Send',
  back: 'Back to chats',
  open: 'LOK Chat',
  openAria: 'Open LOK Chat',
  openAriaUnread: (count) => `Open LOK Chat, ${count} unread`,
  quickLabel: (key, params) => (QUICK[key.replace(/^lokChat\.quick\./, '')] ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => params?.[name] ?? ''),
};

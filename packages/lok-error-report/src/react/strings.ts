import type { ErrorCategory } from '../types';

/** Every word the pop-up shows, so a game can translate or retheme it. */
export interface LokErrorStrings {
  title: string;
  subtitle: string;
  reportId: (id: string) => string;
  categories: Record<ErrorCategory, { title: string; body: string }>;
  whereTitle: string;
  /** Shown instead of code when the original source cannot be reached (every production build). */
  noAccess: string;
  /** Dev, but the dev tooling could not map the crash back to the file: the raw spot is shown. */
  rawLocation: string;
  codeTitle: string;
  componentTitle: string;
  messageTitle: string;
  build: (version: string, build: string) => string;
  seen: (count: number) => string;
  copy: string;
  copied: string;
  download: string;
  send: string;
  sending: string;
  sent: string;
  sendFailed: string;
  retry: string;
  close: string;
  chip: string;
  chipOpen: string;
  privacy: string;
  noteLabel: string;
  notePlaceholder: string;
  autoSend: string;
  thanksTitle: string;
  thanksBody: string;
}

/** LOK voice: LokServer, the owl who keeps the lights on. Kid-safe, calm, a little hoo. */
export const defaultStrings: LokErrorStrings = {
  title: 'The lights flickered',
  subtitle: 'LokServer caught what went wrong. It was not you.',
  reportId: (id) => `Report ${id}`,
  categories: {
    render: { title: 'A screen came apart', body: 'One part of the game broke while it was drawing itself. The rest is still standing.' },
    script: { title: 'A piece of the game tripped', body: 'Something in the game tried to do a thing it was not ready for.' },
    network: { title: 'The connection dropped', body: 'The game could not reach the LOK network. Your progress on this device is safe.' },
    storage: { title: 'This device is out of room', body: 'The game could not save to your browser. Clear some space or allow storage and try again.' },
    memory: { title: 'The game ran out of memory', body: 'The device ran short on memory. Closing other tabs and trying again usually helps.' },
    resource: { title: 'A file did not arrive', body: 'A picture or file the game wanted did not load. The game kept going.' },
    unknown: { title: 'Something went flicker', body: 'The game hit a problem LokServer could not put a name to.' },
  },
  whereTitle: 'Where it happened',
  noAccess: "LOK doesn't have access to the code behind this one.",
  rawLocation: 'LOK could not trace this back to the original file, so this is the raw spot.',
  codeTitle: 'The code',
  componentTitle: 'Screens involved',
  messageTitle: 'What it said',
  build: (version, build) => `Version ${version} · build ${build}`,
  seen: (count) => (count > 1 ? `Happened ${count} times this session` : 'Happened once'),
  copy: 'Copy report',
  copied: 'Copied',
  download: 'Download',
  send: 'Send to LOK',
  sending: 'Sending',
  sent: 'Sent. Hoo, thank you.',
  sendFailed: 'Could not send. Try again later.',
  retry: 'Try again',
  close: 'Close',
  chip: 'LokServer caught a flicker',
  chipOpen: 'See what happened',
  privacy: 'Nothing leaves your device unless you press Send.',
  noteLabel: 'What happened? (optional)',
  notePlaceholder: 'Tell LokServer what you were doing when it broke.',
  autoSend: 'Send crash reports to LOK automatically from now on',
  thanksTitle: 'Hoo, thank you!',
  thanksBody: 'LokServer passed it on. You just helped fix the lights.',
};

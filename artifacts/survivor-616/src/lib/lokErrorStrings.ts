import type { ErrorCategory } from '@lok/error-report';
import type { LokErrorStrings } from '@lok/error-report/react';

import { t } from '@/lib/i18n';

const CATEGORIES: ErrorCategory[] = ['render', 'script', 'network', 'storage', 'memory', 'resource', 'unknown'];

/** The pop-up's words from `en.json` (`lokError.*`), so it translates like the rest of the game. */
export function lokErrorStrings(): LokErrorStrings {
  const k = (key: string, vars?: Record<string, unknown>) => t(`lokError.${key}` as never, vars);
  return {
    title: k('title'),
    subtitle: k('subtitle'),
    reportId: (id) => k('reportId', { id }),
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, { title: k(`cat.${c}.title`), body: k(`cat.${c}.body`) }])) as LokErrorStrings['categories'],
    whereTitle: k('where'),
    noAccess: k('noAccess'),
    rawLocation: k('rawLocation'),
    codeTitle: k('code'),
    componentTitle: k('components'),
    messageTitle: k('message'),
    build: (version, build) => k('build', { version, build }),
    seen: (count) => (count > 1 ? k('seenMany', { count }) : k('seenOnce')),
    copy: k('copy'),
    copied: k('copied'),
    download: k('download'),
    send: k('send'),
    sending: k('sending'),
    sent: k('sent'),
    sendFailed: k('sendFailed'),
    retry: k('retry'),
    close: k('close'),
    chip: k('chip'),
    chipOpen: k('chipOpen'),
    privacy: k('privacy'),
  };
}

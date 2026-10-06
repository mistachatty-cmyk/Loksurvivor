/**
 * Spike-only English copy for the page overlay.
 *
 * TODO(phase 1): the overlay ships as its own bundle, so these cannot use the
 * game's React `useT()`. Move them into `src/locales/en.json` and load the
 * matching language slice at start, per CLAUDE.md "Localization". Do not
 * hand-edit the other language files.
 */
export const STRINGS = {
  title: 'Demo Day',
  hp: 'HP',
  destroyed: 'PAGE DESTROYED',
  hint: 'WASD / arrows to move · Space for your ultimate · Esc to exit and restore the page',
  exit: 'Exit & restore',
  creditPrefix: 'Page-smashing inspired by',
  creditName: 'Destroy Any Website · Sprite Fusion',
  refusedPrefix: 'Demo Day skipped this page: it looks like',
  nothingToBreak: 'Demo Day found nothing on this page to break.',
  endTitle: 'Demo over',
  endRestored: 'The page has been put back.',
  endDestroyed: 'Page destroyed',
  endKills: 'Kills',
  endLevel: 'Level',
  endTime: 'Time',
  endShare: 'Save & share',
  endClose: 'Close',
} as const;

/** Original game, credited the same way the GSix hub already credits it. */
export const CREDIT_URL = 'https://destroy.spritefusion.com/';

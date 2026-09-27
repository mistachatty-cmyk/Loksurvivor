/**
 * Rotating "brought to you by" credit line -- a cosmetic-only concept, not
 * scoped to patch notes specifically. The joke: whichever name shows up
 * reads as if a different show/IP "sponsored" this particular update or
 * screen, the way a stream might rotate sponsor bumpers. Sometimes it's
 * this game's own name in a different style, sometimes the studio,
 * sometimes a sibling IP from the same collection of projects.
 *
 * Currently used by `UpdatePopup.tsx` (the "A Message From ___" header) and
 * `ArchivePanel.tsx`'s Updates chapter subtitle, each picking one at random
 * once per mount (see their `useMemo(() => pickCreditName(), [])` calls) --
 * so it stays stable while you're looking at a screen and only changes the
 * next time you open it, not every render.
 *
 * This is intentionally a general-purpose, reusable list: anything else in
 * the game that wants a rotating "presented by" byline (a loading screen, a
 * run-summary footer, an easter egg) should import CREDIT_NAMES/
 * pickCreditName() from here rather than inventing a second rotation list.
 * Add a new name any time -- just append a string.
 */
export const CREDIT_NAMES: string[] = [
  '616 Survivor',
  'Survivor 616',
  'Lok Survivor',
  'Kinetic Souls',
  'Kinetic Soul',
  'Spend Ut All',
  'LokLingu',
  'Lok Motion',
  'Lok EcoSystem',
  'LokBook',
  'RuneDiary',
  'Openkingdom',
  'G6.online',
];

export function pickCreditName(): string {
  return CREDIT_NAMES[Math.floor(Math.random() * CREDIT_NAMES.length)]!;
}

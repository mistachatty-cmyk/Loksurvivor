/**
 * The soundtrack's unlock progress, published to the account so the GSix
 * site's Lok Music player can open the same songs. The matching `gate` on each
 * track in `public/lok-soundtrack.json` is `{ app: 'survivor616', objectives }`.
 */
export const MUSIC_APP_KEY = 'survivor616';

/** Objectives completed so far, as the number the account stores. */
export function musicObjectives(meta: { soundtrackObjectiveCompletions?: number }): number {
  const n = meta.soundtrackObjectiveCompletions;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

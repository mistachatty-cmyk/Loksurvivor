/**
 * The hub's ad slot. Zero data cost by design (docs/LOK_COST_DISCIPLINE.md): every slide is
 * local data drawn with procedural SVG/CSS -- no images, no fetches. The slot is data-driven:
 * add a row to `PINNED_PROMOS` to post something new, and the newest changelog entries are
 * posted automatically, each linking straight to its entry in the Updates list.
 */
import type { ChangelogEntry } from '@/game/data/changelog';
import { CHANGELOG_KIND_META } from '@/game/data/changelogKinds';

/** Where a click goes. `update` opens the Updates list scrolled to that version. */
export type PromoTarget =
  | { screen: 'lok-shop' }
  | { screen: 'card-shop'; tab?: 'sleeve' | 'binder' | 'singles' }
  | { screen: 'palette-store' }
  | { screen: 'account' }
  | { screen: 'update'; version: string };

export type PromoArt = 'owl' | 'sleeve' | 'update' | 'supporters';

export interface PromoSlide {
  id: string;
  art: PromoArt;
  title: string;
  blurb: string;
  accent: string;
  target: PromoTarget;
  /** Small label under the title (e.g. an update's kind). */
  tag?: string;
}

/** Posted by hand. Order = order in the cycle. Keep each blurb short; the slot is one line tall on phones. */
export const PINNED_PROMOS: PromoSlide[] = [
  { id: 'lokshop', art: 'owl', title: 'LokShop', blurb: 'LokServer has new shelves, a feather game and a back room.', accent: '#c084fc', target: { screen: 'lok-shop' }, tag: 'Shop' },
  { id: 'sleeve', art: 'sleeve', title: 'Sleeve Counter', blurb: 'New pack wraps and card backs, including the animated Live wraps.', accent: '#f0abfc', target: { screen: 'card-shop', tab: 'sleeve' }, tag: 'Cards' },
  { id: 'supporters', art: 'supporters', title: 'Lok Supporters', blurb: 'See who keeps the Lok games going, and join them.', accent: '#5eead4', target: { screen: 'lok-shop' }, tag: 'Thank you' },
];

const RECENT_UPDATES = 3;
const BLURB_MAX = 110;

function clip(text: string): string {
  return text.length <= BLURB_MAX ? text : `${text.slice(0, BLURB_MAX - 1).trimEnd()}…`;
}

export function updateSlide(entry: ChangelogEntry): PromoSlide {
  const kind = CHANGELOG_KIND_META[entry.kind];
  return {
    id: `update-${entry.version}`,
    art: 'update',
    title: entry.title,
    blurb: clip(entry.body[0] ?? ''),
    accent: kind.color,
    target: { screen: 'update', version: entry.version },
    tag: `v${entry.version} · ${kind.label}`,
  };
}

/** Pinned posts first, then the newest updates (newest first), de-duplicated by id. */
export function buildPromoSlides(changelog: readonly ChangelogEntry[], pinned: readonly PromoSlide[] = PINNED_PROMOS): PromoSlide[] {
  const recent = changelog.slice(-RECENT_UPDATES).reverse().map(updateSlide);
  const seen = new Set<string>();
  return [...pinned, ...recent].filter((slide) => (seen.has(slide.id) ? false : (seen.add(slide.id), true)));
}

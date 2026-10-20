/**
 * The game's patch notes as a portable, public document. The GSix website
 * reads it live from `https://survivor.gsix.online/lok-updates.json` (the
 * committed copy in `public/`), so the website's Updates page never needs a
 * hand-copied file. `publicUpdates.test.ts` fails when the copy is stale, so
 * every version bump regenerates it:
 *
 *   pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json
 */
import { CHANGELOG, STUDIO_NAME, updateNumber } from './changelog';
import { CHANGELOG_KIND_META, type ChangelogKind } from './changelogKinds';

export const PUBLIC_UPDATES_SCHEMA = 'lok.public-updates';

export interface PublicUpdateEntry {
  number: number;
  version: string;
  date: string;
  /** UTC instant the update landed (ISO 8601); absent for the earliest notes. */
  publishedAt?: string;
  kind: ChangelogKind;
  categoryLabel: string;
  categoryColor: string;
  categoryLore: string;
  title: string;
  body: string[];
}

export interface PublicUpdates {
  schema: typeof PUBLIC_UPDATES_SCHEMA;
  schemaVersion: 1;
  appKey: 'survivor616';
  label: string;
  studio: string;
  source: string;
  /** Newest first. */
  updates: PublicUpdateEntry[];
}

export function buildPublicUpdates(): PublicUpdates {
  return {
    schema: PUBLIC_UPDATES_SCHEMA,
    schemaVersion: 1,
    appKey: 'survivor616',
    label: '616 Survivor',
    studio: STUDIO_NAME,
    source: 'artifacts/survivor-616/src/game/data/changelog.ts',
    updates: [...CHANGELOG].reverse().map((entry) => ({
      number: updateNumber(entry),
      version: entry.version,
      date: entry.date,
      ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
      kind: entry.kind,
      categoryLabel: CHANGELOG_KIND_META[entry.kind].label,
      categoryColor: CHANGELOG_KIND_META[entry.kind].color,
      categoryLore: CHANGELOG_KIND_META[entry.kind].lore,
      title: entry.title,
      body: [...entry.body],
    })),
  };
}

export function serializePublicUpdates(): string {
  return `${JSON.stringify(buildPublicUpdates(), null, 2)}\n`;
}

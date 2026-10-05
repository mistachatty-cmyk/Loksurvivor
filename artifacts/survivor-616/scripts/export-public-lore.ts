/**
 * Exports this game's lore as the portable `lok.public-lore` document that
 * the GSix hub renders on the game's page (gsix.online/games/survivor616).
 * Same source as the in-game Archive > Chronicles (`LORE_CHRONICLES`), and the
 * theme tokens are read from the game's own `index.css`, so the hub page keeps
 * the game's look without anyone copying values by hand.
 *
 *   pnpm exec tsx scripts/export-public-lore.ts <outDir>          write survivor616.lore.json
 *   pnpm exec tsx scripts/export-public-lore.ts --check <file>   exit 1 if <file> is stale
 *
 * Convention for every LOK game: Lok-EcoSystsem/LokToken EcoSystem/LOK_PLATFORMS.md
 * ("Public lore on gsix.online"). Re-run and copy the file into Gsixhub whenever lore.ts changes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LORE_CHRONICLES } from '../src/game/data/lore';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const rootBlock = /:root,\s*\.dark\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock)?.[1]?.trim();

/** "32 95% 55%" -> "#f9a11f". */
function hslToHex(value: string | undefined): string {
  const match = value && /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(value);
  if (!match) throw new Error(`index.css token missing or not "h s% l%": ${value}`);
  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const doc = {
  schema: 'lok.public-lore',
  schemaVersion: 1,
  appKey: 'survivor616',
  label: '616 Survivor',
  kicker: `Cycle 616.9 · Declassified Dossier #${LORE_CHRONICLES.length} · Non-Organic Synthetic Reality`,
  title: 'The Digi-Verse Archives',
  source: 'artifacts/survivor-616/src/game/data/lore.ts',
  theme: {
    background: hslToHex(token('background')),
    card: hslToHex(token('card')),
    border: hslToHex(token('card-border')),
    foreground: hslToHex(token('foreground')),
    muted: hslToHex(token('muted-foreground')),
    primary: hslToHex(token('primary')),
  },
  chapters: LORE_CHRONICLES.map((entry) => ({
    id: entry.id,
    number: entry.chapterNumber,
    title: entry.title,
    subtitle: entry.subtitle,
    codename: entry.codename,
    level: entry.classifiedLevel,
    timestamp: entry.timestamp,
    summary: entry.summary,
    content: entry.content,
    keyIntel: entry.keyIntel,
  })),
};
const json = `${JSON.stringify(doc, null, 2)}\n`;

if (process.argv[2] === '--check') {
  const current = readFileSync(process.argv[3] ?? '', 'utf8');
  if (current !== json) {
    console.error('Public lore is stale: re-run export-public-lore.ts and copy the output into the hub.');
    process.exit(1);
  }
  console.log('Public lore is up to date.');
} else {
  const outDir = process.argv[2] ?? '.';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'survivor616.lore.json'), json);
  console.log(`${doc.chapters.length} chapters -> ${outDir}`);
}

/**
 * Roll the crash documents LokErrorReport wrote in dev into one index.
 *   tsx scripts/errors-docs.ts --dir ../../docs/errors --out ../../docs/ERRORS.md
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseReportDoc, renderErrorsIndex } from '../src/format';

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1]! : fallback;
}

const dir = path.resolve(arg('dir', 'docs/errors'));
const out = path.resolve(arg('out', 'docs/ERRORS.md'));

const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.md') && n.toLowerCase() !== 'readme.md');
const docs = await Promise.all(names.map(async (name) => parseReportDoc(await readFile(path.join(dir, name), 'utf8'))));
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, renderErrorsIndex(docs));
console.log(`${docs.length} crash document${docs.length === 1 ? '' : 's'} -> ${path.relative(process.cwd(), out)}`);

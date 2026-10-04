/**
 * `auto-l10n scan`: a rough report of user-facing English that is still
 * hard-coded in source files, to help migrate a game to `t('key')` calls.
 *
 * It is a heuristic, not a parser. It reports JSX text and common text
 * attributes, so expect a few false positives and some misses (strings built
 * in data files are not found). Use the totals as a progress meter, not a spec.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const EXTENSIONS = new Set(['.tsx', '.jsx', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

// Text between a closing ">" and the next "<", with no braces (so no code or expressions).
const JSX_TEXT = />\s*([^<>{}=;]*?[A-Za-z]{2}[^<>{}=;]*?)\s*</g;
const TEXT_ATTRIBUTE = /\b(?:title|label|placeholder|aria-label|alt|description)=(?:"([^"{}]*[A-Za-z]{2}[^"{}]*)"|'([^'{}]*[A-Za-z]{2}[^'{}]*)')/g;

/**
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {Promise<string[]>}
 */
async function walk(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name)) && !/\.(test|spec)\./.test(entry.name)) out.push(full);
  }
  return out;
}

/** @param {string} text */
function looksLikeProse(text) {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length < 3) return false;
  if (!/[A-Za-z]{2}/.test(value)) return false;
  // Skip CSS-ish class lists, paths, code-like tokens and TS generics.
  if (/^[\w./:#@-]+$/.test(value) && !/\s/.test(value) && !/^[A-Z][a-z]+$/.test(value)) return false;
  if (/^(?:=>|[()[\],.;:|&?!])/.test(value)) return false;
  if (/[=(){}[\]]/.test(value)) return false;
  return true;
}

/**
 * @param {string} root Directory to scan.
 * @returns {Promise<{ files: Array<{ file: string, strings: string[] }>, total: number }>}
 */
export async function scanSource(root) {
  const results = [];
  let total = 0;
  for (const file of await walk(root)) {
    const code = await fs.readFile(file, 'utf8');
    const found = new Set();
    for (const match of code.matchAll(JSX_TEXT)) {
      const text = /** @type {string} */ (match[1]);
      if (looksLikeProse(text)) found.add(text.replace(/\s+/g, ' ').trim());
    }
    for (const match of code.matchAll(TEXT_ATTRIBUTE)) {
      const text = /** @type {string} */ (match[1] ?? match[2]);
      if (looksLikeProse(text)) found.add(text.replace(/\s+/g, ' ').trim());
    }
    if (found.size > 0) {
      total += found.size;
      results.push({ file: path.relative(root, file), strings: [...found] });
    }
  }
  results.sort((a, b) => b.strings.length - a.strings.length);
  return { files: results, total };
}

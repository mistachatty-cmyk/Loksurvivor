// Loads Bible text for Lokabiblio, one book at a time, from static files (public/bible/<translation>/<book>.json).
// Built by scripts/build-bible.mjs. No service worker and no code cache: a book is fetched when first read, then kept in memory.
import type { TranslationId } from './lokabiblio';
/** One book: `c` is the chapters (each an array of verse strings); `t` holds Psalm headings by chapter number. */
export interface BookData { c: string[][]; t: Record<string, string> }
const cache = new Map<string, Promise<BookData>>();
const base = (): string => (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) || '/';

/** A whole book (1 to 66). Rejects when the file cannot be loaded; failures are not cached. */
export function loadBook(book: number, tr: TranslationId = 'kjv'): Promise<BookData> {
  const key = `${tr}/${book}`; const hit = cache.get(key); if (hit) return hit;
  const p = fetch(`${base()}bible/${tr}/${book}.json`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<BookData>; });
  cache.set(key, p); p.catch(() => cache.delete(key)); return p;
}

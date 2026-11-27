// Search the whole Bible (docs/183). Loads the 66 book files on first use (about 4 MB, kept in memory), then searches locally. Nothing is sent anywhere.
import { BOOKS } from './lokabiblio';
import { loadBook, type BookData } from './bibleData';
import type { TranslationId } from './lokabiblio';
import { sfx } from './sfx';

export interface Hit { book: number; chapter: number; verse: number; text: string }
export const MIN_QUERY = 3, MAX_HITS = 60;
/** Every word must appear (any order, any case). Pure, so it is tested. `books` is indexed from book 1 at position 0. */
export function searchBooks(books: ReadonlyArray<BookData | undefined>, query: string, cap = MAX_HITS): { hits: Hit[]; more: boolean } {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0); if (query.trim().length < MIN_QUERY || !words.length) return { hits: [], more: false };
  const hits: Hit[] = []; let more = false;
  outer: for (let b = 0; b < books.length; b++) { const d = books[b]; if (!d) continue;
    for (let c = 0; c < d.c.length; c++) for (let v = 0; v < d.c[c].length; v++) {
      const t = d.c[c][v], low = t.toLowerCase(); if (!words.every((w) => low.includes(w))) continue;
      if (hits.length >= cap) { more = true; break outer; } hits.push({ book: b + 1, chapter: c + 1, verse: v + 1, text: t });
    } }
  return { hits, more };
}
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const mark = (text: string, words: string[]): string => { let h = esc(text); for (const w of words) h = h.replace(new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); return h; };

const cache: Partial<Record<TranslationId, Array<BookData | undefined>>> = {};
export function openSearch(opts: { tr?: TranslationId; reduced: boolean; onPick(book: number, chapter: number, verse: number): void }): void {
  const tr: TranslationId = opts.tr ?? 'kjv', prev = document.activeElement as HTMLElement | null;
  const back = document.createElement('div'); back.className = 'fv-back fs-back'; back.dataset.reduced = String(opts.reduced);
  back.innerHTML = `<div class="fv-card fs-card" role="dialog" aria-modal="true" aria-labelledby="fs-h">
    <div class="fv-head"><h2 id="fs-h">Search the Bible</h2><button class="b fv-x" type="button" data-a="close" aria-label="Close search">Close</button></div>
    <input class="fs-in" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="A word or two, like shepherd or peace" aria-label="Search words">
    <p class="fv-meta fs-note" aria-live="polite">Type at least 3 letters.</p><ul class="fs-list"></ul></div>`;
  const $ = <T extends HTMLElement>(q: string): T => back.querySelector(q) as T;
  const inp = $<HTMLInputElement>('.fs-in'), note = $('.fs-note'), list = $('.fs-list');
  const close = (): void => { document.removeEventListener('keydown', key, true); back.remove(); prev?.focus?.(); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === 'Tab') { const f = [...back.querySelectorAll<HTMLElement>('button,input')]; const i = f.indexOf(document.activeElement as HTMLElement); e.preventDefault(); e.stopPropagation(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  const ready = async (): Promise<boolean> => {
    if (cache[tr]) return true;
    const out: Array<BookData | undefined> = new Array(66).fill(undefined); let n = 0, fail = false;
    await Promise.all(BOOKS.map((_, i) => loadBook(i + 1, tr).then((d) => { out[i] = d; }).catch(() => { fail = true; }).finally(() => { n++; if (n % 6 === 0 || n === 66) note.textContent = `Getting the books ready, ${n} of 66.`; })));
    if (fail) { note.textContent = 'Could not load every book. Check your connection and try again.'; return false; }
    cache[tr] = out; return true;
  };
  let seq = 0;
  const run = async (): Promise<void> => {
    const q = inp.value, my = ++seq; if (q.trim().length < MIN_QUERY) { list.innerHTML = ''; note.textContent = 'Type at least 3 letters.'; return; }
    if (!(await ready()) || my !== seq) return;
    const { hits, more } = searchBooks(cache[tr]!, q); const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    note.textContent = hits.length ? `${more ? `First ${hits.length}` : hits.length} verse${hits.length === 1 ? '' : 's'}${more ? '. Add a word to narrow it.' : '.'}` : 'No verses found. Try a different word.';
    list.innerHTML = hits.map((h) => `<li><button class="fs-hit" type="button" data-k="${h.book}:${h.chapter}:${h.verse}"><b>${esc(BOOKS[h.book - 1])} ${h.chapter}:${h.verse}</b><span>${mark(h.text, words)}</span></button></li>`).join('');
  };
  let t = 0; inp.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => void run(), 250); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(t); void run(); } });
  back.addEventListener('click', (e) => {
    const el = e.target as HTMLElement; if (el === back || el.closest('[data-a="close"]')) { sfx.play('ui'); return close(); }
    const hit = el.closest('.fs-hit') as HTMLElement | null; if (hit) { sfx.play('ui'); const [b, c, v] = hit.dataset.k!.split(':').map(Number); close(); opts.onPick(b, c, v); }
  });
  document.addEventListener('keydown', key, true); document.body.appendChild(back); inp.focus(); sfx.play('open', { vol: 0.4 });
}

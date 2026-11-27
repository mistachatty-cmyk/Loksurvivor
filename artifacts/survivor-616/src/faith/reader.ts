// Lokabiblio reader (docs/183): the full Bible, opened from the verse card. Optional, free, King James Version for now.
// Book and chapter pickers, verse text with the chosen verse marked, Previous and Next in the lower third.
import { TRANSLATIONS, type TranslationId, BOOKS, locate } from './lokabiblio';
import { loadBook } from './bibleData';
import { recordOpen, recordChapter, loadFaith, toggleMark } from './faithStore';
import { sfx } from './sfx';

export function openReader(at: string | { book: number; chapter: number; verse?: number }, opts: { reduced: boolean; onClose?: () => void }): void {
  const prev = document.activeElement as HTMLElement | null;
  const p = typeof at === 'string' ? locate(at) : { verse: 1, ...at };
  let tr: TranslationId = (() => { try { return localStorage.getItem('lok.faith.tr') === 'web' ? 'web' : 'kjv'; } catch { return 'kjv'; } })(), book = p?.book ?? 43, chapter = p?.chapter ?? 1, mark = p?.verse ?? 0, chapters: string[][] = [], heads: Record<string, string> = {}, pick = 0, shelf = false;
  const back = document.createElement('div'); back.className = 'fv-back fr-back'; back.dataset.reduced = String(opts.reduced);
  back.innerHTML = `<div class="fv-card fr-panel" role="dialog" aria-modal="true" aria-labelledby="fr-title">
    <div class="fv-head"><h2 id="fr-title">Bible</h2><button class="b fv-x" type="button" data-a="close" aria-label="Close the Bible">Close</button></div>
    <div class="fr-pick">
      <label class="fr-l"><span>Book</span><select data-k="book" aria-label="Book">${BOOKS.map((b, i) => `<option value="${i + 1}">${b}</option>`).join('')}</select></label>
      <label class="fr-l fr-lt"><span>Version</span><select data-k="tr" aria-label="Bible version">${TRANSLATIONS.map((x) => `<option value="${x.id}">${x.short}</option>`).join('')}</select></label>
      <label class="fr-l fr-lc"><span>Chapter</span><select data-k="chapter" aria-label="Chapter"></select></label>
    </div>
    <div class="fr-tools"><button class="b mid" type="button" data-a="mark" disabled>Bookmark a verse</button><button class="b mid" type="button" data-a="shelf">Bookmarks</button><button class="b mid" type="button" data-a="note" disabled>Note</button><button class="b mid" type="button" data-a="search">Search</button></div>
    <div class="fr-text" tabindex="0" aria-live="polite"></div>
    <div class="fr-nav"><button class="b mid" type="button" data-a="prev">Previous</button><button class="b mid go" type="button" data-a="next">Next</button></div>
  </div>`;
  const $ = <T extends HTMLElement>(q: string): T => back.querySelector(q) as T;
  const selT = $<HTMLSelectElement>('[data-k="tr"]'), selB = $<HTMLSelectElement>('[data-k="book"]'), selC = $<HTMLSelectElement>('[data-k="chapter"]'), text = $<HTMLElement>('.fr-text');

  const say = (msg: string, retry = false): void => { text.replaceChildren(); const m = document.createElement('p'); m.className = 'fr-state'; m.textContent = msg; text.append(m); if (retry) { const b = document.createElement('button'); b.className = 'b mid'; b.type = 'button'; b.textContent = 'Try again'; b.dataset.a = 'retry'; text.append(b); } };
  const show = async (): Promise<void> => {
    selB.value = String(book); selT.value = tr; say('Opening the Book…');
    const tok = ++seq;
    try { const d = await loadBook(book, tr); chapters = d.c; heads = d.t; } catch { if (tok === seq) say('The Bible could not be loaded. Check your connection and try again.', true); return; }
    if (tok !== seq) return;
    chapter = Math.min(Math.max(1, chapter), chapters.length);
    selC.replaceChildren(...chapters.map((_, i) => { const o = document.createElement('option'); o.value = String(i + 1); o.textContent = String(i + 1); return o; })); selC.value = String(chapter);
    $<HTMLElement>('#fr-title').textContent = `${BOOKS[book - 1]} ${chapter} · ${TRANSLATIONS.find((x) => x.id === tr)!.short}`;
    shelf = false; pick = mark;
    const nodes: HTMLElement[] = []; const head = heads[String(chapter)];
    if (head) { const hp = document.createElement('p'); hp.className = 'fr-head'; hp.textContent = head; nodes.push(hp); }
    chapters[chapter - 1].forEach((v, i) => { if (!v) return; const para = document.createElement('p'); para.className = 'fr-v'; para.dataset.n = String(i + 1); if (i + 1 === mark) para.classList.add('mark'); if (loadFaith().notes?.[`${book}:${chapter}:${i + 1}`]) para.classList.add('has-note'); const n = document.createElement('sup'); n.textContent = String(i + 1); para.append(n, ' ', v); nodes.push(para); });
    text.replaceChildren(...nodes); syncTools();
    text.scrollTop = 0; const hit = text.querySelector('.mark') as HTMLElement | null; if (hit) text.scrollTop = Math.max(0, hit.offsetTop - text.offsetTop - text.clientHeight / 2 + hit.offsetHeight / 2);
    $<HTMLButtonElement>('[data-a="prev"]').disabled = book === 1 && chapter === 1; $<HTMLButtonElement>('[data-a="next"]').disabled = book === 66 && chapter === chapters.length;
    recordOpen(); recordChapter(book, chapter);
  };
  let seq = 0;
  const key3 = (n: number): string => `${book}:${chapter}:${n}`;
  const syncTools = (): void => {
    const m = $<HTMLButtonElement>('[data-a="mark"]'), n = loadFaith().marks.length;
    m.disabled = shelf || !pick; m.textContent = !pick ? 'Tap a verse to bookmark' : loadFaith().marks.includes(key3(pick)) ? `Remove bookmark, verse ${pick}` : `Bookmark verse ${pick}`;
    const nb = $<HTMLButtonElement>('[data-a="note"]'); nb.disabled = shelf || !pick; nb.textContent = !pick ? 'Tap a verse to add a note' : loadFaith().notes?.[key3(pick)] ? `Edit note, verse ${pick}` : `Note on verse ${pick}`;
    $<HTMLElement>('[data-a="shelf"]').textContent = shelf ? 'Back to reading' : `Bookmarks (${n})`;
  };
  const showShelf = (): void => {
    shelf = true; text.replaceChildren(); const fs0 = loadFaith(), notes0 = fs0.notes ?? {}, marks = [...fs0.marks, ...Object.keys(notes0).filter((k) => !fs0.marks.includes(k))];
    if (!marks.length) say('Nothing saved yet. Tap a verse, then choose Bookmark or Note.');
    for (const k of [...marks].reverse()) { const [b, c, v] = k.split(':').map(Number); const row = document.createElement('button'); row.type = 'button'; row.className = 'b fr-mk'; row.dataset.a = 'go'; row.dataset.k = k; row.textContent = `${BOOKS[b - 1]} ${c}:${v}`; const nt = notes0[k]?.t; if (nt) { const sm = document.createElement('small'); sm.className = 'fr-mn'; sm.textContent = nt.length > 90 ? `${nt.slice(0, 90)}...` : nt; row.append(sm); } text.append(row); }
    syncTools();
  };
  const step = (d: number): void => {
    mark = 0;
    if (d > 0) { if (chapter < chapters.length) chapter++; else if (book < 66) { book++; chapter = 1; } }
    else if (chapter > 1) chapter--; else if (book > 1) { book--; chapter = 9999; }   // clamped to the last chapter once the book loads
    void show();
  };
  const close = (): void => { document.removeEventListener('keydown', key); back.remove(); prev?.focus?.(); opts.onClose?.(); };
  const key = (e: KeyboardEvent): void => { if (document.querySelector('.fs-back, .fn-back')) return; if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { const f = [...back.querySelectorAll<HTMLElement>('button:not(:disabled),select,[tabindex="0"]')]; if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  back.addEventListener('click', (e) => {
    const para = (e.target as HTMLElement).closest('.fr-v') as HTMLElement | null;
    if (para && !shelf) { text.querySelectorAll('.fr-v.mark').forEach((x) => x.classList.remove('mark')); para.classList.add('mark'); pick = Number(para.dataset.n); syncTools(); return; }
    const a = ((e.target as HTMLElement).closest('button') as HTMLElement | null)?.dataset.a; if (!a) return;
    sfx.play('ui');
    if (a === 'close') close(); else if (a === 'prev') step(-1); else if (a === 'next') step(1); else if (a === 'retry') void show();
    else if (a === 'search') void import('./search').then((m) => m.openSearch({ tr, reduced: opts.reduced, onPick: (b, c, v) => { book = b; chapter = c; mark = v; shelf = false; void show(); } }));
    else if (a === 'shelf') { if (shelf) void show(); else showShelf(); }
    else if (a === 'note') { if (pick) { const k = key3(pick), n = pick; void import('./notes').then((m) => m.openNote({ key: k, ref: `${BOOKS[book - 1]} ${chapter}:${n}`, reduced: opts.reduced, onSaved: (has) => { text.querySelector(`.fr-v[data-n="${n}"]`)?.classList.toggle('has-note', has); syncTools(); } })); } }
    else if (a === 'mark') { if (pick) { toggleMark(key3(pick)); syncTools(); } }
    else if (a === 'go') { const [b, c, v] = ((e.target as HTMLElement).closest('button') as HTMLElement).dataset.k!.split(':').map(Number); book = b; chapter = c; mark = v; void show(); }
  });
  selT.addEventListener('change', () => { tr = selT.value === 'web' ? 'web' : 'kjv'; try { localStorage.setItem('lok.faith.tr', tr); } catch { /* the choice just is not remembered */ } void show(); });
  selB.addEventListener('change', () => { book = Number(selB.value); chapter = 1; mark = 0; void show(); });
  selC.addEventListener('change', () => { chapter = Number(selC.value); mark = 0; void show(); });
  document.addEventListener('keydown', key); document.body.appendChild(back); sfx.play('open', { vol: 0.4 });
  void show().then(() => (back.querySelector('[data-a="next"]') as HTMLElement)?.focus());
}

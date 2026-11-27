// Verse bar and Lokabiblio card (docs/183). Optional: only mounted when the Religion setting is on.
// Bar (one quiet line of scripture) -> tap -> card (verse, streak, another verse) -> Read this chapter -> the full reader.
import { dailyVerse, otherVerse, verseStreak, dayKey, type Verse } from './lokabiblio';
import { loadFaith, recordOpen } from './faithStore';
import { sfx } from './sfx';
import { faithLevel, growthBar } from './progress';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Add the verse bar to a screen. Returns a cleanup function. */
export function mountVerseBar(host: HTMLElement, opts: { reduced: boolean }): () => void {
  const root = (host.querySelector('.title') as HTMLElement | null) ?? host;
  if (root.querySelector('.fv-bar')) return () => {};
  const v = dailyVerse(new Date());
  const bar = document.createElement('button');
  bar.type = 'button'; bar.className = 'fv-bar'; bar.dataset.reduced = String(opts.reduced);
  bar.setAttribute('aria-label', `Verse of the day, ${v.ref}. Tap to open.`);
  bar.innerHTML = `<span class="fv-text">${esc(v.text)}</span><span class="fv-ref">${esc(v.ref)} · KJV</span>`;
  bar.addEventListener('click', (e) => { e.stopPropagation(); sfx.play('ui'); openCard(v, opts.reduced); });   // never lets the title treat this as a tap anywhere
  root.appendChild(bar);
  return () => bar.remove();
}

/** Share a verse with someone: the phone share sheet when there is one, otherwise copy to the clipboard. */
export async function shareVerse(v: Verse, host: HTMLElement): Promise<void> {
  const text = `${v.text} (${v.ref}, KJV)`; let note = 'Copied. Pass it on.';
  try { if (navigator.share) { await navigator.share({ text }); return; } await navigator.clipboard.writeText(text); } catch { note = 'Could not share here. Select the verse and copy it.'; }
  const el = host.querySelector('.fv-streak') as HTMLElement | null; if (el) el.textContent = note;
}
export interface CardExtra { label: string; run(): void }
export function openCard(first: Verse, reduced: boolean, extras: CardExtra[] = [], onClose?: () => void): void {
  const prev = document.activeElement as HTMLElement | null;
  const back = document.createElement('div'); back.className = 'fv-back'; back.dataset.reduced = String(reduced);
  let cur = first;
  const streakText = (): string => { const n = verseStreak(loadFaith().days, dayKey(new Date())); return n > 0 ? `Verse streak: ${n} day${n === 1 ? '' : 's'}` : 'Open a verse each day to start a streak. Missing a day is fine.'; };
  back.innerHTML = `<div class="fv-card" role="dialog" aria-modal="true" aria-labelledby="fv-ref">
    <div class="fv-head"><h2 id="fv-ref"></h2><button class="b fv-x" type="button" aria-label="Close" data-a="close">Close</button></div>
    <p class="fv-verse" aria-live="polite"></p>
    <p class="fv-meta">King James Version. Free and optional.</p>
    <p class="fv-streak" aria-live="polite"></p>
    <div class="fv-grow-host"></div>
    <div class="fv-actions"><button class="b mid go" type="button" data-a="open">Read this chapter</button><button class="b mid" type="button" data-a="more">Another verse</button><button class="b mid" type="button" data-a="share">Share</button>${extras.map((x, i) => `<button class="b mid" type="button" data-x="${i}">${esc(x.label)}</button>`).join('')}</div>
  </div>`;
  const paint = (): void => { (back.querySelector('#fv-ref') as HTMLElement).textContent = cur.ref; (back.querySelector('.fv-verse') as HTMLElement).textContent = cur.text; (back.querySelector('.fv-streak') as HTMLElement).textContent = streakText(); (back.querySelector('.fv-grow-host') as HTMLElement).innerHTML = growthBar(faithLevel(loadFaith())); };
  recordOpen(); paint();
  const close = (): void => { document.removeEventListener('keydown', key); back.remove(); prev?.focus?.(); onClose?.(); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { const f = [...back.querySelectorAll<HTMLElement>('button')]; if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement; if (t === back) return close();
    const xb = t.closest('button[data-x]') as HTMLElement | null; if (xb) { sfx.play('ui'); const x = extras[Number(xb.dataset.x)]; close(); x?.run(); return; }
    const a = (t.closest('button') as HTMLElement | null)?.dataset.a;
    if (a === 'close') { sfx.play('ui'); close(); } else if (a === 'open') { sfx.play('ui'); const at = cur.ref; close(); void import('./reader').then((m) => m.openReader(at, { reduced })); } else if (a === 'share') { sfx.play('ui'); void shareVerse(cur, back); } else if (a === 'more') { sfx.play('ui'); cur = otherVerse(cur.ref, Math.random()); recordOpen(); paint(); }
  });
  document.addEventListener('keydown', key); document.body.appendChild(back);
  (back.querySelector('[data-a="open"]') as HTMLElement).focus(); sfx.play('open', { vol: 0.4 });
}

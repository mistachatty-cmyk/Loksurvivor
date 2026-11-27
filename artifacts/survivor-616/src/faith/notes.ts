// A private note on one verse (docs/183). Kept on the device and the person's own account slice; never shown on a profile.
import { loadFaith, setNote, NOTE_MAX } from './faithStore';
import { sfx } from './sfx';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export function openNote(o: { key: string; ref: string; reduced: boolean; onSaved(has: boolean): void }): void {
  const prev = document.activeElement as HTMLElement | null, had = loadFaith().notes?.[o.key]?.t ?? '';
  const back = document.createElement('div'); back.className = 'fv-back fn-back'; back.dataset.reduced = String(o.reduced);
  back.innerHTML = `<div class="fv-card fn-card" role="dialog" aria-modal="true" aria-labelledby="fn-h">
    <div class="fv-head"><h2 id="fn-h">Note on ${esc(o.ref)}</h2><button class="b fv-x" type="button" data-a="close" aria-label="Close note">Close</button></div>
    <textarea class="fn-in" maxlength="${NOTE_MAX}" rows="5" placeholder="What stood out? A prayer, a question, a name." aria-label="My note"></textarea>
    <p class="fv-meta fn-count" aria-live="polite"></p>
    <div class="fv-actions"><button class="b mid" type="button" data-a="save">Save note</button>${had ? '<button class="b mid" type="button" data-a="del">Remove note</button>' : ''}</div>
    <p class="fv-meta">Only you can see your notes. They are never shown on a profile.</p></div>`;
  const ta = back.querySelector('.fn-in') as HTMLTextAreaElement, cnt = back.querySelector('.fn-count') as HTMLElement; ta.value = had;
  const upd = (): void => { cnt.textContent = `${ta.value.length} of ${NOTE_MAX}`; }; upd(); ta.addEventListener('input', upd);
  const close = (): void => { document.removeEventListener('keydown', key, true); back.remove(); prev?.focus?.(); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === 'Tab') { const f = [...back.querySelectorAll<HTMLElement>('button,textarea')]; const i = f.indexOf(document.activeElement as HTMLElement); e.preventDefault(); e.stopPropagation(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement; if (t === back || t.closest('[data-a="close"]')) { sfx.play('ui'); return close(); }
    const a = (t.closest('button') as HTMLElement | null)?.dataset.a;
    if (a === 'save') { setNote(o.key, ta.value); sfx.play('ui'); close(); o.onSaved(!!ta.value.trim()); }
    else if (a === 'del') { setNote(o.key, ''); sfx.play('ui'); close(); o.onSaved(false); }
  });
  document.addEventListener('keydown', key, true); document.body.appendChild(back); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); sfx.play('open', { vol: 0.4 });
}

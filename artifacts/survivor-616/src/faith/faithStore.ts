// Faith progress, kept in its own small key so it is shared across Lok games on one origin and never touches a game save.
// Nothing here is needed to finish any game (docs/183 section 0).
import { dayKey } from './lokabiblio';
export interface FaithState { v: 1; days: string[]; opened: number; marks: string[]; chapters: string[]; bounces?: number; share?: Share; shareAt?: number; notes?: Record<string, Note> }
export interface Note { t: string; at: number }   // my private words on a verse; never part of what is shared on a profile
export const NOTE_MAX = 500, NOTES_MAX = 300;
export type Share = 'private' | 'friends' | 'public';   // who may see my Faith shelf on G6 Online; private unless I choose   // marks: "book:chapter:verse", newest last; chapters: "book:chapter" read, each counted once
const KEY = 'lok.faith.v1';
export function loadFaith(): FaithState {
  try { const r = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (r && r.v === 1 && Array.isArray(r.days)) return { v: 1, days: r.days.filter((d: unknown) => typeof d === 'string').slice(-400), opened: Number(r.opened) || 0, marks: (Array.isArray(r.marks) ? r.marks : []).filter((m: unknown) => typeof m === 'string' && /^\d{1,2}:\d{1,3}:\d{1,3}$/.test(m)).slice(-200), chapters: (Array.isArray(r.chapters) ? r.chapters : []).filter((m: unknown) => typeof m === 'string' && /^\d{1,2}:\d{1,3}$/.test(m)).slice(-1300), bounces: Math.max(0, Math.floor(Number(r.bounces)) || 0), share: r.share === 'friends' || r.share === 'public' ? r.share : 'private', shareAt: Number(r.shareAt) || 0, notes: cleanNotes(r.notes) }; } catch { /* damaged or unavailable: start fresh */ }
  return { v: 1, days: [], opened: 0, marks: [], chapters: [] };
}
const listeners: Array<(s: FaithState) => void> = [];
/** Be told after every save, so gentle feedback (growth bar, treasure notice) can react without the store knowing about screens. */
export const onFaithSaved = (fn: (s: FaithState) => void): void => { listeners.push(fn); };
export function saveFaith(s: FaithState): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: the streak simply is not kept */ } for (const f of listeners) { try { f(s); } catch { /* feedback must never break saving */ } } }
/** Record that a verse was opened today. Returns the updated state. */
export function recordOpen(now = new Date()): FaithState {
  const s = loadFaith(), k = dayKey(now); if (!s.days.includes(k)) s.days.push(k); s.opened++; saveFaith(s); return s;
}
/** Add or remove a bookmark. Returns true when the verse is bookmarked afterwards. */
export function toggleMark(key: string): boolean {
  const s = loadFaith(), i = s.marks.indexOf(key); if (i >= 0) s.marks.splice(i, 1); else s.marks.push(key);
  saveFaith(s); return i < 0;
}
/** Record that a chapter was read (counted once per chapter, however often it is reopened). */
export function recordChapter(book: number, chapter: number): void {
  const s = loadFaith(), k = `${book}:${chapter}`; if (s.chapters.includes(k)) return; s.chapters.push(k); saveFaith(s);
}
/** Count a bouncing-Bible reminder that was tapped and read. */
export function recordBounce(): void { const s = loadFaith(); s.bounces = (s.bounces ?? 0) + 1; saveFaith(s); }
/** Choose who can see my Faith shelf on my profile. Private by default. */
export function setShare(v: Share): void { const s = loadFaith(); s.share = v; s.shareAt = Date.now(); saveFaith(s); }
/** Keep only well-formed notes (verse key, text up to 500 characters) and at most 300 of them. Pure. */
export function cleanNotes(raw: unknown): Record<string, Note> {
  const out: Record<string, Note> = {}; if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{1,2}:\d{1,3}:\d{1,3}$/.test(k) || !v || typeof v !== 'object') continue;
    const t = String((v as Note).t ?? '').slice(0, NOTE_MAX).trim(), at = Number((v as Note).at) || 0; if (t) out[k] = { t, at };
  }
  const keys = Object.keys(out).sort((a, b) => out[b].at - out[a].at).slice(0, NOTES_MAX); return Object.fromEntries(keys.map((k) => [k, out[k]]));
}
/** Save my note on a verse. Empty text removes it. */
export function setNote(key: string, text: string): void { const s = loadFaith(), t = text.trim().slice(0, NOTE_MAX); const n = { ...(s.notes ?? {}) }; if (t) n[key] = { t, at: Date.now() }; else delete n[key]; s.notes = cleanNotes(n); saveFaith(s); }

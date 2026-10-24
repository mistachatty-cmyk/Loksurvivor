/**
 * The daily message. One small static file, `lok-daily.json`, served from the same place as the
 * game, so it costs no server and carries nothing about the player. The game reads it at most once
 * per day, shows the note that applies today as a line on the hideout strip, and never shows the
 * same note twice. Nothing is fetched while the battery saver or Data Saver is on, while offline, or
 * when the player turned it off in Settings > Power, storage and data.
 */
import { createPref } from './devicePref';
import { isSavingPower } from './powerSaver';

export const dailyFeedPref = createPref<boolean>('survivor616.net.daily-feed.v1', true);

export interface DailyNote {
  id: string;
  /** First day it shows, as YYYY-MM-DD (inclusive). */
  from: string;
  /** Last day it shows, as YYYY-MM-DD (inclusive). */
  until: string;
  title: string;
  line: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTES = 5;

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text && text.length <= max ? text : null;
}

/** Accepts only well-formed notes; anything else in the file is ignored, never trusted. */
export function parseDailyFeed(raw: unknown): DailyNote[] {
  if (!raw || typeof raw !== 'object') return [];
  const notes = (raw as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) return [];
  const out: DailyNote[] = [];
  for (const entry of notes.slice(0, MAX_NOTES)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = clean(e.id, 80);
    const title = clean(e.title, 60);
    const line = clean(e.line, 220);
    const from = typeof e.from === 'string' && DAY.test(e.from) ? e.from : null;
    const until = typeof e.until === 'string' && DAY.test(e.until) ? e.until : null;
    if (id && title && line && from && until && from <= until) out.push({ id, from, until, title, line });
  }
  return out;
}

/** The newest note that applies on `day` (YYYY-MM-DD) and has not been shown yet. */
export function pickNote(notes: readonly DailyNote[], day: string, seen: readonly string[]): DailyNote | null {
  const live = notes.filter((n) => n.from <= day && day <= n.until && !seen.includes(n.id));
  return live.sort((a, b) => (a.from < b.from ? 1 : -1))[0] ?? null;
}

const CACHE_KEY = 'survivor616.daily-feed.v1';
const SEEN_KEY = 'survivor616.daily-feed.seen.v1';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the note simply repeats next visit */
  }
}

/** Why a fetch should not happen right now, or null when it may. */
export function feedBlockedReason(): 'off' | 'saving' | 'offline' | null {
  if (!dailyFeedPref.get()) return 'off';
  if (isSavingPower()) return 'saving';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return null;
}

/** Today's unseen note, or null. Reads the network at most once per day; marks the note seen. */
export async function loadDailyNote(): Promise<DailyNote | null> {
  if (feedBlockedReason()) return null;
  const day = today();
  let cache = readJson<{ day: string; notes: DailyNote[] }>(CACHE_KEY);
  if (!cache || cache.day !== day) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`${import.meta.env.BASE_URL}lok-daily.json`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      window.clearTimeout(timer);
      if (!response.ok) return null;
      cache = { day, notes: parseDailyFeed(await response.json()) };
      writeJson(CACHE_KEY, cache);
    } catch {
      return null;
    }
  }
  const seen = readJson<string[]>(SEEN_KEY) ?? [];
  const note = pickNote(parseDailyFeed({ notes: cache.notes }), day, seen);
  if (!note) return null;
  writeJson(SEEN_KEY, [...seen, note.id].slice(-30));
  return note;
}

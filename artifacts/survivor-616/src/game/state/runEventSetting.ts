/**
 * Device-local switches for run events (supply drop, stampede...). Everything is on
 * until the player turns a beat off; stored as the list of switched-off beat ids.
 */
const KEY = 'survivor616.runEvents.disabled';

export function getDisabledRunEvents(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function setRunEventEnabled(id: string, enabled: boolean): string[] {
  const next = getDisabledRunEvents().filter((entry) => entry !== id);
  if (!enabled) next.push(id);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* lasts until reload */ }
  return next;
}

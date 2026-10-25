/**
 * "What is new since I last looked" for the Inventory screen. The screen saves a snapshot of every
 * count when you leave it; next visit, anything that grew gets a +N chip. Device-local, never sent.
 */
export type InventoryCounts = Record<string, number>;

const KEY = 'survivor616.inventory.seen.v1';

/** Counts that went up since the snapshot. With no snapshot yet nothing is new (the first visit sets the baseline). */
export function newSince(now: InventoryCounts, seen: InventoryCounts | null): InventoryCounts {
  if (!seen) return {};
  const gained: InventoryCounts = {};
  for (const [id, count] of Object.entries(now)) {
    const before = seen[id] ?? 0;
    if (count > before) gained[id] = count - before;
  }
  return gained;
}

export function readSeen(): InventoryCounts | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: InventoryCounts = {};
    for (const [id, value] of Object.entries(parsed)) if (typeof value === 'number' && Number.isFinite(value)) out[id] = value;
    return out;
  } catch {
    return null;
  }
}

export function writeSeen(counts: InventoryCounts): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(counts));
  } catch {
    // The chips are a nicety; no storage just means no chips.
  }
}

import { useEffect, useState } from 'react';

/** The map the player picked on "Where tonight?". Head out on the nav bar launches it. Device-local. */
const KEY = 'survivor616.selected-map.v1';
const EVENT = 'survivor616:selected-map';

export function readSelectedMap(): string | null {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function writeSelectedMap(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* the choice just will not persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSelectedMap(): string | null {
  const [id, setId] = useState<string | null>(readSelectedMap);
  useEffect(() => {
    const sync = () => setId(readSelectedMap());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return id;
}

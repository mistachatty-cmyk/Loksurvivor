import { useSyncExternalStore } from 'react';

export type UiChromeLayout = 'new' | 'classic';

// Classic corners are the default for everyone. The key is versioned so an
// earlier choice does not carry over; the new control dock remains available
// by opting into it from the layout toggle or Settings.
const KEY = 'survivor616.ui.chrome-layout.v3';
const CHANGE_EVENT = 'survivor616.ui.chrome-layout-change';

export function getUiChromeLayout(): UiChromeLayout {
  try { return localStorage.getItem(KEY) === 'new' ? 'new' : 'classic'; }
  catch { return 'classic'; }
}

export function setUiChromeLayout(layout: UiChromeLayout): void {
  try { localStorage.setItem(KEY, layout); } catch { /* Storage may be unavailable. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useUiChromeLayout(): UiChromeLayout {
  return useSyncExternalStore(subscribe, getUiChromeLayout, () => 'classic');
}

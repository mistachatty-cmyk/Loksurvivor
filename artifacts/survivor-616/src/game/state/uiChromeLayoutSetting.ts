import { useSyncExternalStore } from 'react';

export type UiChromeLayout = 'new' | 'classic';

// Start the new control dock for everyone. The previous key could retain an
// old "classic" choice indefinitely, leaving mission/run controls pinned over
// the hideout after an update. The classic layout remains available by opting
// into it again from the layout toggle or Settings.
const KEY = 'survivor616.ui.chrome-layout.v2';
const CHANGE_EVENT = 'survivor616.ui.chrome-layout-change';

export function getUiChromeLayout(): UiChromeLayout {
  try { return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'new'; }
  catch { return 'new'; }
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
  return useSyncExternalStore(subscribe, getUiChromeLayout, () => 'new');
}

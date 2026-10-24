/**
 * Two-tab protection for the save. If the game is open in two tabs, each tab keeps its own copy of
 * the progress in memory and writes it back to the device, so the tab that writes last silently wipes
 * what the other one earned. When this tab sees another tab change the save, it goes "behind": it
 * stops writing at its next save and asks the player which copy to keep. The core is plain state so it can be tested
 * without a browser.
 */
import { useSyncExternalStore } from 'react';

import { createPref } from './devicePref';

/** Settings > Power, storage and data. On by default. */
export const tabGuardPref = createPref<boolean>('survivor616.save.tab-guard.v1', true);

export interface SaveGuard {
  /** Another tab changed the save. Nothing is shown yet: only a write from this tab would clash. */
  noteForeignWrite(): void;
  /**
   * This tab wants to write its progress. True when that is safe. When another tab has changed the
   * save since, this returns false, flags the tab as behind and the player is asked which copy to keep.
   */
  requestWrite(): boolean;
  /** True while this tab is paused waiting for the player's choice. */
  isBehind(): boolean;
  /** The player chose (load the other copy, or keep this one). Writes resume. */
  resolve(): void;
  subscribe(listener: () => void): () => void;
}

export function createSaveGuard(isEnabled: () => boolean): SaveGuard {
  let foreign = false;
  let behind = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    noteForeignWrite() {
      foreign = true;
    },
    requestWrite() {
      if (!isEnabled() || !foreign) return true;
      if (!behind) {
        behind = true;
        emit();
      }
      return false;
    },
    isBehind: () => behind && isEnabled(),
    resolve() {
      const changed = behind;
      foreign = false;
      behind = false;
      if (changed) emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const saveGuard = createSaveGuard(() => tabGuardPref.get());

/** React hook: true while this tab is behind another tab's save. */
export function useSaveBehind(): boolean {
  return useSyncExternalStore(saveGuard.subscribe, saveGuard.isBehind, () => false);
}

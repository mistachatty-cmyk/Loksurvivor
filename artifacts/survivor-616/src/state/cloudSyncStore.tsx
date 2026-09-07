/**
 * Syncs meta-progression to the player's account (when signed in) so
 * progress follows them across devices/browsers instead of living only in
 * one browser's localStorage. Deliberately kept out of metaStore.tsx: this
 * file imports the Supabase-touching auth module, and metaStore.tsx's pure
 * helpers are imported directly by node:test files that don't shim Vite's
 * `import.meta.env` -- pulling that import chain in there would throw at
 * module load time in every one of those tests.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/state/authStore';
import { useMeta } from '@/game/state/metaStore';
import type { MetaState } from '@/game/types';

/** Bookkeeping only -- not part of MetaState/normalizeMeta -- when this device's save was last known to match the cloud. */
const SYNCED_AT_KEY = 'survivor616.meta.v1.syncedAt';
const CLOUD_SYNC_DEBOUNCE_MS = 2000;

export type CloudSyncStatus = 'off' | 'syncing' | 'synced' | 'error';

function readSyncedAt(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(SYNCED_AT_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function writeSyncedAt(ms: number) {
  try {
    window.localStorage.setItem(SYNCED_AT_KEY, String(ms));
  } catch {
    // Non-fatal -- worst case we re-push or re-pull once next sync.
  }
}

const CloudSyncContext = createContext<CloudSyncStatus>('off');

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { session, loadCloudSave, saveCloudSave } = useAuth();
  const { meta, importMeta } = useMeta();
  const [status, setStatus] = useState<CloudSyncStatus>('off');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserId = useRef<string | null>(null);
  // Gates the debounced push effect below until the initial pull-or-push for
  // this sign-in has resolved, so a stale local save can never race ahead of
  // (and overwrite) a richer save the pull is about to bring down.
  const syncReady = useRef(false);

  // Runs once per sign-in: cloud wins only if it's strictly newer than this
  // device's last known-synced timestamp, otherwise this device's current
  // progress is pushed up (covers both "no cloud save yet" and "this device
  // is already caught up or ahead").
  useEffect(() => {
    if (!session) {
      setStatus('off');
      syncedUserId.current = null;
      syncReady.current = false;
      return;
    }
    if (syncedUserId.current === session.user.id) return;
    syncedUserId.current = session.user.id;
    syncReady.current = false;
    let cancelled = false;
    setStatus('syncing');
    void (async () => {
      const cloud = await loadCloudSave();
      if (cancelled) return;
      const cloudUpdatedAt = cloud ? new Date(cloud.updatedAt).getTime() : 0;
      if (cloud && cloudUpdatedAt > readSyncedAt()) {
        importMeta(cloud.data as Partial<MetaState>);
        writeSyncedAt(cloudUpdatedAt);
        setStatus('synced');
      } else {
        const { error } = await saveCloudSave(meta);
        if (cancelled) return;
        if (error) {
          setStatus('error');
        } else {
          writeSyncedAt(Date.now());
          setStatus('synced');
        }
      }
      if (!cancelled) syncReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed only to the signed-in identity, not `meta` -- this
    // should run once per sign-in, not on every local change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loadCloudSave, saveCloudSave, importMeta]);

  // Pushes local changes to the cloud once signed in, debounced so a burst
  // of dispatches (e.g. a run's rewards landing) fires one request, not many.
  useEffect(() => {
    if (!session || !syncReady.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      setStatus('syncing');
      void saveCloudSave(meta).then(({ error }) => {
        if (error) {
          setStatus('error');
        } else {
          writeSyncedAt(Date.now());
          setStatus('synced');
        }
      });
    }, CLOUD_SYNC_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [meta, session, saveCloudSave]);

  return <CloudSyncContext.Provider value={status}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSyncStatus(): CloudSyncStatus {
  return useContext(CloudSyncContext);
}

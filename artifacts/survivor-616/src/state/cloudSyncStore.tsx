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

import { ledgerFingerprint, reportAchievements, toUnlocks } from '@workspace/lok-client';
import { useAuth } from '@/state/authStore';
import { useMeta } from '@/game/state/metaStore';
import type { MetaState } from '@/game/types';
import { buildLokDexSnapshot, lokDexSnapshotFingerprint } from '@/lib/lokDexSnapshot';
import { ACHIEVEMENTS_APP_KEY, syncAchievementLedger } from '@/lib/lokAchievements';
import { musicObjectives } from '@/lib/lokMusicProgress';
import { lokClient } from '@/lib/lokClient';

/** Bookkeeping only -- not part of MetaState/normalizeMeta -- when this device's save was last known to match the cloud. */
const SYNCED_AT_KEY = 'survivor616.meta.v1.syncedAt';
const CLOUD_SYNC_DEBOUNCE_MS = 2000;
/** Longer than the save debounce: the hub's LokDex does not need second-by-second freshness. */
const LOKDEX_SYNC_DEBOUNCE_MS = 5000;

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
  const { session, loadCloudSave, saveCloudSave, saveLokDex, saveMusicProgress } = useAuth();
  const { meta, importMeta, applyCreatorCredTotal } = useMeta();
  const lastCredCheckAt = useRef(0);
  const [status, setStatus] = useState<CloudSyncStatus>('off');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserId = useRef<string | null>(null);
  // Gates the debounced push effect below until the initial pull-or-push for
  // this sign-in has resolved, so a stale local save can never race ahead of
  // (and overwrite) a richer save the pull is about to bring down.
  const syncReady = useRef(false);
  // Same gate as `syncReady`, but as state so the LokDex effect re-runs once the initial pull settles.
  const [syncSettled, setSyncSettled] = useState(false);
  const dexTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDexFingerprint = useRef<string | null>(null);
  const lastMusicObjectives = useRef<number | null>(null);
  const achievementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAchievementFingerprint = useRef<string | null>(null);

  // Runs once per sign-in: cloud wins only if it's strictly newer than this
  // device's last known-synced timestamp, otherwise this device's current
  // progress is pushed up (covers both "no cloud save yet" and "this device
  // is already caught up or ahead").
  useEffect(() => {
    if (!session) {
      setStatus('off');
      syncedUserId.current = null;
      syncReady.current = false;
      lastDexFingerprint.current = null;
      lastMusicObjectives.current = null;
      setSyncSettled(false);
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
      if (lokClient) {
        const { data, error } = await lokClient.rpc('gsix_creator_cred_total');
        if (!cancelled && !error && typeof data === 'number') {
          applyCreatorCredTotal(data);
          lastCredCheckAt.current = Date.now();
        }
      }
      if (!cancelled) {
        syncReady.current = true;
        setSyncSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed only to the signed-in identity, not `meta` -- this
    // should run once per sign-in, not on every local change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loadCloudSave, saveCloudSave, importMeta]);

  useEffect(() => {
    if (!session || !syncSettled || !lokClient) return;
    const refresh = () => {
      if (document.hidden || Date.now() - lastCredCheckAt.current < 600_000) return;
      lastCredCheckAt.current = Date.now();
      void lokClient!.rpc('gsix_creator_cred_total').then(({ data, error }) => {
        if (!error && typeof data === 'number') applyCreatorCredTotal(data);
      });
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [session?.user.id, syncSettled, applyCreatorCredTotal]);

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

  // Publishes the compact LokDex snapshot to the account so the GSix hub can
  // show this player's cards and LokPets. Skipped when nothing the hub shows
  // has changed, so gold/XP-only saves cost no extra request.
  useEffect(() => {
    if (!session || !syncSettled) return;
    if (dexTimer.current) clearTimeout(dexTimer.current);
    dexTimer.current = setTimeout(() => {
      const snapshot = buildLokDexSnapshot(meta);
      const fingerprint = lokDexSnapshotFingerprint(snapshot);
      if (fingerprint === lastDexFingerprint.current) return;
      void saveLokDex(snapshot).then(({ error }) => {
        // On failure leave the fingerprint unset so the next change retries.
        if (!error) lastDexFingerprint.current = fingerprint;
      });
    }, LOKDEX_SYNC_DEBOUNCE_MS);
    return () => {
      if (dexTimer.current) clearTimeout(dexTimer.current);
    };
  }, [meta, session, syncSettled, saveLokDex]);

  // Remembers when each achievement was first earned (they are computed from the
  // save, which does not know), and while signed in reports them to the account
  // so the GSix hub's Achievements page can show what is earned and when. The
  // ledger is kept signed out too, so dates are right when a player signs in later.
  useEffect(() => {
    if (achievementTimer.current) clearTimeout(achievementTimer.current);
    achievementTimer.current = setTimeout(() => {
      const ledger = syncAchievementLedger(meta, window.localStorage);
      if (!session || !syncSettled || !lokClient) {
        lastAchievementFingerprint.current = null;
        return;
      }
      const fingerprint = ledgerFingerprint(ledger);
      if (fingerprint === lastAchievementFingerprint.current || Object.keys(ledger).length === 0) return;
      void reportAchievements(lokClient, ACHIEVEMENTS_APP_KEY, toUnlocks(ACHIEVEMENTS_APP_KEY, ledger)).then(({ error }) => {
        // On failure leave the fingerprint unset so the next change retries.
        if (!error) lastAchievementFingerprint.current = fingerprint;
      });
    }, LOKDEX_SYNC_DEBOUNCE_MS);
    return () => {
      if (achievementTimer.current) clearTimeout(achievementTimer.current);
    };
  }, [meta, session, syncSettled]);

  // Publishes soundtrack progress so the GSix site's player opens the same
  // songs. One small number; sent only when it goes up.
  useEffect(() => {
    if (!session || !syncSettled) return;
    const objectives = musicObjectives(meta);
    if (objectives === 0 && lastMusicObjectives.current === null) return; // nothing earned yet, nothing to publish
    if (lastMusicObjectives.current !== null && objectives <= lastMusicObjectives.current) return;
    void saveMusicProgress(objectives).then(({ error }) => {
      // On failure leave it unset so the next change retries.
      if (!error) lastMusicObjectives.current = objectives;
    });
  }, [meta.soundtrackObjectiveCompletions, session, syncSettled, saveMusicProgress]);

  return <CloudSyncContext.Provider value={status}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSyncStatus(): CloudSyncStatus {
  return useContext(CloudSyncContext);
}

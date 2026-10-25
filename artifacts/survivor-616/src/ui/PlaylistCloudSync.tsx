/**
 * Keeps a signed-in player's custom playlists on their account. Renders nothing. One small read when
 * sign-in finishes and one small write a few seconds after a playlist actually changes; nothing runs
 * while signed out or with the switch in Settings off. See `lib/playlistSync.ts` for the rules.
 */
import { useEffect, useRef } from 'react';

import { BUNDLED_TRACK_IDS, useMusicPlayer } from '@/game/audio/musicPlayer';
import { lokClient } from '@/lib/lokClient';
import { applyPulled, decideSync, PLAYLIST_SYNC_SOURCE, parseSnapshot, syncablePlaylists } from '@/lib/playlistSync';
import { playlistSyncPref } from '@/lib/powerSaver';
import { useAuth } from '@/state/authStore';

const SYNCED_KEY = 'survivor616.playlists.v1.syncedAt';
const PUSH_DELAY_MS = 6000;

function readSynced(): number {
  try { return Number(window.localStorage.getItem(SYNCED_KEY)) || 0; } catch { return 0; }
}
function writeSynced(at: number): void {
  try { window.localStorage.setItem(SYNCED_KEY, String(at)); } catch { /* the next sync just repeats */ }
}

export function PlaylistCloudSync() {
  const { session, loadCloudDoc, saveCloudDoc } = useAuth();
  const enabled = playlistSyncPref.use();
  const { playlists, playlistsEditedAt, importPlaylists } = useMusicPlayer();
  const userId = session?.user.id ?? null;
  const settledFor = useRef<string | null>(null);
  /** The edit time of the copy the account is known to hold. */
  const cloudAtRef = useRef(0);
  const playlistsRef = useRef(playlists);
  const editedRef = useRef(playlistsEditedAt);
  playlistsRef.current = playlists;
  editedRef.current = playlistsEditedAt;

  // Once per sign-in: compare with the account's copy.
  useEffect(() => {
    if (!enabled || !userId || !lokClient) { settledFor.current = null; return; }
    if (settledFor.current === userId) return;
    let cancelled = false;
    void (async () => {
      const cloud = await loadCloudDoc(PLAYLIST_SYNC_SOURCE);
      if (cancelled) return;
      const snapshot = parseSnapshot(cloud?.data, BUNDLED_TRACK_IDS);
      const local = syncablePlaylists(playlistsRef.current, BUNDLED_TRACK_IDS);
      const decision = decideSync(local, editedRef.current, snapshot, readSynced() === 0);
      if (decision.action === 'pull') {
        importPlaylists(applyPulled(playlistsRef.current, decision.playlists, BUNDLED_TRACK_IDS), snapshot!.savedAt);
        cloudAtRef.current = snapshot!.savedAt;
        writeSynced(Date.now());
      } else if (decision.action === 'push' || decision.action === 'merge') {
        const savedAt = Date.now();
        if (decision.action === 'merge') importPlaylists(applyPulled(playlistsRef.current, decision.playlists, BUNDLED_TRACK_IDS), savedAt);
        const { error } = await saveCloudDoc(PLAYLIST_SYNC_SOURCE, { savedAt, playlists: decision.playlists });
        if (!error) { cloudAtRef.current = savedAt; writeSynced(Date.now()); }
      } else {
        cloudAtRef.current = snapshot?.savedAt ?? 0;
        writeSynced(Date.now());
      }
      if (!cancelled) settledFor.current = userId;
    })();
    return () => { cancelled = true; };
  }, [enabled, userId, loadCloudDoc, saveCloudDoc, importPlaylists]);

  // After that: push a few seconds after the playlists change.
  useEffect(() => {
    if (!enabled || !userId || !lokClient || settledFor.current !== userId || playlistsEditedAt === 0 || playlistsEditedAt <= cloudAtRef.current) return;
    const timer = setTimeout(() => {
      const local = syncablePlaylists(playlistsRef.current, BUNDLED_TRACK_IDS);
      const savedAt = editedRef.current;
      void saveCloudDoc(PLAYLIST_SYNC_SOURCE, { savedAt, playlists: local }).then(({ error }) => {
        if (!error) { cloudAtRef.current = savedAt; writeSynced(Date.now()); }
      });
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, userId, playlistsEditedAt, saveCloudDoc]);

  return null;
}

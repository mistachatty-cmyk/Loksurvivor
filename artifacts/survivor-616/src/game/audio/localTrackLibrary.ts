/**
 * Device-local soundtrack library.
 *
 * Player-owned files live in IndexedDB, never leave the browser, and are
 * deleted with the corresponding soundtrack entry. This is intentionally not
 * a sync mechanism: it has no account, backend, or recurring storage cost.
 */

import {
  LOCAL_TRACK_STORE,
  MEDIA_ASSET_STORE,
  openLocalMediaDatabase,
  requestResult,
  transactionDone,
} from './localMediaDatabase';
import { hashBlob, loadMediaAsset, mediaAssetId, saveMediaAsset, type MediaAssetRecord } from './localMediaStore';

export interface StoredLocalTrack {
  id: string;
  title: string;
  file: File;
  isVideoContainer: boolean;
  addedAt: number;
}

export interface LocalLibrarySummary {
  count: number;
  bytes: number;
}

interface StoredLocalTrackReference {
  id: string;
  title: string;
  assetId: string;
  isVideoContainer: boolean;
  addedAt: number;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openLocalMediaDatabase();
  try {
    const transaction = database.transaction(LOCAL_TRACK_STORE, mode);
    const result = await requestResult(run(transaction.objectStore(LOCAL_TRACK_STORE)));
    await transactionDone(transaction);
    return result;
  } finally {
    database.close();
  }
}

export async function saveLocalTrack(track: StoredLocalTrack): Promise<void> {
  const asset = await saveMediaAsset(track.file, {
    fileName: track.file.name || `${track.title}.audio`,
    kind: track.isVideoContainer ? 'video' : 'audio',
    createdAt: track.addedAt,
  });
  const reference: StoredLocalTrackReference = {
    id: track.id,
    title: track.title,
    assetId: asset.id,
    isVideoContainer: track.isVideoContainer,
    addedAt: track.addedAt,
  };
  await withStore('readwrite', (store) => store.put(reference));
}

async function migrateLegacyTrack(track: StoredLocalTrack): Promise<void> {
  const contentHash = await hashBlob(track.file);
  const assetId = mediaAssetId(contentHash);
  const asset: MediaAssetRecord = {
    id: assetId,
    contentHash,
    kind: track.isVideoContainer ? 'video' : 'audio',
    mimeType: track.file.type || 'application/octet-stream',
    byteLength: track.file.size,
    blob: track.file,
    fileName: track.file.name || `${track.title}.audio`,
    createdAt: track.addedAt,
  };
  const reference: StoredLocalTrackReference = {
    id: track.id,
    title: track.title,
    assetId,
    isVideoContainer: track.isVideoContainer,
    addedAt: track.addedAt,
  };

  // Move the legacy inline File and its reference in one transaction. This
  // avoids briefly requiring twice the storage on a device whose quota is
  // already nearly full.
  const database = await openLocalMediaDatabase();
  try {
    const transaction = database.transaction([LOCAL_TRACK_STORE, MEDIA_ASSET_STORE], 'readwrite');
    const assets = transaction.objectStore(MEDIA_ASSET_STORE);
    const existing = (await requestResult(assets.get(assetId))) as MediaAssetRecord | undefined;
    if (!existing?.blob) assets.put(asset);
    transaction.objectStore(LOCAL_TRACK_STORE).put(reference);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function loadLocalTracks(): Promise<StoredLocalTrack[]> {
  const entries = await withStore<unknown[]>('readonly', (store) => store.getAll());
  const restored: StoredLocalTrack[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as {
      id?: unknown;
      title?: unknown;
      file?: unknown;
      assetId?: unknown;
      isVideoContainer?: unknown;
      addedAt?: unknown;
    };
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.isVideoContainer !== 'boolean'
    )
      continue;

    if (candidate.file instanceof Blob) {
      const legacyFile =
        candidate.file instanceof File
          ? candidate.file
          : new File([candidate.file], `${candidate.title}.audio`, {
              type: candidate.file.type,
            });
      const migrated: StoredLocalTrack = {
        id: candidate.id,
        title: candidate.title,
        file: legacyFile,
        isVideoContainer: candidate.isVideoContainer,
        addedAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : Date.now(),
      };
      restored.push(migrated);
      // Version 1 stored the File directly on the track. The migration keeps
      // the same id so every playlist reference continues to resolve.
      try {
        await migrateLegacyTrack(migrated);
      } catch {
        // The inline legacy File is still playable for this session and stays
        // available for another migration attempt on the next load.
      }
      continue;
    }

    if (typeof candidate.assetId !== 'string') continue;
    const asset = await loadMediaAsset(candidate.assetId);
    if (!asset) continue;
    restored.push({
      id: candidate.id,
      title: candidate.title,
      file: new File([asset.blob], asset.fileName, {
        type: asset.mimeType,
        lastModified: asset.createdAt,
      }),
      isVideoContainer: candidate.isVideoContainer,
      addedAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : asset.createdAt,
    });
  }

  return restored;
}

export async function removeLocalTrack(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearLocalTracks(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}

export async function getLocalLibrarySummary(): Promise<LocalLibrarySummary> {
  const tracks = await loadLocalTracks();
  return {
    count: tracks.length,
    bytes: tracks.reduce((total, track) => total + track.file.size, 0),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

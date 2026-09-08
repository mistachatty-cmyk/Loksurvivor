/**
 * Content-addressed storage for player-owned media bytes.
 *
 * Soundtrack entries and Studio projects store references to these records.
 * Equal files therefore occupy one IndexedDB record even when they are used in
 * more than one part of Survivor 616. Nothing here uploads or syncs a file.
 */

import { MEDIA_ASSET_STORE, openLocalMediaDatabase, requestResult, transactionDone } from './localMediaDatabase';

export interface MediaAssetRecord {
  id: string;
  contentHash: string;
  kind: 'audio' | 'image' | 'video';
  mimeType: string;
  byteLength: number;
  blob: Blob;
  fileName: string;
  createdAt: number;
}

export class LocalMediaStorageError extends Error {
  readonly reason: 'unavailable' | 'quota' | 'unknown';

  constructor(message: string, reason: LocalMediaStorageError['reason'], cause?: unknown) {
    super(message, { cause });
    this.name = 'LocalMediaStorageError';
    this.reason = reason;
  }
}

function storageError(cause: unknown): LocalMediaStorageError {
  if (cause instanceof LocalMediaStorageError) return cause;
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'QuotaExceededError') {
    return new LocalMediaStorageError(
      'This device does not have enough browser storage for that file.',
      'quota',
      cause,
    );
  }
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('IndexedDB is unavailable') || message.includes('blocked')) {
    return new LocalMediaStorageError(
      'Device-local media storage is unavailable in this browser.',
      'unavailable',
      cause,
    );
  }
  return new LocalMediaStorageError('Could not save media on this device.', 'unknown', cause);
}

export async function hashBlob(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new LocalMediaStorageError('This browser cannot create safe local media identifiers.', 'unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function mediaAssetId(contentHash: string): string {
  return `sha256:${contentHash}`;
}

export function isMediaAssetId(id: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(id);
}

export async function saveMediaAsset(
  blob: Blob,
  options: {
    fileName: string;
    kind?: MediaAssetRecord['kind'];
    createdAt?: number;
  },
): Promise<MediaAssetRecord> {
  try {
    const contentHash = await hashBlob(blob);
    const id = mediaAssetId(contentHash);
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(MEDIA_ASSET_STORE, 'readwrite');
      const store = transaction.objectStore(MEDIA_ASSET_STORE);
      const existing = (await requestResult(store.get(id))) as MediaAssetRecord | undefined;
      if (existing?.blob instanceof Blob) {
        await transactionDone(transaction);
        return existing;
      }

      const record: MediaAssetRecord = {
        id,
        contentHash,
        kind: options.kind ?? 'audio',
        mimeType: blob.type || 'application/octet-stream',
        byteLength: blob.size,
        blob,
        fileName: options.fileName,
        createdAt: options.createdAt ?? Date.now(),
      };
      store.put(record);
      await transactionDone(transaction);
      return record;
    } finally {
      database.close();
    }
  } catch (cause) {
    throw storageError(cause);
  }
}

export async function loadMediaAssets(ids: Iterable<string>): Promise<MediaAssetRecord[]> {
  const wanted = new Set(ids);
  if (wanted.size === 0) return [];
  try {
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(MEDIA_ASSET_STORE, 'readonly');
      const records = (await requestResult(transaction.objectStore(MEDIA_ASSET_STORE).getAll())) as MediaAssetRecord[];
      await transactionDone(transaction);
      return records.filter(
        (record) =>
          wanted.has(record.id) &&
          typeof record.id === 'string' &&
          typeof record.fileName === 'string' &&
          record.blob instanceof Blob,
      );
    } finally {
      database.close();
    }
  } catch (cause) {
    throw storageError(cause);
  }
}

export async function loadMediaAsset(id: string): Promise<MediaAssetRecord | null> {
  return (await loadMediaAssets([id]))[0] ?? null;
}

/**
 * What this game keeps on the device, for Settings > Power, storage and data. Everything stays
 * local: this only reads sizes. The save lives in localStorage; the player's own music and media
 * files live in the device's IndexedDB (see `localMediaStore.ts`).
 */
import { LOCAL_TRACK_STORE, MEDIA_ASSET_STORE, openLocalMediaDatabase } from '@/game/audio/localMediaDatabase';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Size of everything this game stores in localStorage (keys and values, two bytes per character). */
export function saveBytes(storage: Pick<Storage, 'length' | 'key' | 'getItem'> = window.localStorage): number {
  let chars = 0;
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith('survivor616.')) continue;
    chars += key.length + (storage.getItem(key)?.length ?? 0);
  }
  return chars * 2;
}

export interface MediaTotals {
  files: number;
  bytes: number;
}

/** Count and size of the player's own music and media files kept on this device. */
export async function mediaTotals(): Promise<MediaTotals> {
  const database = await openLocalMediaDatabase();
  try {
    const sumStore = (name: string) =>
      new Promise<MediaTotals>((resolve, reject) => {
        if (!database.objectStoreNames.contains(name)) {
          resolve({ files: 0, bytes: 0 });
          return;
        }
        const total: MediaTotals = { files: 0, bytes: 0 };
        const request = database.transaction(name, 'readonly').objectStore(name).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(total);
            return;
          }
          const value = cursor.value as { byteLength?: number; size?: number; blob?: Blob; file?: Blob };
          total.files += 1;
          total.bytes += value.byteLength ?? value.size ?? value.blob?.size ?? value.file?.size ?? 0;
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    const [assets, tracks] = await Promise.all([sumStore(MEDIA_ASSET_STORE), sumStore(LOCAL_TRACK_STORE)]);
    return { files: assets.files + tracks.files, bytes: assets.bytes + tracks.bytes };
  } finally {
    database.close();
  }
}

export interface StorageReport {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  save: number;
  media: MediaTotals | null;
}

export async function readStorageReport(): Promise<StorageReport> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  const [estimate, persisted, media] = await Promise.all([
    storage?.estimate?.().catch(() => undefined),
    storage?.persisted?.().catch(() => undefined),
    mediaTotals().catch(() => null),
  ]);
  let save = 0;
  try {
    save = saveBytes();
  } catch {
    /* storage blocked */
  }
  return { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted: persisted ?? null, save, media };
}

/** Asks the browser not to clear this game's storage when the device runs low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) === true;
  } catch {
    return false;
  }
}

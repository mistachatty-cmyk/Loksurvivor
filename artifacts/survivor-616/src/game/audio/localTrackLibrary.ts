/**
 * Device-local soundtrack library.
 *
 * Player-owned files live in IndexedDB, never leave the browser, and are
 * deleted with the corresponding soundtrack entry. This is intentionally not
 * a sync mechanism: it has no account, backend, or recurring storage cost.
 */

const DATABASE_NAME = 'survivor616-soundtrack';
const DATABASE_VERSION = 1;
const STORE_NAME = 'tracks';

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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local soundtrack library.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Local soundtrack storage failed.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Local soundtrack storage failed.'));
    });
  } finally {
    database.close();
  }
}

export async function saveLocalTrack(track: StoredLocalTrack): Promise<void> {
  await withStore('readwrite', (store) => store.put(track));
}

export async function loadLocalTracks(): Promise<StoredLocalTrack[]> {
  const entries = await withStore('readonly', (store) => store.getAll());
  return entries.filter(
    (entry): entry is StoredLocalTrack =>
      typeof entry?.id === 'string' &&
      typeof entry?.title === 'string' &&
      entry?.file instanceof Blob &&
      typeof entry?.isVideoContainer === 'boolean',
  );
}

export async function removeLocalTrack(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearLocalTracks(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}

export async function getLocalLibrarySummary(): Promise<LocalLibrarySummary> {
  const tracks = await loadLocalTracks();
  return { count: tracks.length, bytes: tracks.reduce((total, track) => total + track.file.size, 0) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

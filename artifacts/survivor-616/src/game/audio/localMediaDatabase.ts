/**
 * Shared device-local database for player-owned media.
 *
 * Keep the historical database name so every soundtrack file saved by the
 * first local-library release remains available after the schema grows to
 * support Studio projects and content-addressed assets.
 */

export const LOCAL_MEDIA_DATABASE_NAME = 'survivor616-soundtrack';
export const LOCAL_MEDIA_DATABASE_VERSION = 2;

export const LOCAL_TRACK_STORE = 'tracks';
export const MEDIA_ASSET_STORE = 'media-assets';
export const STUDIO_PROJECT_STORE = 'studio-projects';

export function openLocalMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }

    const request = indexedDB.open(LOCAL_MEDIA_DATABASE_NAME, LOCAL_MEDIA_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_TRACK_STORE)) {
        database.createObjectStore(LOCAL_TRACK_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(MEDIA_ASSET_STORE)) {
        database.createObjectStore(MEDIA_ASSET_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STUDIO_PROJECT_STORE)) {
        database.createObjectStore(STUDIO_PROJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local media storage.'));
    request.onblocked = () => reject(new Error('Local media storage is blocked by another open tab.'));
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local media storage failed.'));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Local media storage was cancelled.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Local media storage failed.'));
  });
}

import type { StudioProject } from './v3Project';

const DATABASE = 'survivor616-character-studio';
const STORE = 'drafts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    let result: T;
    run(tx.objectStore(STORE), (value) => { result = value; });
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onerror = () => { database.close(); reject(tx.error); };
    tx.onabort = () => { database.close(); reject(tx.error); };
  });
}

export function saveStudioDraft(project: StudioProject): Promise<void> {
  return transaction('readwrite', (store, done) => { store.put(project); done(undefined); });
}
export function loadStudioDraft(id: string): Promise<StudioProject | undefined> {
  return transaction('readonly', (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result as StudioProject | undefined);
  });
}
export function listStudioDrafts(): Promise<StudioProject[]> {
  return transaction('readonly', (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result as StudioProject[]);
  });
}
export function deleteStudioDraft(id: string): Promise<void> {
  return transaction('readwrite', (store, done) => { store.delete(id); done(undefined); });
}

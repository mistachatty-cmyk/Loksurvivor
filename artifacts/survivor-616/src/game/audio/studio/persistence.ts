/**
 * Versioned, device-local persistence for the active Studio workspace.
 *
 * The project remains plain JSON. Audio bytes live in the shared media store
 * and the workspace carries only asset ids, so a finished render or imported
 * stem can be reused by the Soundtrack without storing the bytes twice.
 */

import { openLocalMediaDatabase, requestResult, STUDIO_PROJECT_STORE, transactionDone } from '../localMediaDatabase';
import {
  isMediaAssetId,
  loadMediaAssets,
  LocalMediaStorageError,
  saveMediaAsset,
  type MediaAssetRecord,
} from '../localMediaStore';
import { parseProject, type StudioProject } from './project';

export const STUDIO_WORKSPACE_VERSION = 1;
export const ACTIVE_STUDIO_WORKSPACE_ID = 'active';

export interface StudioWorkspaceRecord {
  id: typeof ACTIVE_STUDIO_WORKSPACE_ID;
  version: number;
  project: StudioProject;
  /** Placed clips plus imported sources still waiting in the Clips panel. */
  assetIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StudioWorkspaceSnapshot {
  project: StudioProject;
  assetIds: string[];
  createdAt: number;
  updatedAt: number;
}

function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => typeof value === 'string' && value.length > 0))];
}

export function referencedStudioAssetIds(project: StudioProject): string[] {
  return uniqueStrings(
    project.tracks.flatMap((track) => track.clips.map((clip) => clip.bufferId)).filter(isMediaAssetId),
  );
}

export function createStudioWorkspaceRecord(
  project: StudioProject,
  libraryAssetIds: Iterable<string>,
  previous?: Pick<StudioWorkspaceRecord, 'createdAt'> | null,
  now = Date.now(),
): StudioWorkspaceRecord {
  return {
    id: ACTIVE_STUDIO_WORKSPACE_ID,
    version: STUDIO_WORKSPACE_VERSION,
    project: parseProject(project),
    assetIds: uniqueStrings([...referencedStudioAssetIds(project), ...[...libraryAssetIds].filter(isMediaAssetId)]),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function parseStudioWorkspaceRecord(raw: unknown): StudioWorkspaceRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<StudioWorkspaceRecord>;
  if (candidate.id !== ACTIVE_STUDIO_WORKSPACE_ID || !candidate.project) return null;
  const now = Date.now();
  return createStudioWorkspaceRecord(
    parseProject(candidate.project),
    Array.isArray(candidate.assetIds) ? candidate.assetIds : [],
    {
      createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : now,
    },
    typeof candidate.updatedAt === 'number' ? candidate.updatedAt : now,
  );
}

function asPersistenceError(cause: unknown): LocalMediaStorageError {
  if (cause instanceof LocalMediaStorageError) return cause;
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'QuotaExceededError') {
    return new LocalMediaStorageError(
      'The Studio is out of device-local browser storage. Export a project backup or remove unused media.',
      'quota',
      cause,
    );
  }
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('IndexedDB is unavailable') || message.includes('blocked')) {
    return new LocalMediaStorageError(
      'The Studio can run for this session, but device-local project storage is unavailable.',
      'unavailable',
      cause,
    );
  }
  return new LocalMediaStorageError('The Studio could not save its local project.', 'unknown', cause);
}

export async function loadStudioWorkspace(): Promise<StudioWorkspaceRecord | null> {
  try {
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(STUDIO_PROJECT_STORE, 'readonly');
      const raw = await requestResult(transaction.objectStore(STUDIO_PROJECT_STORE).get(ACTIVE_STUDIO_WORKSPACE_ID));
      await transactionDone(transaction);
      return parseStudioWorkspaceRecord(raw);
    } finally {
      database.close();
    }
  } catch (cause) {
    throw asPersistenceError(cause);
  }
}

export async function saveStudioWorkspace(
  project: StudioProject,
  libraryAssetIds: Iterable<string>,
): Promise<StudioWorkspaceRecord> {
  try {
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(STUDIO_PROJECT_STORE, 'readwrite');
      const store = transaction.objectStore(STUDIO_PROJECT_STORE);
      const previous = parseStudioWorkspaceRecord(await requestResult(store.get(ACTIVE_STUDIO_WORKSPACE_ID)));
      const record = createStudioWorkspaceRecord(project, libraryAssetIds, previous);
      store.put(record);
      await transactionDone(transaction);
      return record;
    } finally {
      database.close();
    }
  } catch (cause) {
    throw asPersistenceError(cause);
  }
}

export async function saveStudioAudioFile(file: File): Promise<MediaAssetRecord> {
  return saveMediaAsset(file, {
    fileName: file.name,
    kind: 'audio',
    createdAt: file.lastModified || Date.now(),
  });
}

export async function loadStudioAudioAssets(assetIds: Iterable<string>): Promise<MediaAssetRecord[]> {
  return loadMediaAssets(assetIds);
}

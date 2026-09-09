/**
 * Versioned, device-local persistence for Studio projects.
 *
 * Project documents remain plain JSON. Audio bytes live in the shared media
 * store and projects carry only asset ids, so duplicates and Soundtrack uses
 * do not duplicate the player's files.
 */

import {
  LOCAL_TRACK_STORE,
  MEDIA_ASSET_STORE,
  openLocalMediaDatabase,
  requestResult,
  STUDIO_PROJECT_STORE,
  transactionDone,
} from '../localMediaDatabase';
import {
  isMediaAssetId,
  loadMediaAssets,
  LocalMediaStorageError,
  saveMediaAsset,
  type MediaAssetRecord,
} from '../localMediaStore';
import { createProject, parseProject, type StudioProject } from './project';

export const STUDIO_WORKSPACE_VERSION = 1;
/** The id used by the single-project release. Kept only for migration tests. */
export const ACTIVE_STUDIO_WORKSPACE_ID = 'active';
export const STUDIO_PROJECT_INDEX_ID = 'workspace-index';
const PROJECT_ID_PREFIX = 'project:';

export interface StudioWorkspaceRecord {
  id: string;
  kind: 'project';
  version: number;
  project: StudioProject;
  /** Placed clips plus imported sources still waiting in the Clips panel. */
  assetIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface StudioWorkspaceIndexRecord {
  id: typeof STUDIO_PROJECT_INDEX_ID;
  kind: 'index';
  version: number;
  activeProjectId: string;
}

export interface StudioProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  trackCount: number;
  clipCount: number;
  sourceCount: number;
  missingSourceCount: number;
}

export interface DeleteStudioProjectResult {
  active: StudioWorkspaceRecord;
  removedAssetCount: number;
}

function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => typeof value === 'string' && value.length > 0))];
}

function projectId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${PROJECT_ID_PREFIX}${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

export function referencedStudioAssetIds(project: StudioProject): string[] {
  return uniqueStrings(
    project.tracks.flatMap((track) => track.clips.map((clip) => clip.bufferId)).filter(isMediaAssetId),
  );
}

export function createStudioWorkspaceRecord(
  project: StudioProject,
  libraryAssetIds: Iterable<string>,
  previous?: Pick<StudioWorkspaceRecord, 'id' | 'createdAt'> | null,
  now = Date.now(),
  preferredId?: string,
): StudioWorkspaceRecord {
  return {
    id: previous?.id ?? preferredId ?? projectId(),
    kind: 'project',
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
  if (typeof candidate.id !== 'string' || candidate.id === STUDIO_PROJECT_INDEX_ID || !candidate.project) return null;
  const now = Date.now();
  return createStudioWorkspaceRecord(
    parseProject(candidate.project),
    Array.isArray(candidate.assetIds) ? candidate.assetIds : [],
    {
      id: candidate.id,
      createdAt:
        typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt) ? candidate.createdAt : now,
    },
    typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : now,
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

function newestProject(projects: StudioWorkspaceRecord[]): StudioWorkspaceRecord | null {
  let newest: StudioWorkspaceRecord | null = null;
  for (const project of projects) {
    if (!newest || project.updatedAt > newest.updatedAt) newest = project;
  }
  return newest;
}

/** Reads multi-project state and atomically upgrades the old `active` record. */
async function readProjectState(store: IDBObjectStore): Promise<{
  active: StudioWorkspaceRecord | null;
  projects: StudioWorkspaceRecord[];
}> {
  const rawRecords = (await requestResult(store.getAll())) as unknown[];
  const parsed = rawRecords
    .map(parseStudioWorkspaceRecord)
    .filter((record): record is StudioWorkspaceRecord => record !== null);
  const rawIndex = rawRecords.find(
    (record) => !!record && typeof record === 'object' && (record as { id?: unknown }).id === STUDIO_PROJECT_INDEX_ID,
  ) as Partial<StudioWorkspaceIndexRecord> | undefined;

  let projects = parsed;
  let active =
    typeof rawIndex?.activeProjectId === 'string'
      ? (projects.find((project) => project.id === rawIndex.activeProjectId) ?? null)
      : null;

  const legacy = projects.find((project) => project.id === ACTIVE_STUDIO_WORKSPACE_ID);
  if (legacy) {
    const migrated = createStudioWorkspaceRecord(legacy.project, legacy.assetIds, null, legacy.updatedAt);
    migrated.createdAt = legacy.createdAt;
    store.put(migrated);
    store.delete(ACTIVE_STUDIO_WORKSPACE_ID);
    projects = [migrated, ...projects.filter((project) => project.id !== ACTIVE_STUDIO_WORKSPACE_ID)];
    if (!active || active.id === ACTIVE_STUDIO_WORKSPACE_ID) active = migrated;
  }

  active ??= newestProject(projects);
  if (active && rawIndex?.activeProjectId !== active.id) {
    store.put({
      id: STUDIO_PROJECT_INDEX_ID,
      kind: 'index',
      version: STUDIO_WORKSPACE_VERSION,
      activeProjectId: active.id,
    } satisfies StudioWorkspaceIndexRecord);
  }
  return { active, projects };
}

async function withProjectStore<T>(run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  try {
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(STUDIO_PROJECT_STORE, 'readwrite');
      const result = await run(transaction.objectStore(STUDIO_PROJECT_STORE));
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  } catch (cause) {
    throw asPersistenceError(cause);
  }
}

export async function loadStudioWorkspace(): Promise<StudioWorkspaceRecord | null> {
  return withProjectStore(async (store) => (await readProjectState(store)).active);
}

export async function listStudioProjects(): Promise<StudioProjectSummary[]> {
  const projects = await withProjectStore(async (store) => (await readProjectState(store)).projects);
  const assets = await loadMediaAssets(projects.flatMap((project) => project.assetIds));
  const available = new Set(assets.map((asset) => asset.id));
  return projects
    .map((record) => ({
      id: record.id,
      name: record.project.name,
      updatedAt: record.updatedAt,
      trackCount: record.project.tracks.length,
      clipCount: record.project.tracks.reduce((total, track) => total + track.clips.length, 0),
      sourceCount: record.assetIds.length,
      missingSourceCount: record.assetIds.reduce((total, id) => total + (available.has(id) ? 0 : 1), 0),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveStudioWorkspace(
  project: StudioProject,
  libraryAssetIds: Iterable<string>,
  expectedProjectId?: string | null,
): Promise<StudioWorkspaceRecord> {
  return withProjectStore(async (store) => {
    const state = await readProjectState(store);
    const previous = expectedProjectId
      ? (state.projects.find((record) => record.id === expectedProjectId) ?? null)
      : state.active;
    if (expectedProjectId && !previous) throw new Error('That local Studio project no longer exists.');
    const record = createStudioWorkspaceRecord(project, libraryAssetIds, previous);
    store.put(record);
    if (!state.active || state.active.id === record.id || !expectedProjectId) {
      store.put({
        id: STUDIO_PROJECT_INDEX_ID,
        kind: 'index',
        version: STUDIO_WORKSPACE_VERSION,
        activeProjectId: record.id,
      } satisfies StudioWorkspaceIndexRecord);
    }
    return record;
  });
}

export async function createStudioProjectWorkspace(name = 'Untitled'): Promise<StudioWorkspaceRecord> {
  return withProjectStore(async (store) => {
    await readProjectState(store);
    const record = createStudioWorkspaceRecord(createProject(name), []);
    store.put(record);
    store.put({
      id: STUDIO_PROJECT_INDEX_ID,
      kind: 'index',
      version: STUDIO_WORKSPACE_VERSION,
      activeProjectId: record.id,
    } satisfies StudioWorkspaceIndexRecord);
    return record;
  });
}

export async function openStudioProject(projectId: string): Promise<StudioWorkspaceRecord> {
  return withProjectStore(async (store) => {
    const state = await readProjectState(store);
    const record = state.projects.find((project) => project.id === projectId);
    if (!record) throw new Error('That local Studio project no longer exists.');
    store.put({
      id: STUDIO_PROJECT_INDEX_ID,
      kind: 'index',
      version: STUDIO_WORKSPACE_VERSION,
      activeProjectId: record.id,
    } satisfies StudioWorkspaceIndexRecord);
    return record;
  });
}

export async function renameStudioProject(projectId: string, name: string): Promise<StudioWorkspaceRecord> {
  return withProjectStore(async (store) => {
    const state = await readProjectState(store);
    const previous = state.projects.find((project) => project.id === projectId);
    if (!previous) throw new Error('That local Studio project no longer exists.');
    const record = createStudioWorkspaceRecord({ ...previous.project, name }, previous.assetIds, previous);
    store.put(record);
    return record;
  });
}

export async function duplicateStudioProject(projectId: string): Promise<StudioWorkspaceRecord> {
  return withProjectStore(async (store) => {
    const state = await readProjectState(store);
    const source = state.projects.find((project) => project.id === projectId);
    if (!source) throw new Error('That local Studio project no longer exists.');
    const record = createStudioWorkspaceRecord(
      { ...source.project, name: `${source.project.name || 'Untitled'} Copy` },
      source.assetIds,
    );
    store.put(record);
    store.put({
      id: STUDIO_PROJECT_INDEX_ID,
      kind: 'index',
      version: STUDIO_WORKSPACE_VERSION,
      activeProjectId: record.id,
    } satisfies StudioWorkspaceIndexRecord);
    return record;
  });
}

export async function deleteStudioProject(projectId: string): Promise<DeleteStudioProjectResult> {
  try {
    const database = await openLocalMediaDatabase();
    try {
      const transaction = database.transaction(
        [STUDIO_PROJECT_STORE, LOCAL_TRACK_STORE, MEDIA_ASSET_STORE],
        'readwrite',
      );
      const projectStore = transaction.objectStore(STUDIO_PROJECT_STORE);
      const state = await readProjectState(projectStore);
      const deleting = state.projects.find((project) => project.id === projectId);
      if (!deleting) throw new Error('That local Studio project no longer exists.');

      const remaining = state.projects.filter((project) => project.id !== projectId);
      let active = state.active?.id === projectId ? newestProject(remaining) : state.active;
      if (!active) {
        active = createStudioWorkspaceRecord(createProject(), []);
        projectStore.put(active);
        remaining.push(active);
      }

      projectStore.delete(projectId);
      projectStore.put({
        id: STUDIO_PROJECT_INDEX_ID,
        kind: 'index',
        version: STUDIO_WORKSPACE_VERSION,
        activeProjectId: active.id,
      } satisfies StudioWorkspaceIndexRecord);

      const retained = new Set(remaining.flatMap((project) => project.assetIds));
      const soundtrackEntries = (await requestResult(transaction.objectStore(LOCAL_TRACK_STORE).getAll())) as Array<{
        assetId?: unknown;
      }>;
      for (const entry of soundtrackEntries) {
        if (typeof entry.assetId === 'string') retained.add(entry.assetId);
      }

      let removedAssetCount = 0;
      const assets = transaction.objectStore(MEDIA_ASSET_STORE);
      for (const assetId of deleting.assetIds) {
        if (!retained.has(assetId)) {
          const existing = await requestResult(assets.get(assetId));
          if (existing) {
            assets.delete(assetId);
            removedAssetCount += 1;
          }
        }
      }
      await transactionDone(transaction);
      return { active, removedAssetCount };
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

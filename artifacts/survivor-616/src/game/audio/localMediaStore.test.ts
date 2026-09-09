import 'fake-indexeddb/auto';

import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import {
  LOCAL_MEDIA_DATABASE_NAME,
  LOCAL_MEDIA_DATABASE_VERSION,
  LOCAL_TRACK_STORE,
  MEDIA_ASSET_STORE,
  openLocalMediaDatabase,
  requestResult,
  STUDIO_PROJECT_STORE,
  transactionDone,
} from './localMediaDatabase';
import { loadMediaAssets } from './localMediaStore';
import { loadLocalTracks, saveLocalTrack } from './localTrackLibrary';
import { addClip, createProject } from './studio/project';
import {
  ACTIVE_STUDIO_WORKSPACE_ID,
  createStudioProjectWorkspace,
  deleteStudioProject,
  duplicateStudioProject,
  listStudioProjects,
  loadStudioAudioAssets,
  loadStudioWorkspace,
  openStudioProject,
  renameStudioProject,
  saveStudioAudioFile,
  saveStudioWorkspace,
} from './studio/persistence';

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_MEDIA_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
  });
}

beforeEach(deleteDatabase);

test('version one soundtrack files migrate without losing their bytes', async () => {
  const legacyFile = new File(['legacy audio bytes'], 'legacy.wav', {
    type: 'audio/wav',
    lastModified: 616,
  });
  const legacyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_MEDIA_DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LOCAL_TRACK_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const legacyTransaction = legacyDatabase.transaction(LOCAL_TRACK_STORE, 'readwrite');
  legacyTransaction.objectStore(LOCAL_TRACK_STORE).put({
    id: 'legacy-track',
    title: 'Legacy',
    file: legacyFile,
    isVideoContainer: false,
    addedAt: 616,
  });
  await transactionDone(legacyTransaction);
  legacyDatabase.close();

  const restored = await loadLocalTracks();
  assert.equal(restored.length, 1);
  assert.equal(restored[0]!.id, 'legacy-track');
  assert.equal(await restored[0]!.file.text(), 'legacy audio bytes');

  const database = await openLocalMediaDatabase();
  assert.equal(database.version, LOCAL_MEDIA_DATABASE_VERSION);
  assert.deepEqual([...database.objectStoreNames], [MEDIA_ASSET_STORE, STUDIO_PROJECT_STORE, LOCAL_TRACK_STORE].sort());
  const transaction = database.transaction([LOCAL_TRACK_STORE, MEDIA_ASSET_STORE], 'readonly');
  const migratedTrack = (await requestResult(transaction.objectStore(LOCAL_TRACK_STORE).get('legacy-track'))) as {
    assetId?: string;
    file?: File;
  };
  const assets = (await requestResult(transaction.objectStore(MEDIA_ASSET_STORE).getAll())) as unknown[];
  await transactionDone(transaction);
  database.close();
  assert.match(migratedTrack.assetId ?? '', /^sha256:/);
  assert.equal(migratedTrack.file, undefined);
  assert.equal(assets.length, 1);
});

test('equal media bytes are stored once and shared by Studio references', async () => {
  const soundtrackFile = new File(['one source'], 'soundtrack.wav', { type: 'audio/wav' });
  await saveLocalTrack({
    id: 'soundtrack-copy',
    title: 'One source',
    file: soundtrackFile,
    isVideoContainer: false,
    addedAt: 616,
  });
  const studioAsset = await saveStudioAudioFile(new File(['one source'], 'studio-copy.wav', { type: 'audio/wav' }));
  const shared = await loadMediaAssets([studioAsset.id]);
  assert.equal(shared.length, 1);
  const database = await openLocalMediaDatabase();
  const transaction = database.transaction([LOCAL_TRACK_STORE, MEDIA_ASSET_STORE], 'readonly');
  const soundtrackReference = (await requestResult(
    transaction.objectStore(LOCAL_TRACK_STORE).get('soundtrack-copy'),
  )) as { assetId: string };
  const assetCount = await requestResult(transaction.objectStore(MEDIA_ASSET_STORE).count());
  await transactionDone(transaction);
  database.close();
  assert.equal(soundtrackReference.assetId, studioAsset.id);
  assert.equal(assetCount, 1);

  let project = createProject('Deduplicated');
  project = addClip(project, project.tracks[0]!.id, {
    bufferId: studioAsset.id,
    name: 'One source',
    startBeat: 0,
    lengthBeats: 4,
  });
  await saveStudioWorkspace(project, [studioAsset.id]);

  const restored = await loadStudioWorkspace();
  assert.ok(restored);
  assert.equal(restored.project.name, 'Deduplicated');
  assert.deepEqual(restored.assetIds, [studioAsset.id]);
  assert.equal((await loadStudioAudioAssets(restored.assetIds)).length, 1);

  const duplicate = await duplicateStudioProject(restored.id);
  assert.deepEqual(duplicate.assetIds, [studioAsset.id]);
  const reopenedDatabase = await openLocalMediaDatabase();
  const reopenedTransaction = reopenedDatabase.transaction(MEDIA_ASSET_STORE, 'readonly');
  const duplicatedAssetCount = await requestResult(reopenedTransaction.objectStore(MEDIA_ASSET_STORE).count());
  await transactionDone(reopenedTransaction);
  reopenedDatabase.close();
  assert.equal(duplicatedAssetCount, 1, 'duplicating a project does not duplicate its media bytes');
});

test('a saved Studio audio file and project reopen from the shared database', async () => {
  const file = new File(['owned recording'], 'mic-take.webm', {
    type: 'audio/webm',
    lastModified: 1_000,
  });
  const asset = await saveStudioAudioFile(file);
  const project = createProject('Basement take');
  const saved = await saveStudioWorkspace(project, [asset.id]);
  assert.equal(saved.assetIds[0], asset.id);

  const reopened = await loadStudioWorkspace();
  const sources = await loadStudioAudioAssets(reopened?.assetIds ?? []);
  assert.equal(reopened?.project.name, 'Basement take');
  assert.equal(sources.length, 1);
  assert.equal(sources[0]!.fileName, 'mic-take.webm');
  assert.equal(await sources[0]!.blob.text(), 'owned recording');
});

test('the single active workspace migrates into the multi-project index', async () => {
  const database = await openLocalMediaDatabase();
  const transaction = database.transaction(STUDIO_PROJECT_STORE, 'readwrite');
  transaction.objectStore(STUDIO_PROJECT_STORE).put({
    id: ACTIVE_STUDIO_WORKSPACE_ID,
    version: 1,
    project: createProject('Single-project release'),
    assetIds: [],
    createdAt: 10,
    updatedAt: 20,
  });
  await transactionDone(transaction);
  database.close();

  const migrated = await loadStudioWorkspace();
  assert.ok(migrated);
  assert.match(migrated.id, /^project:/);
  assert.equal(migrated.project.name, 'Single-project release');
  assert.equal(migrated.createdAt, 10);
  assert.equal((await listStudioProjects()).length, 1);

  const reopenedDatabase = await openLocalMediaDatabase();
  const reopenedTransaction = reopenedDatabase.transaction(STUDIO_PROJECT_STORE, 'readonly');
  const oldRecord = await requestResult(
    reopenedTransaction.objectStore(STUDIO_PROJECT_STORE).get(ACTIVE_STUDIO_WORKSPACE_ID),
  );
  await transactionDone(reopenedTransaction);
  reopenedDatabase.close();
  assert.equal(oldRecord, undefined);
});

test('projects can be created, renamed, opened, duplicated, and deleted', async () => {
  const first = await saveStudioWorkspace(createProject('First'), []);
  const second = await createStudioProjectWorkspace('Second');
  await renameStudioProject(first.id, 'First renamed');

  const opened = await openStudioProject(first.id);
  assert.equal(opened.project.name, 'First renamed');
  assert.equal((await loadStudioWorkspace())?.id, first.id);

  const duplicate = await duplicateStudioProject(first.id);
  assert.notEqual(duplicate.id, first.id);
  assert.equal(duplicate.project.name, 'First renamed Copy');
  assert.equal((await loadStudioWorkspace())?.id, duplicate.id);

  const deleted = await deleteStudioProject(second.id);
  assert.equal(deleted.active.id, duplicate.id);
  assert.deepEqual((await listStudioProjects()).map((project) => project.name).sort(), [
    'First renamed',
    'First renamed Copy',
  ]);
});

test('project summaries report unavailable local sources without dropping the project', async () => {
  const unavailableAssetId = `sha256:${'f'.repeat(64)}`;
  const saved = await saveStudioWorkspace(createProject('Needs source'), [unavailableAssetId]);
  const summary = (await listStudioProjects()).find((project) => project.id === saved.id);
  assert.ok(summary);
  assert.equal(summary.sourceCount, 1);
  assert.equal(summary.missingSourceCount, 1);
});

test('project deletion removes only media with no project or Soundtrack references', async () => {
  const shared = await saveStudioAudioFile(new File(['shared'], 'shared.wav', { type: 'audio/wav' }));
  const orphan = await saveStudioAudioFile(new File(['orphan'], 'orphan.wav', { type: 'audio/wav' }));
  const soundtrack = await saveStudioAudioFile(new File(['soundtrack'], 'soundtrack.wav', { type: 'audio/wav' }));

  const first = await saveStudioWorkspace(createProject('First'), [shared.id, orphan.id, soundtrack.id]);
  await createStudioProjectWorkspace('Second');
  const second = await saveStudioWorkspace(createProject('Second'), [shared.id]);
  await saveLocalTrack({
    id: 'soundtrack-owner',
    title: 'Soundtrack owner',
    file: new File(['soundtrack'], 'soundtrack-copy.wav', { type: 'audio/wav' }),
    isVideoContainer: false,
    addedAt: 616,
  });

  const result = await deleteStudioProject(first.id);
  assert.equal(result.active.id, second.id);
  assert.equal(result.removedAssetCount, 1);
  assert.deepEqual(
    (await loadMediaAssets([shared.id, orphan.id, soundtrack.id])).map((asset) => asset.id).sort(),
    [shared.id, soundtrack.id].sort(),
  );
});

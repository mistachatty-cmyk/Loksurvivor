import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';

import { unzipSync, zipSync, strToU8 } from 'fflate';

import { createProjectBundle, readProjectBundle } from './bundle';
import { saveStudioAudioFile } from './persistence';
import { addClip, createProject } from './project';

test('portable project restores its owned sound and arrangement', async () => {
  const asset = await saveStudioAudioFile(new File(['unique sound'], 'beat.wav', { type: 'audio/wav' }));
  const blank = createProject('Portable Beat');
  const project = addClip(blank, blank.tracks[0]!.id, {
    bufferId: asset.id, name: 'Beat', startBeat: 4, lengthBeats: 4,
  });
  const bundle = await createProjectBundle(project, [asset.id]);
  const restored = await readProjectBundle(new File([bundle], 'beat.616project'));
  assert.equal(restored.project.name, 'Portable Beat');
  assert.deepEqual(restored.assetIds, [asset.id]);
  assert.equal(restored.project.tracks[0]!.clips[0]!.bufferId, asset.id);
});

test('a project backup with a missing sound is rejected before import', async () => {
  const blank = createProject();
  const project = addClip(blank, blank.tracks[0]!.id, {
    bufferId: 'sha256:' + 'a'.repeat(64), name: 'Missing', startBeat: 0, lengthBeats: 4,
  });
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify({
    format: 'survivor616-project', version: 1, project, assets: [],
  })) });
  await assert.rejects(() => readProjectBundle(new File([bytes.slice().buffer], 'missing.616project')), /omits audio/);
  assert.ok(unzipSync(bytes)['manifest.json']);
});

test('portable project includes a custom drum pad sample', async () => {
  const asset = await saveStudioAudioFile(new File(['pad sample'], 'kick.wav', { type: 'audio/wav' }));
  const blank = createProject('Sample Kit');
  const project = {
    ...blank,
    kits: blank.kits.map((kit, index) => index === 0
      ? { ...kit, palette: 'custom' as const, pads: kit.pads.map((pad, padIndex) => padIndex === 0 ? { ...pad, sourceId: asset.id } : pad) }
      : kit),
  };
  const bundle = await createProjectBundle(project, [asset.id]);
  const restored = await readProjectBundle(new File([bundle], 'kit.616project'));
  assert.equal(restored.project.kits[0]!.pads[0]!.sourceId, asset.id);
  assert.deepEqual(restored.assetIds, [asset.id]);
});

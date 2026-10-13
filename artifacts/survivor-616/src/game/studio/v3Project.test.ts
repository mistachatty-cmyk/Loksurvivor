import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLIPS, DIRECTIONS, REQUIRED_FRAMES, approvalCount, approveStudioFrame, editStudioFrame, generateStudioProject, isStudioComplete, projectFromForgedOperator, studioErrors } from './v3Project';
import { exportForgedOperator, generateForgedOperator, importForgedOperator } from '@/game/data/operatorForge';

const options = { id: 'fixture-v3', kind: 'operator' as const, sourceId: 'starter', seed: 'fixture-seed', prompt: 'creepy winged' };

test('v3 generation is deterministic and has all eight directions and 192 frames', () => {
  const first = generateStudioProject(options);
  const second = generateStudioProject(options);
  assert.equal(first.rigFamily, 'winged');
  assert.equal(first.styleFamily, 'creepy');
  assert.deepEqual(first.views, second.views);
  assert.equal(DIRECTIONS.reduce((count, direction) => count + Object.keys(CLIPS).reduce((n, clip) => n + first.views[direction][clip as keyof typeof CLIPS].length, 0), 0), REQUIRED_FRAMES);
  assert.deepEqual(studioErrors(first), []);
  assert.equal(isStudioComplete(first), false);
});

test('each frame needs explicit review and editing revokes that review', () => {
  let project = generateStudioProject(options);
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as (keyof typeof CLIPS)[]) {
    for (let i = 0; i < CLIPS[clip]; i++) project = approveStudioFrame(project, direction, clip, i);
  }
  assert.equal(approvalCount(project), 192);
  assert.equal(isStudioComplete(project), true);
  project = editStudioFrame(project, 'S', 'idle', 0, (frame) => { frame.layers['layer-0']!.push([0, 0, 3]); });
  assert.equal(approvalCount(project), 191);
  assert.equal(isStudioComplete(project), false);
});

test('v3 frame data remains separate from v2 Forge save shape', () => {
  const project = generateStudioProject(options);
  assert.equal(project.version, 3);
  assert.equal(project.approvalState, 'draft');
  assert.ok(project.views.S.idle[0]?.layers['layer-0']);
});

test('FORGE1 import remains valid and copying to v3 preserves the legacy record', () => {
  const legacy = generateForgedOperator('v2-fixture', 'shade', new Set(), 100);
  const shared = exportForgedOperator(legacy);
  const imported = importForgedOperator(shared, new Set(), 101);
  assert.ok(imported);
  const before = structuredClone(imported);
  const project = projectFromForgedOperator(imported, 'new-v3-id');
  assert.equal(project.sourceId, 'shade');
  assert.equal(project.name, imported.name);
  assert.equal(project.palette[3], imported.design.palette.body);
  assert.equal(project.approvalState, 'draft');
  assert.deepEqual(imported, before);
});

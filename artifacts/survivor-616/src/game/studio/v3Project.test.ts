import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLIPS, DIRECTIONS, REQUIRED_FRAMES, approvalCount, approveStudioClip, approveStudioFrame, copyStudioClipToDirections, copyStudioFrameToClip, editStudioAppearance, editStudioFrame, generateBlankStudioProject, generateStudioProject, isStudioComplete, paintStudioBrush, paintStudioLine, projectFromForgedOperator, studioErrors } from './v3Project';
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

test('pixel brush paints exact XY pixels, replaces colors, erases, and clips at the map edge', () => {
  const frame = generateStudioProject(options).views.S.idle[0]!;
  frame.layers['layer-0'] = [];
  paintStudioBrush(frame, 'layer-0', 12, 9, 4);
  assert.deepEqual(frame.layers['layer-0'], [[12, 9, 4]]);
  paintStudioBrush(frame, 'layer-0', 12, 9, 6);
  assert.deepEqual(frame.layers['layer-0'], [[12, 9, 6]]);
  paintStudioBrush(frame, 'layer-0', 46, 46, 3, 8);
  assert.equal(frame.layers['layer-0']!.length, 5);
  assert.deepEqual(frame.layers['layer-0']!.slice(1), [[46, 46, 3], [47, 46, 3], [46, 47, 3], [47, 47, 3]]);
  paintStudioBrush(frame, 'layer-0', 46, 46, 0, 8, true);
  assert.deepEqual(frame.layers['layer-0'], [[12, 9, 6]]);
});

test('blank projects begin empty and need visible art before submission', () => {
  const blank = generateBlankStudioProject(options);
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as (keyof typeof CLIPS)[]) {
    for (const frame of blank.views[direction][clip]) assert.deepEqual(frame.layers['layer-0'], []);
  }
  assert.ok(studioErrors(blank).includes('Add visible art before submitting'));
  const drawn = editStudioFrame(blank, 'S', 'idle', 0, (frame) => paintStudioBrush(frame, 'layer-0', 3, 4, 2));
  assert.ok(!studioErrors(drawn).includes('Add visible art before submitting'));
  const hidden = editStudioAppearance(drawn, (draft) => { draft.layers[0]!.visible = false; });
  assert.ok(studioErrors(hidden).includes('Add visible art before submitting'));
});

test('interpolated strokes leave no gaps and palette changes revoke all approvals', () => {
  const frame = generateBlankStudioProject(options).views.S.idle[0]!;
  paintStudioLine(frame, 'layer-0', 2, 2, 8, 2, 3);
  assert.deepEqual(frame.layers['layer-0']!.map(([x, y]) => [x, y]), [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]]);
  paintStudioLine(frame, 'layer-0', 2, 2, 8, 2, 3, 1, true);
  assert.deepEqual(frame.layers['layer-0'], []);
  const approved = approveStudioClip(generateStudioProject(options), 'S', 'idle');
  assert.equal(approvalCount(approved), CLIPS.idle);
  const recolored = editStudioAppearance(approved, (draft) => { draft.palette[3] = '#123456'; });
  assert.equal(recolored.palette[3], '#123456');
  assert.equal(approvalCount(recolored), 0);
  assert.equal(approvalCount(approved), CLIPS.idle);
});

test('copying a clip replaces seven directions, clears copied reviews, and keeps frames independent', () => {
  let project = generateStudioProject(options);
  project = editStudioFrame(project, 'S', 'idle', 0, (frame) => { frame.layers['layer-0'] = [[4, 5, 7]]; });
  project = approveStudioFrame(project, 'S', 'idle', 0);
  project = approveStudioFrame(project, 'E', 'idle', 1);
  const source = structuredClone(project.views.S.idle);
  const revision = project.revision;

  const copied = copyStudioClipToDirections(project, 'S', 'idle');

  assert.equal(copied.revision, revision + 1);
  assert.equal(copied.approvalState, 'draft');
  assert.deepEqual(copied.views.S.idle, source);
  for (const direction of DIRECTIONS.filter((value) => value !== 'S')) {
    assert.deepEqual(copied.views[direction].idle.map(({ ms, layers, offsets, rotations }) => ({ ms, layers, offsets, rotations })), source.map(({ ms, layers, offsets, rotations }) => ({ ms, layers, offsets, rotations })));
    assert.ok(copied.views[direction].idle.every((frame) => !frame.approved));
  }
  copied.views.E.idle[0]!.layers['layer-0']!.push([6, 7, 8]);
  assert.equal(copied.views.S.idle[0]!.layers['layer-0']!.some(([x, y]) => x === 6 && y === 7), false);
  assert.equal(project.views.E.idle[1]!.approved, true);
});

test('copying a frame pose updates the other clip frames and preserves their timing', () => {
  let project = generateStudioProject(options);
  project = editStudioFrame(project, 'S', 'walk', 2, (frame) => {
    frame.layers['layer-0'] = [[8, 9, 4]];
    frame.offsets['layer-0'] = [2, -1];
    frame.rotations = { 'layer-0': 15 };
  });
  project = approveStudioFrame(project, 'S', 'walk', 0);
  project = editStudioFrame(project, 'S', 'walk', 4, (frame) => { frame.ms = 210; });
  const sourceBefore = structuredClone(project.views.S.walk[2]);
  const revision = project.revision;

  const copied = copyStudioFrameToClip(project, 'S', 'walk', 2);

  assert.equal(copied.revision, revision + 1);
  assert.equal(copied.approvalState, 'draft');
  assert.deepEqual(copied.views.S.walk[2], sourceBefore);
  for (const [index, frame] of copied.views.S.walk.entries()) {
    if (index === 2) continue;
    assert.equal(frame.ms, index === 4 ? 210 : 130);
    assert.equal(frame.approved, false);
    assert.deepEqual(frame.layers, sourceBefore.layers);
    assert.deepEqual(frame.offsets, sourceBefore.offsets);
    assert.deepEqual(frame.rotations, sourceBefore.rotations);
  }
  copied.views.S.walk[0]!.layers['layer-0']!.push([10, 11, 3]);
  assert.equal(copied.views.S.walk[2]!.layers['layer-0']!.some(([x, y]) => x === 10 && y === 11), false);
  assert.equal(project.views.S.walk[0]!.approved, true);
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

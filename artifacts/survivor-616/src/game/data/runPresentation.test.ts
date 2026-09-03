import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendRunPresentation,
  dismissRunPresentation,
  recordRunHistory,
  updateRunPresentationHead,
} from './runPresentation';

test('rapid run presentations preserve FIFO order including duplicate result ids', () => {
  let queue = appendRunPresentation([], { sequence: 1, id: 'damage' });
  queue = appendRunPresentation(queue, { sequence: 2, id: 'damage' });
  queue = appendRunPresentation(queue, { sequence: 3, id: 'speed' });
  assert.deepEqual(
    queue.map((item) => item.sequence),
    [1, 2, 3],
  );
  queue = dismissRunPresentation(queue);
  assert.deepEqual(
    queue.map((item) => item.sequence),
    [2, 3],
  );
});

test('presentation animation updates only the visible queue head', () => {
  const queue = [{ value: 'spinning' }, { value: 'waiting' }];
  const updated = updateRunPresentationHead(queue, (head) => ({ ...head, value: 'landed' }));
  assert.deepEqual(updated, [{ value: 'landed' }, { value: 'waiting' }]);
  assert.deepEqual(queue, [{ value: 'spinning' }, { value: 'waiting' }]);
});

test('recent loot history is newest-first and bounded', () => {
  let history: number[] = [];
  for (let value = 0; value < 12; value += 1)
    history = recordRunHistory(history, value, 8);
  assert.deepEqual(history, [11, 10, 9, 8, 7, 6, 5, 4]);
});

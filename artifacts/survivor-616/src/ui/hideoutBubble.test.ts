import assert from 'node:assert/strict';
import test from 'node:test';

import { layoutBubble, rectsOverlap, wrapBubbleText } from '@/ui/hideoutBubble';

const measure = (s: string) => s.length * 6;

test('text wraps to the width and truncates with an ellipsis past the line limit', () => {
  const lines = wrapBubbleText(measure, 'one two three four five six seven eight nine ten eleven twelve', 60, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => measure(l) <= 66));
  assert.ok(lines[1]!.endsWith('…'));
  assert.deepEqual(wrapBubbleText(measure, 'short', 200, 3), ['short']);
  assert.deepEqual(wrapBubbleText(measure, 'unbreakablewordthatislong', 30, 3), ['unbreakablewordthatislong']);
});

test('a bubble goes above a head that has headroom and always stays inside the strip', () => {
  const above = layoutBubble(measure, { text: 'Hello there, friend.', anchorX: 300, headY: 100, cssW: 800, cssH: 176 });
  assert.equal(above.placement, 'above');
  assert.ok(above.y + above.h < 100, 'sits over the head, not on the feet');
  const nearEdge = layoutBubble(measure, { text: 'Hello there, friend.', anchorX: 4, headY: 100, cssW: 800, cssH: 176 });
  assert.ok(nearEdge.x >= 4 && nearEdge.x + nearEdge.w <= 796);
  assert.ok(nearEdge.tailX >= nearEdge.x && nearEdge.tailX <= nearEdge.x + nearEdge.w, 'the tail stays on the bubble');
});

test('with no headroom the bubble moves beside the speaker, on the side with room', () => {
  const right = layoutBubble(measure, { text: 'Tall sprite, short strip.', anchorX: 100, headY: 30, cssW: 800, cssH: 176 });
  assert.equal(right.placement, 'right');
  assert.ok(right.x > 100, 'clear of the speaker');
  const left = layoutBubble(measure, { text: 'Tall sprite, short strip.', anchorX: 760, headY: 30, cssW: 800, cssH: 176 });
  assert.equal(left.placement, 'left');
  assert.ok(left.x + left.w < 760);
  for (const b of [right, left]) assert.ok(b.y >= 4 && b.y + b.h <= 172);
});

test('a title adds a header line', () => {
  const plain = layoutBubble(measure, { text: 'Found 5 cred.', anchorX: 300, headY: 120, cssW: 800, cssH: 176 });
  const titled = layoutBubble(measure, { text: 'Found 5 cred.', title: 'Bell', anchorX: 300, headY: 120, cssW: 800, cssH: 176 });
  assert.ok(titled.h > plain.h);
});

test('a second bubble is nudged clear of one already on the strip', () => {
  const input = { text: 'Same spot, different speaker.', anchorX: 300, headY: 150, cssW: 800, cssH: 220 };
  const first = layoutBubble(measure, input);
  const second = layoutBubble(measure, { ...input, avoid: [first] });
  assert.equal(rectsOverlap(first, second, 0), false);
  assert.ok(second.y >= 4 && second.y + second.h <= 216);
});

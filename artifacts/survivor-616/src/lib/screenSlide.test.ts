import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DOCK_PAGES, dockIndexFor, slideKind, swipeTargetId } from './screenSlide';

test('dock pages own distinct screens', () => {
  const all = DOCK_PAGES.flatMap((page) => page.screens);
  assert.equal(new Set(all).size, all.length);
  assert.equal(dockIndexFor('lok-shop'), dockIndexFor('card-shop'));
  assert.equal(dockIndexFor('run'), -1);
});

test('slideKind follows the dock order and skips canvas screens', () => {
  assert.equal(slideKind('hub', 'areas'), 'next');
  assert.equal(slideKind('settings', 'roster'), 'prev');
  assert.equal(slideKind('card-shop', 'lok-shop'), 'rise');
  assert.equal(slideKind('hub', 'bestiary'), 'rise');
  assert.equal(slideKind('areas', 'run'), 'none');
  assert.equal(slideKind('run', 'summary'), 'none');
  assert.equal(slideKind('hub', 'hub'), 'none');
});

test('swipes pick the neighbouring page and ignore scrolling, short or slow drags', () => {
  assert.equal(swipeTargetId('areas', { dx: -120, dy: 10, ms: 200 }), 'roster');
  assert.equal(swipeTargetId('areas', { dx: 120, dy: -10, ms: 200 }), 'hub');
  assert.equal(swipeTargetId('hub', { dx: 120, dy: 0, ms: 200 }), null, 'no page before the first');
  assert.equal(swipeTargetId('settings', { dx: -120, dy: 0, ms: 200 }), null, 'no page after the last');
  assert.equal(swipeTargetId('areas', { dx: -40, dy: 0, ms: 100 }), null, 'too short');
  assert.equal(swipeTargetId('areas', { dx: -120, dy: 90, ms: 200 }), null, 'mostly vertical');
  assert.equal(swipeTargetId('areas', { dx: -120, dy: 0, ms: 1500 }), null, 'too slow');
  assert.equal(swipeTargetId('bestiary', { dx: -120, dy: 0, ms: 200 }), null, 'not a dock page');
  assert.equal(swipeTargetId('lok-shop', { dx: -120, dy: 0, ms: 200 }), 'settings');
});

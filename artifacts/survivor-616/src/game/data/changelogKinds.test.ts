import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHANGELOG_KIND_META,
  CHANGELOG_KIND_ORDER,
  DEFAULT_UPDATE_POPUP_KINDS,
  normalizeUpdatePopupKinds,
  visibleUpdatePopupEntries,
} from './changelogKinds';

test('releases use exactly four distinct palettes with the retained hotfix and update colors', () => {
  assert.deepEqual(CHANGELOG_KIND_ORDER, ['bugfix', 'hotfix', 'update', 'expansion']);
  assert.equal(new Set(CHANGELOG_KIND_ORDER.map((kind) => CHANGELOG_KIND_META[kind].color)).size, 4);
  assert.equal(CHANGELOG_KIND_META.hotfix.color, '#fbbf24');
  assert.equal(CHANGELOG_KIND_META.update.color, '#22d3ee');
  assert.equal(CHANGELOG_KIND_META.expansion.color, '#ef4444');
  for (const kind of CHANGELOG_KIND_ORDER) assert.ok(CHANGELOG_KIND_META[kind].lore);
});

test('older and malformed saved preferences keep all automatic notices enabled', () => {
  assert.deepEqual(normalizeUpdatePopupKinds(undefined), DEFAULT_UPDATE_POPUP_KINDS);
  assert.deepEqual(normalizeUpdatePopupKinds({ hotfix: false, update: 'off' }), {
    bugfix: true,
    hotfix: false,
    update: true,
    expansion: true,
  });
});

test('each category independently controls its automatic notice', () => {
  const entries = CHANGELOG_KIND_ORDER.map((kind) => ({ kind }));
  for (const disabled of CHANGELOG_KIND_ORDER) {
    const preferences = { ...DEFAULT_UPDATE_POPUP_KINDS, [disabled]: false };
    assert.deepEqual(visibleUpdatePopupEntries(entries, preferences).map((entry) => entry.kind),
      CHANGELOG_KIND_ORDER.filter((kind) => kind !== disabled));
  }
});

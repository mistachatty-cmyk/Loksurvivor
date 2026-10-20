import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeSupporterFeed, supporterItemText, supporterScrollSeconds } from '../../../../lib/lok-universe/src/supporters';

describe('supporter feed rules (shared SDK)', () => {
  it('drops malformed rows, markup and blanks, and caps names', () => {
    const rows = [
      { display: 'Ada', tier: 'pass', founder: false },
      { display: '  <b>Zed</b>  ', tier: 'passport' },
      { display: '   ', tier: 'pass' },
      { display: 'x'.repeat(80), tier: 'lifetime', founder: true },
      { display: 'Nope', tier: 'gold' },
      null,
    ];
    const out = sanitizeSupporterFeed(rows);
    assert.deepEqual(out.map((e) => e.display), ['Ada', 'bZed/b', 'x'.repeat(32)]);
    assert.equal(sanitizeSupporterFeed('nope').length, 0);
  });

  it('marks founders and keeps scroll speed steady', () => {
    assert.equal(supporterItemText({ display: 'Ada', tier: 'lifetime', founder: true }), '★ Ada · FOUNDER');
    assert.equal(supporterItemText({ display: 'Ada', tier: 'pass', founder: false }), '◆ Ada');
    assert.equal(supporterScrollSeconds(2), 30);
    assert.equal(supporterScrollSeconds(20), 100);
  });
});

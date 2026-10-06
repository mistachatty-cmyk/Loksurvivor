import assert from 'node:assert/strict';
import test from 'node:test';

import { REPORT_URL, encodeReport, reportPayload, reportUrl } from './runLink';

function decode(encoded: string): unknown {
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

test('a report round-trips through the URL fragment encoding', () => {
  const summary = { destroyedPct: 87, kills: 12, level: 5, elapsedSec: 203 };
  assert.deepEqual(decode(encodeReport(summary)), { v: 1, pct: 87, kills: 12, level: 5, sec: 203, ch: 'foreman' });
});

test('the encoded report is URL-safe base64 with no padding', () => {
  const encoded = encodeReport({ destroyedPct: 100, kills: 999999, level: 99, elapsedSec: 86400 });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
});

test('values are clamped and sanitised, so a bad number cannot produce a bad link', () => {
  assert.deepEqual(reportPayload({ destroyedPct: 250, kills: -4, level: Number.NaN, elapsedSec: Infinity }), {
    v: 1,
    pct: 100,
    kills: 0,
    level: 0,
    sec: 0,
    ch: 'foreman',
  });
  assert.equal(reportPayload({ destroyedPct: 49.6, kills: 1.4, level: 2, elapsedSec: 9.5 }).pct, 50);
});

test('the report URL puts the run in the fragment (never sent to a server) and names no page', () => {
  const url = reportUrl({ destroyedPct: 40, kills: 3, level: 2, elapsedSec: 61 });
  assert.ok(url.startsWith(`${REPORT_URL}#r=`));
  assert.equal(new URL(url).search, '', 'nothing in the query string');
  assert.ok(!/(http|www|\.com)/i.test(decodeURIComponent(url.split('#r=')[1]!)), 'payload carries no address');
});

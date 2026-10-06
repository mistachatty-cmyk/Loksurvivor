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

test('teardown numbers ride along as an optional x field and keep the fragment far under the hub limit', () => {
  const roles = { text: 99999, link: 99999, heading: 99999, button: 99999, image: 99999, frame: 99999, input: 99999, box: 99999 };
  const summary = {
    destroyedPct: 100,
    kills: 999999,
    level: 999,
    elapsedSec: 86400,
    teardown: { roles, words: 9_999_999, px: 9e12, biggest: 9e9, combo: 99999 },
  };
  const encoded = encodeReport(summary, 'data-weaver-lyra');
  assert.ok(encoded.length < 480, `fragment is ${encoded.length} chars; the hub accepts at most 512`);
  const decoded = decode(encoded) as { v: number; pct: number; x: { r: Record<string, number> } };
  assert.equal(decoded.v, 1, 'the version stays 1 so an older hub still opens the link');
  assert.equal(decoded.x.r.t, 99999);
  assert.equal(Object.keys(decoded.x.r).length, 8);
  assert.equal('x' in reportPayload({ destroyedPct: 5, kills: 1, level: 1, elapsedSec: 1 }), false, 'no teardown, no x');
});

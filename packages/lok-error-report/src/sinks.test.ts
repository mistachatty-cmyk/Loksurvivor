import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { callbackSink, localSink, lokFeedbackSink, repoDocsSink, webhookSink } from './sinks';
import type { ErrorReport } from './types';

function fakeStorage(initial?: string) {
  let value: string | null = initial ?? null;
  return { getItem: () => value, setItem: (_k: string, v: string) => { value = v; }, removeItem: () => { value = null; }, peek: () => value };
}

const report = (n: number, extra: Partial<ErrorReport> = {}): ErrorReport => ({
  id: `LER-00000${n}`, fingerprint: String(n).padStart(16, 'a'), kind: 'error', category: 'script', severity: 'crash', name: 'Error', message: `m${n}`,
  stack: [], appKey: 'a', appVersion: '1', buildId: 'b', mode: 'prod', at: n, lastAt: n, count: 1, path: '/', userAgent: 'x', context: {}, breadcrumbs: [], ...extra,
});

describe('localSink', () => {
  it('keeps the newest reports, one per crash, and drops the heavy dev source', () => {
    const storage = fakeStorage();
    const sink = localSink('k', 3, storage);
    for (let i = 1; i <= 5; i += 1) sink.send(report(i));
    sink.send(report(5, { count: 9, source: { frames: [{ file: 'f', line: 1, col: 1 }] } }));
    const list = sink.list();
    assert.equal(list.length, 3);
    assert.equal(list[0]!.count, 9);
    assert.equal(list[0]!.source, undefined);
    assert.deepEqual(list.map((r) => r.id), ['LER-000005', 'LER-000004', 'LER-000003']);
    sink.clear();
    assert.deepEqual(sink.list(), []);
  });

  it('survives corrupt, full or missing storage', () => {
    assert.deepEqual(localSink('k', 3, fakeStorage('{nope')).list(), []);
    assert.deepEqual(localSink('k', 3, fakeStorage('{"a":1}')).list(), []);
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    assert.doesNotThrow(() => localSink('k', 3, full).send(report(1)));
    assert.doesNotThrow(() => localSink('k', 3, null).send(report(1)));
  });
});

describe('other sinks', () => {
  it('callbackSink hands over the report', () => {
    const seen: string[] = [];
    callbackSink('cb', (r) => seen.push(r.id)).send(report(1));
    assert.deepEqual(seen, ['LER-000001']);
  });

  it('webhookSink posts JSON without the dev source', async () => {
    let body = '';
    let url = '';
    await webhookSink('https://logs.example/ingest', { headers: { authorization: 'k' }, fetchImpl: async (u, init) => { url = u; body = init.body; return { ok: true }; } })
      .send(report(1, { source: { frames: [] } }));
    assert.equal(url, 'https://logs.example/ingest');
    assert.equal(JSON.parse(body).report.id, 'LER-000001');
    assert.equal(JSON.parse(body).report.source, undefined);
  });

  it('lokFeedbackSink sends one compact bug row per crash, and tries again after a failure', async () => {
    const rows: Array<{ source: string; category: string; message: string }> = [];
    let fail = true;
    const sink = lokFeedbackSink('616_survivor', async (input) => { rows.push(input); return fail ? { error: { message: 'offline' } } : { error: null }; });
    await assert.rejects(() => Promise.resolve(sink.send(report(1))), /offline/);
    assert.equal(sink.sent(report(1)), false);
    fail = false;
    await sink.send(report(1));
    await sink.send(report(1));
    assert.equal(rows.length, 2, 'the second success is not sent again');
    assert.equal(rows[0]!.category, 'bug');
    assert.equal(rows[0]!.source, '616_survivor');
    assert.ok(rows[0]!.message.startsWith('[LER-000001]'));
    assert.ok(rows[0]!.message.length <= 3500);
    assert.equal(sink.sent(report(1)), true);
  });

  it('lokFeedbackSink sends again when the player adds a description after an automatic send', async () => {
    const rows: { message: string }[] = [];
    const sink = lokFeedbackSink('616_survivor', async (input) => { rows.push(input); return { error: null }; });
    await sink.send(report(1));
    await sink.send({ ...report(1), note: 'it froze when I opened the map' });
    await sink.send({ ...report(1), note: 'it froze when I opened the map' });
    assert.equal(rows.length, 2);
    assert.match(rows[1]!.message, /it froze when I opened the map/);
  });

  it('repoDocsSink posts with the dev header and returns the located source', async () => {
    let headers: Record<string, string> = {};
    const sink = repoDocsSink({ fetchImpl: async (_u, init) => { headers = init.headers; return { ok: true, json: async () => ({ source: { frames: [{ file: 'src/a.ts', line: 2, col: 1 }] } }) }; } });
    const result = await sink.send(report(1));
    assert.equal(headers['x-lok-error-report'], '1');
    assert.equal((result as { source: { frames: Array<{ line: number }> } }).source.frames[0]!.line, 2);
    const down = repoDocsSink({ fetchImpl: async () => ({ ok: false }) });
    assert.equal(await down.send(report(1)), undefined);
  });
});

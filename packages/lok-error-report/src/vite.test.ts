import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transformWithEsbuild } from 'vite';

import { coerceReport, handleReportPost, resolveFrames, type HandlerDeps } from './vite';
import { parseReportDoc, renderErrorsIndex } from './format';
import { hash16 } from './fingerprint';

const SOURCE = ['import x from "y";', '', 'export function boom(state: { hp: number } | undefined) {', '  const doubled = state!.hp * 2;', '  return doubled;', '}', ''].join('\n');

async function fixture() {
  const out = await transformWithEsbuild(SOURCE, '/proj/src/game/boom.ts', { sourcemap: true, loader: 'ts' });
  const map = typeof out.map === 'string' ? JSON.parse(out.map) : out.map;
  // The generated line holding `state.hp` is what the browser reports.
  const genLine = out.code.split('\n').findIndex((l) => l.includes('state.hp')) + 1;
  return { code: out.code, map: { ...map, sources: ['/proj/src/game/boom.ts'], sourcesContent: [SOURCE] }, genLine };
}

function makeDeps(over: Partial<HandlerDeps> & { files?: Map<string, string> } = {}): HandlerDeps & { files: Map<string, string> } {
  const files = over.files ?? new Map<string, string>();
  return {
    root: '/proj', outDir: 'docs/errors', maxFiles: 3, radius: 1, seen: new Map(),
    transform: async () => null,
    io: {
      read: async (f) => files.get(f) ?? null,
      write: async (f, t) => { files.set(f, t); },
      list: async () => [...files.keys()].map((k) => k.split('/').pop()!),
    },
    ...over,
    files,
  };
}

const fp = hash16('some crash');
const body = (extra: Record<string, unknown> = {}, report: Record<string, unknown> = {}) => JSON.stringify({
  report: {
    fingerprint: fp, name: 'TypeError', message: "Cannot read 'hp'", kind: 'error', category: 'script', count: 1, at: 1_700_000_000_000, lastAt: 1_700_000_000_000,
    stack: [{ raw: 'at boom (http://h/src/game/boom.ts:1:1)', fn: 'boom', file: '/src/game/boom.ts', line: 4, col: 3, app: true }], appKey: 'app', appVersion: '1', buildId: 'b', ...report,
  },
  ...extra,
});

describe('dev source resolution', () => {
  it('maps a generated position back to the original file, line and code', async () => {
    const f = await fixture();
    const deps = makeDeps({ transform: async () => ({ code: f.code, map: f.map }) });
    const source = await resolveFrames([{ raw: '', fn: 'boom', file: '/src/game/boom.ts', line: f.genLine, col: 22, app: true }], deps);
    assert.equal(source.frames.length, 1);
    const frame = source.frames[0]!;
    assert.equal(frame.file, 'src/game/boom.ts');
    assert.equal(frame.line, 4);
    assert.equal(frame.snippet!.lines[frame.snippet!.highlight], '  const doubled = state!.hp * 2;');
    assert.equal(frame.snippet!.startLine, 3);
    assert.equal(frame.snippet!.lines.length, 3);
  });

  it('resolves sources named relative to the module, the way the dev server writes them', async () => {
    const f = await fixture();
    const deps = makeDeps({ transform: async () => ({ code: f.code, map: { ...f.map, sources: ['boom.ts'] } }) });
    const source = await resolveFrames([{ raw: '', file: '/src/game/boom.ts', line: f.genLine, col: 22, app: true }], deps);
    assert.equal(source.frames[0]!.file, 'src/game/boom.ts');
  });

  it('skips library frames and anything it cannot map', async () => {
    const deps = makeDeps({ transform: async () => { throw new Error('nope'); } });
    const source = await resolveFrames([
      { raw: '', file: '/node_modules/react/index.js', line: 1, col: 1, app: false },
      { raw: '', file: '/src/a.ts', line: 1, col: 1, app: true },
    ], deps);
    assert.deepEqual(source.frames, []);
  });
});

describe('the dev endpoint', () => {
  it('writes a crash document named from the validated hash and bumps occurrences on repeats', async () => {
    const f = await fixture();
    const deps = makeDeps({ transform: async () => ({ code: f.code, map: f.map }) });
    const first = await handleReportPost(body({}, { stack: [{ raw: '', fn: 'boom', file: '/src/game/boom.ts', line: f.genLine, col: 22, app: true }] }), deps);
    assert.equal(first.status, 200);
    const file = `/proj/docs/errors/${fp}.md`;
    assert.ok(deps.files.has(file));
    const doc = parseReportDoc(deps.files.get(file)!);
    assert.equal(doc.fields.location, 'src/game/boom.ts:4:19');
    assert.equal(doc.fields.occurrences, '1');
    assert.match(doc.body, /const doubled = state!\.hp/);

    await handleReportPost(body({}, { count: 2 }), deps);
    await handleReportPost(body({}, { count: 4 }), deps);
    assert.equal(parseReportDoc(deps.files.get(file)!).fields.occurrences, '4', 'only the difference is added each time');
  });

  it('shows but never writes crashes made on purpose', async () => {
    const deps = makeDeps();
    const result = await handleReportPost(body({}, { message: 'LokErrorReport test: on purpose' }), deps);
    assert.equal(result.status, 200);
    assert.equal(deps.files.size, 0);
  });

  it('rejects bad input, oversized bodies and path tricks, and caps how many documents it creates', async () => {
    const deps = makeDeps();
    assert.equal((await handleReportPost('{nope', deps)).status, 400);
    assert.equal((await handleReportPost(JSON.stringify({ report: { fingerprint: '../../etc/passwd' } }), deps)).status, 400);
    assert.equal((await handleReportPost('x'.repeat(200_000), deps)).status, 413);
    assert.equal(deps.files.size, 0);
    for (let i = 0; i < 5; i += 1) await handleReportPost(body({}, { fingerprint: hash16(`c${i}`) }), deps);
    assert.equal(deps.files.size, 3, 'stops creating files past the cap');
  });

  it('coerces untrusted fields to safe values', () => {
    const r = coerceReport({ fingerprint: fp, name: 5, message: 'x'.repeat(5000), kind: 'weird', stack: 'no', context: { a: { b: 1 }, ok: 'yes' } })!;
    assert.equal(r.name, 'Error');
    assert.equal(r.message.length, 600);
    assert.equal(r.kind, 'error');
    assert.deepEqual(r.stack, []);
    assert.deepEqual(r.context, { ok: 'yes' });
    assert.equal(r.mode, 'dev');
  });
});

describe('the crash index', () => {
  it('lists documents newest first', () => {
    const doc = (id: string, last: string) => parseReportDoc(`---\nid: ${id}\nfingerprint: ${id.toLowerCase()}\nname: TypeError\nmessage: "m | pipe"\nlocation: src/a.ts:1:1\noccurrences: 2\nlastSeen: ${last}\n---\nbody`);
    const md = renderErrorsIndex([doc('LER-AAAAAA', '2026-10-01T00:00:00Z'), doc('LER-BBBBBB', '2026-10-09T00:00:00Z')]);
    assert.ok(md.indexOf('LER-BBBBBB') < md.indexOf('LER-AAAAAA'));
    assert.ok(md.includes('m \\| pipe'));
    assert.match(renderErrorsIndex([]), /No crashes recorded/);
  });
});

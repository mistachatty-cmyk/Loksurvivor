import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classify, createReporter, parseComponentStack, fingerprintOf, isBenign, normalizeMessage, parseStack, redact, reportIdOf, topAppFrame, type ErrorReport, type ReportSink } from './index';
import { defaultStrings } from './react/strings';

const CHROME = `TypeError: Cannot read properties of undefined (reading 'hp')
    at damageEnemy (http://localhost:3000/src/game/engine/world.ts?t=1730:3659:21)
    at stepWorld (http://localhost:3000/src/game/engine/world.ts?t=1730:11593:5)
    at async frame (http://localhost:3000/src/game/RunScreen.tsx:932:11)
    at http://localhost:3000/node_modules/.vite/deps/react-dom_client.js?v=ab12:120:7`;
const FIREFOX = `damageEnemy@http://localhost:3000/src/game/engine/world.ts?t=1730:3659:21
stepWorld@http://localhost:3000/src/game/engine/world.ts:11593:5
@http://localhost:3000/node_modules/.vite/deps/react-dom_client.js?v=ab12:120:7`;

const base = {
  appKey: 'test-app', appVersion: '1.2.3', buildId: 'b1', mode: 'dev' as const,
  path: () => '/play?token=abc123',
  userAgent: () => 'TestAgent/1.0',
};

describe('stack parsing', () => {
  it('reads Chrome frames, strips origin and query, and tells app code from libraries', () => {
    const frames = parseStack(CHROME);
    assert.equal(frames.length, 4);
    assert.deepEqual([frames[0]!.fn, frames[0]!.file, frames[0]!.line, frames[0]!.col], ['damageEnemy', '/src/game/engine/world.ts', 3659, 21]);
    assert.equal(frames[2]!.fn, 'frame');
    assert.equal(frames[0]!.app, true);
    assert.equal(frames[3]!.app, false, 'node_modules/.vite deps are not app code');
    assert.equal(topAppFrame(frames)!.fn, 'damageEnemy');
  });

  it('reads Firefox and Safari style frames', () => {
    const frames = parseStack(FIREFOX);
    assert.equal(frames.length, 3);
    assert.equal(frames[1]!.line, 11593);
    assert.equal(frames[2]!.fn, undefined);
  });

  it('survives junk and empty input', () => {
    assert.deepEqual(parseStack(undefined), []);
    assert.deepEqual(parseStack('nothing here\n\n   at'), []);
    assert.ok(parseStack('x'.repeat(100_000)).length === 0);
  });
});

describe('fingerprints and redaction', () => {
  it('stays the same when numbers, ids and line numbers move, and changes when the crash really differs', () => {
    const a = fingerprintOf('TypeError', "Cannot read 'hp' of enemy 123", parseStack(CHROME));
    const moved = CHROME.replace('3659:21', '3702:21').replace('11593', '11600');
    const b = fingerprintOf('TypeError', "Cannot read 'hp' of enemy 98765", parseStack(moved));
    assert.equal(a, b);
    assert.notEqual(a, fingerprintOf('RangeError', "Cannot read 'hp' of enemy 123", parseStack(CHROME)));
    assert.notEqual(a, fingerprintOf('TypeError', "Cannot read 'hp' of enemy 123", parseStack(FIREFOX.replace('damageEnemy', 'killEnemy'))));
    assert.match(a, /^[a-f0-9]{16}$/);
    assert.equal(reportIdOf(a), `LER-${a.slice(0, 6).toUpperCase()}`);
    assert.equal(normalizeMessage('failed at 0xdeadbeef after 42 tries'), 'failed at # after # tries');
  });

  it('scrubs emails, tokens, keys, query strings and opaque blobs', () => {
    const text = 'user a.b@example.com sent Bearer abcdefgh12345678 to https://x.io/api?token=secret&u=1 key sb_abcdefghijklmnop1234 jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY.abcdEFGH and apikey=hunter2hunter2 blob ' + 'A'.repeat(60);
    const out = redact(text);
    for (const secret of ['a.b@example.com', 'abcdefgh12345678', 'token=secret', 'sb_abcdefghijklmnop1234', 'eyJhbGciOiJIUzI1', 'hunter2hunter2', 'A'.repeat(60)]) assert.ok(!out.includes(secret), `leaked ${secret}`);
    assert.ok(out.includes('https://x.io/api?[query]'));
    assert.ok(redact('x'.repeat(2000), 100).length <= 100);
  });
});

describe('component stacks', () => {
  it('drop the origin and query so they read like paths', () => {
    const lines = parseComponentStack('\n    at Hub (http://localhost:3000/src/ui/Hub.tsx?t=17:7:29)\n    at App (http://localhost:3000/src/App.tsx:5:1)');
    assert.deepEqual(lines, ['Hub (/src/ui/Hub.tsx:7:29)', 'App (/src/App.tsx:5:1)']);
  });
});

describe('classification', () => {
  it('buckets errors into plain-language categories', () => {
    assert.equal(classify('render', 'TypeError', 'x is undefined', true), 'render');
    assert.equal(classify('error', 'TypeError', 'Failed to fetch', false), 'network');
    assert.equal(classify('error', 'TypeError', 'fetch is not a function', false), 'script');
    assert.equal(classify('error', 'QuotaExceededError', 'The quota has been exceeded for localStorage', false), 'storage');
    assert.equal(classify('error', 'RangeError', 'Array buffer allocation failed', false), 'memory');
    assert.equal(classify('resource', 'Error', 'Failed to load <img>', false), 'resource');
    assert.equal(classify('error', 'ReferenceError', 'foo is not defined', false), 'script');
    assert.ok(isBenign('ResizeObserver loop completed with undelivered notifications.'));
    assert.ok(!isBenign('TypeError: x'));
  });
});

function reporterWith(over: Partial<Parameters<typeof createReporter>[0]> = {}) {
  let t = 1_000_000;
  const sent: ErrorReport[] = [];
  const sink: ReportSink = { id: 'test', send: (r) => { sent.push({ ...r }); } };
  const reporter = createReporter({ ...base, enabled: () => true, sinks: [sink], now: () => t, ...over });
  return { reporter, sent, tick: (ms: number) => { t += ms; } };
}

function crash(message: string, stack = CHROME): Error {
  const e = new TypeError(message);
  e.stack = `TypeError: ${message}\n${stack.split('\n').slice(1).join('\n')}`;
  return e;
}

describe('reporter', () => {
  it('builds a safe report: redacted message, no query string in the path, context and breadcrumbs included', () => {
    const { reporter, sent } = reporterWith({ context: () => ({ screen: 'run', level: 4, who: 'me@example.com' }) });
    reporter.breadcrumb('nav', 'opened hub');
    const report = reporter.report({ error: crash('bad thing for me@example.com'), kind: 'error' })!;
    assert.equal(report.path, '/play');
    assert.ok(!report.message.includes('@example.com'));
    assert.equal(report.context.level, 4);
    assert.equal(report.context.who, '[email]');
    assert.equal(report.breadcrumbs[0]!.text, 'opened hub');
    assert.equal(report.severity, 'crash');
    assert.equal(sent.length, 1);
  });

  it('does nothing at all when switched off', () => {
    const { reporter, sent } = reporterWith({ enabled: () => false });
    assert.equal(reporter.report({ error: crash('x'), kind: 'error' }), null);
    assert.equal(sent.length, 0);
    assert.equal(reporter.getReports().length, 0);
  });

  it('counts repeats instead of re-reporting, and only re-sends at powers of two', () => {
    const { reporter, sent } = reporterWith();
    const events: boolean[] = [];
    reporter.subscribe((e) => events.push(e.fresh));
    for (let i = 0; i < 8; i += 1) reporter.report({ error: crash(`same ${i}`), kind: 'error' });
    assert.equal(reporter.getReports().length, 1);
    assert.equal(reporter.latest()!.count, 8);
    assert.deepEqual(events.filter(Boolean).length, 1);
    assert.deepEqual(sent.map((r) => r.count), [1, 2, 4, 8]);
  });

  it('rate limits a flood of different crashes, then lets them through again', () => {
    const { reporter, tick } = reporterWith({ maxPerMinute: 3 });
    const kinds = ['a', 'b', 'c', 'd', 'e'].map((n) => new Error(`${n}`));
    kinds.forEach((e, i) => { e.name = `Err${i}`; e.stack = `Err${i}: x\n    at fn${i} (http://h/src/f${i}.ts:1:1)`; });
    const results = kinds.map((e) => reporter.report({ error: e, kind: 'error' }));
    assert.equal(results.filter(Boolean).length, 3);
    tick(61_000);
    assert.ok(reporter.report({ error: kinds[4], kind: 'error' }));
  });

  it('ignores browser noise and never lets a sink or listener failure become a crash', async () => {
    const boom: ReportSink = { id: 'boom', send: () => { throw new Error('sink down'); } };
    const rejects: ReportSink = { id: 'rej', send: () => Promise.reject(new Error('later')) };
    const { reporter } = reporterWith({ sinks: [boom, rejects] });
    reporter.subscribe(() => { throw new Error('listener down'); });
    assert.equal(reporter.report({ error: new Error('ResizeObserver loop completed with undelivered notifications.'), kind: 'error' }), null);
    assert.ok(reporter.report({ error: crash('real'), kind: 'error' }));
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  it('lets a sink enrich the report with the original code location', async () => {
    const enriching: ReportSink = { id: 'dev', send: () => ({ source: { frames: [{ file: 'src/a.ts', line: 3, col: 4 }] } }) };
    const { reporter } = reporterWith({ sinks: [enriching] });
    let updates = 0;
    reporter.subscribe(() => { updates += 1; });
    const report = reporter.report({ error: crash('x'), kind: 'error' })!;
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(report.source!.frames[0]!.file, 'src/a.ts');
    assert.ok(updates >= 2, 'listeners hear about the enrichment');
  });

  it('wraps non-Error throws and string rejections', () => {
    const { reporter } = reporterWith();
    const a = reporter.report({ error: 'just a string', kind: 'rejection' })!;
    assert.equal(a.message, 'just a string');
    const b = reporter.report({ error: { code: 7 }, kind: 'rejection' })!;
    assert.match(b.message, /code/);
  });

  it('install hooks window errors and rejections and can be undone', () => {
    const { reporter } = reporterWith();
    const handlers = new Map<string, (event: unknown) => void>();
    const fakeConsole = { error: () => {} };
    const win = {
      addEventListener: (type: string, fn: (event: unknown) => void) => { handlers.set(type, fn); },
      removeEventListener: (type: string) => { handlers.delete(type); },
      console: fakeConsole,
    } as unknown as Window;
    const original = fakeConsole.error;
    const undo = reporter.install(win);
    handlers.get('error')!({ error: crash('thrown in a timer'), target: win });
    handlers.get('unhandledrejection')!({ reason: new Error('rejected') });
    handlers.get('error')!({ error: null, message: 'Script failed', filename: 'http://h/src/x.ts', lineno: 5, colno: 6, target: win });
    fakeConsole.error();
    assert.equal(reporter.getReports().length, 3);
    undo();
    assert.equal(handlers.size, 0);
    assert.equal(fakeConsole.error, original);
  });
});

describe('copy', () => {
  it('is kid-safe and never uses the banned naming word', () => {
    const BANNED = new RegExp('\\b(' + 'sig' + 'nal' + '\\w*|damn\\w*|hell|crap\\w*|shit\\w*|fuck\\w*|bitch\\w*|bastard\\w*|ass|piss\\w*|sex\\w*|kill\\w*|murder\\w*|blood\\w*|gore|drunk|drugs?|weed|beer|whiskey)\\b', 'i');
    const strings: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === 'string') strings.push(value);
      else if (typeof value === 'function') strings.push(String((value as (...a: never[]) => string)(...([3, 'x'] as never[]))));
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(defaultStrings);
    assert.ok(strings.length > 30);
    for (const s of strings) assert.ok(!BANNED.test(s), `banned word in: ${s}`);
  });
});

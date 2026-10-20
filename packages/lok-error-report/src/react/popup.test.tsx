import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ErrorReport } from '../types';
import { LokCrashPopup } from './LokCrashPopup';

const report = (over: Partial<ErrorReport> = {}): ErrorReport => ({
  id: 'LER-ABC123', fingerprint: 'a'.repeat(16), kind: 'render', category: 'render', severity: 'crash', name: 'TypeError', message: "Cannot read 'hp' of undefined",
  stack: [{ raw: 'x', fn: 'Hub', file: '/src/ui/Hub.tsx', line: 12, col: 5, app: true }], componentStack: ['Hub', 'App'],
  appKey: 'app', appVersion: '1.2.3', buildId: 'b9', mode: 'dev', at: 1, lastAt: 1, count: 3, path: '/', userAgent: 'x', context: {}, breadcrumbs: [], ...over,
});

const withSource = (): ErrorReport => report({ source: { frames: [{ file: 'src/ui/Hub.tsx', line: 12, col: 5, fn: 'Hub', snippet: { startLine: 11, lines: ['function Hub() {', '  return state.hp;', '}'], highlight: 1 } }] } });

describe('LokCrashPopup', () => {
  it('in dev shows the exact file, line, the code with the failing line marked, and the message', () => {
    const html = renderToStaticMarkup(<LokCrashPopup report={withSource()} onClose={() => {}} />);
    assert.match(html, /src\/ui\/Hub\.tsx:12:5/);
    assert.match(html, /return state\.hp;/);
    assert.match(html, /Cannot read &#x27;hp&#x27; of undefined/);
    assert.match(html, /The lights flickered/);
    assert.match(html, /LER-ABC123/);
    assert.match(html, /Happened 3 times/);
    assert.doesNotMatch(html, /doesn&#x27;t have access/);
  });

  it('in dev without a located source says so and shows the raw spot', () => {
    const html = renderToStaticMarkup(<LokCrashPopup report={report()} onClose={() => {}} />);
    assert.match(html, /\/src\/ui\/Hub\.tsx:12:5/);
    assert.match(html, /could not trace this back/);
  });

  it('in production says LOK has no access, and shows no message, stack or code', () => {
    const html = renderToStaticMarkup(<LokCrashPopup report={report({ mode: 'prod', source: withSource().source })} onClose={() => {}} />);
    assert.match(html, /LOK doesn&#x27;t have access to the code behind this one\./);
    assert.doesNotMatch(html, /Cannot read/);
    assert.doesNotMatch(html, /Hub\.tsx/);
    assert.doesNotMatch(html, /return state\.hp/);
    assert.match(html, /build b9/);
    assert.match(html, /Nothing leaves your device unless you press Send\./);
  });

  it('offers Try again only for a render crash, and Send only when sending is available', () => {
    const fatal = renderToStaticMarkup(<LokCrashPopup report={report()} fatal onRetry={() => {}} />);
    assert.match(fatal, /lok-crash-retry/);
    assert.doesNotMatch(fatal, /lok-crash-close/);
    assert.doesNotMatch(fatal, /lok-crash-send/);
    const closable = renderToStaticMarkup(<LokCrashPopup report={report()} onClose={() => {}} onSend={async () => {}} />);
    assert.match(closable, /lok-crash-close/);
    assert.match(closable, /lok-crash-send/);
    assert.doesNotMatch(closable, /lok-crash-retry/);
  });

  it('explains each category in plain language', () => {
    for (const category of ['render', 'script', 'network', 'storage', 'memory', 'resource', 'unknown'] as const) {
      const html = renderToStaticMarkup(<LokCrashPopup report={report({ category })} />);
      assert.match(html, /data-testid="lok-crash-category"/);
    }
  });
});

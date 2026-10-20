import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCiLog, relativize, renderCiReport } from './ci';

const CWD = '/home/runner/work/Loksurvivor/Loksurvivor';

describe('CI log parsing', () => {
  it('finds TypeScript errors with file, line and column', () => {
    const log = [
      'src/game/engine/world.ts(3659,21): error TS2339: Property \'hp\' does not exist on type \'never\'.',
      `${CWD}/artifacts/survivor-616/src/ui/Hub.tsx:12:5 - error TS2322: Type 'string' is not assignable to type 'number'.`,
    ].join('\n');
    const found = parseCiLog(log, CWD);
    assert.equal(found.length, 2);
    assert.deepEqual([found[0]!.tool, found[0]!.file, found[0]!.line, found[0]!.col, found[0]!.code], ['tsc', 'src/game/engine/world.ts', 3659, 21, 'TS2339']);
    assert.equal(found[1]!.file, 'artifacts/survivor-616/src/ui/Hub.tsx');
  });

  it('finds failing node:test cases with the first app frame of their stack', () => {
    const log = [
      'not ok 6 - stepWorld keeps the player alive',
      '  ---',
      "  error: 'expected 10 got 9'",
      '  stack: |-',
      '    TestContext.<anonymous> (file:///home/runner/work/Loksurvivor/Loksurvivor/artifacts/survivor-616/src/game/engine/world.test.ts:120:12)',
      '    node:internal/test_runner/test:1047:25',
    ].join('\n');
    const found = parseCiLog(log, CWD);
    assert.equal(found.length, 1);
    assert.equal(found[0]!.tool, 'node-test');
    assert.equal(found[0]!.file, 'artifacts/survivor-616/src/game/engine/world.test.ts');
    assert.equal(found[0]!.line, 120);
    assert.match(found[0]!.message, /stepWorld keeps the player alive: expected 10 got 9/);
  });

  it('notes build failures, and falls back to error lines when nothing is parseable', () => {
    assert.equal(parseCiLog('error during build:\nRollup failed to resolve import "x"')[0]!.tool, 'build');
    const other = parseCiLog('all fine\nsomething Failed badly\n');
    assert.equal(other[0]!.tool, 'other');
    assert.deepEqual(parseCiLog('all good'), []);
  });

  it('renders a report with a where table and the tail of the output', () => {
    const md = renderCiReport({ step: 'typecheck', exitCode: 2, findings: parseCiLog("a.ts(1,2): error TS1: bad | pipe"), tail: 'line1\nline2', run: 'https://x/run/1' });
    assert.match(md, /# CI crash: typecheck/);
    assert.match(md, /`a\.ts:1:2`/);
    assert.match(md, /bad \\\| pipe/);
    assert.match(md, /line2/);
    assert.equal(relativize('/elsewhere/x.ts', CWD), '/elsewhere/x.ts');
  });
});

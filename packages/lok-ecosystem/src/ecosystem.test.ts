import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { PLUGINS, SDK_SCHEMA_PATCH, appStatus, catalogJson, checkManifest, renderStatus, scaffoldApp, validAppName } from './index';
import { readManifests, repoRoot, sdkVersion } from '../scripts/_files';

const good = {
  schema: 'lok.universe.platform', schemaVersion: 1, appKey: 'demo_app', namespace: 'g6.demo-app', label: 'Demo', draws: ['sprite-rig'], publishes: [],
  lokErrorReport: { enabled: true, source: 'demo' }, lokChat: { enabled: true, source: 'demo', features: { scenes: false } }, sdkVersion: '1.2.0',
};

describe('checkManifest', () => {
  it('accepts a good manifest and every app in this repo', () => {
    assert.deepEqual(checkManifest(good), []);
    const root = repoRoot();
    const apps = readManifests(root);
    assert.ok(apps.length >= 1);
    for (const app of apps) assert.deepEqual(checkManifest(app.manifest), [], app.path);
  });

  it('explains what is wrong, in plain words', () => {
    const problems = checkManifest({ ...good, namespace: 'demo', sdkVersion: 'one', draws: ['3d'], extra: 1, lokChat: { enabled: 'yes', features: { nonsense: true, scenes: 'no' } }, lokErrorReport: { enabled: true } });
    const text = problems.join('\n');
    for (const piece of ['namespace must start with "g6."', 'sdkVersion must look like', 'unknown art kind "3d"', 'unknown key "extra"', 'lokChat.enabled must be true or false', 'lokChat.source is required', 'unknown feature "nonsense"', 'lokChat.features.scenes must be true or false', 'lokErrorReport.source is required']) {
      assert.ok(text.includes(piece), `missing: ${piece}\n${text}`);
    }
    assert.deepEqual(checkManifest('nope'), ['the manifest must be a JSON object']);
    assert.ok(checkManifest({ ...good, lokErrorReport: { enabled: true, source: 'x', features: {} } }).some((p) => p.includes('unknown key "features"')));
  });

  it('describes the SDK entries that need adding', () => {
    assert.match(SDK_SCHEMA_PATCH, /lokChat\?:/);
    assert.match(SDK_SCHEMA_PATCH, /lokErrorReport\?:/);
  });
});

describe('plugin catalog', () => {
  it('lists real folders, unique ids, and matches the generated JSON', () => {
    const root = repoRoot();
    assert.equal(new Set(PLUGINS.map((p) => p.id)).size, PLUGINS.length);
    for (const p of PLUGINS) {
      if (p.status !== 'planned') assert.ok(p.path && existsSync(join(root, p.path)), `${p.id}: ${p.path} is missing`);
      if (p.docs && !p.docs.startsWith('Lok-EcoSystsem')) assert.ok(existsSync(join(root, p.docs.replace(/#.*$/, ''))), `${p.id}: docs ${p.docs} missing`);
    }
    assert.equal(readFileSync(join(root, 'docs/lok-plugins.json'), 'utf8'), catalogJson(), 'run pnpm --filter @lok/ecosystem lok:catalog');
  });

  it('is described in the guide and uses no banned word', () => {
    const guide = readFileSync(join(repoRoot(), 'docs/LOK_ECOSYSTEM.md'), 'utf8');
    for (const p of PLUGINS) assert.ok(guide.includes(p.id), `docs/LOK_ECOSYSTEM.md does not mention ${p.id}`);
    assert.ok(!new RegExp(['sig', 'nal'].join(''), 'i').test(guide + catalogJson()));
  });
});

describe('status report', () => {
  it('shows which plugins each app has on and what is wrong', () => {
    const apps = [appStatus({ path: 'a', manifest: good }), appStatus({ path: 'b', manifest: { ...good, label: 'Old', sdkVersion: '1.0.0', lokChat: { enabled: false, source: 'x' } } }), appStatus({ path: 'c', manifest: {} })];
    const text = renderStatus(apps, '1.2.0');
    assert.match(text, /\| Demo \| `demo_app` \| 1\.2\.0 \| lokErrorReport, lokChat \(off: scenes\) \| ok \|/);
    assert.match(text, /1\.0\.0 \(latest 1\.2\.0\)/);
    assert.match(text, /## Problems/);
    assert.equal(sdkVersion(repoRoot()).split('.').length, 3);
  });
});

describe('starter kit', () => {
  const starterCast = readFileSync(join(repoRoot(), 'packages/lok-chat/examples/minimal-cast/cast.ts'), 'utf8');

  it('generates a valid manifest, wired plugins and a contract test', () => {
    const files = scaffoldApp({ name: 'harbor-quest', sdkVersion: '1.2.0', starterCast });
    assert.deepEqual(Object.keys(files).sort(), ['README.md', 'lok.universe.json', 'package.json', 'src/chat/cast.ts', 'src/chat/runtime.ts', 'src/errors.ts', 'src/starter.test.ts', 'tsconfig.json']);
    const manifest = JSON.parse(files['lok.universe.json']!);
    assert.deepEqual(checkManifest(manifest), []);
    assert.equal(manifest.appKey, 'harbor_quest');
    assert.equal(manifest.namespace, 'g6.harbor-quest');
    assert.match(files['src/chat/cast.ts']!, /from '@lok\/chat'/);
    assert.match(files['src/chat/cast.ts']!, /export const APP_CAST/);
    assert.ok(!files['src/chat/cast.ts']!.includes('LIGHTHOUSE'));
    assert.match(files['src/chat/runtime.ts']!, /harbor_quest\.lokchat\.v1/);
  });

  it('can leave plugins out, and refuses bad names', () => {
    const slim = scaffoldApp({ name: 'tiny', sdkVersion: '1.2.0', starterCast, chat: false, errorReport: false });
    assert.ok(!('src/chat/cast.ts' in slim) && !('src/errors.ts' in slim));
    assert.ok(!('lokChat' in JSON.parse(slim['lok.universe.json']!)));
    for (const bad of ['Bad Name', '../escape', 'a--b', '', '-x', 'x'.repeat(41)]) assert.equal(validAppName(bad), false, bad);
    assert.throws(() => scaffoldApp({ name: '../escape', sdkVersion: '1.2.0', starterCast }));
  });
});

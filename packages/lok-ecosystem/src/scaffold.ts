/**
 * The new-app starter kit: `scaffoldApp` returns the files of a minimal, headless LOK app that already uses
 * the plugins (LOK Chat with a starter cast, LokErrorReport) and ships its own tests, so a second app is a
 * copy-and-edit away. Pure (returns path -> text); `scripts/new-app.ts` writes it to `artifacts/<name>`.
 */
import { checkManifest } from './manifest';

export interface ScaffoldInput {
  /** kebab-case folder / package name, e.g. `harbor-quest`. */
  name: string;
  label?: string;
  sdkVersion: string;
  /** The text of `packages/lok-chat/examples/minimal-cast/cast.ts`, used as the starter cast. */
  starterCast: string;
  chat?: boolean;
  errorReport?: boolean;
}

export function validAppName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name) && name.length <= 40;
}

export function scaffoldApp(input: ScaffoldInput): Record<string, string> {
  if (!validAppName(input.name)) throw new Error(`"${input.name}" is not a valid app name: use lowercase words joined by hyphens`);
  const appKey = input.name.replace(/-/g, '_');
  const label = input.label ?? input.name.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
  const chat = input.chat !== false;
  const errorReport = input.errorReport !== false;

  const manifest: Record<string, unknown> = {
    schema: 'lok.universe.platform', schemaVersion: 1, appKey, namespace: `g6.${input.name}`, label,
    draws: [], publishes: [],
    ...(errorReport ? { lokErrorReport: { enabled: true, source: appKey } } : {}),
    ...(chat ? { lokChat: { enabled: true, source: appKey, features: {} } } : {}),
    sdkVersion: input.sdkVersion,
  };
  const problems = checkManifest(manifest);
  if (problems.length > 0) throw new Error(`generated manifest is invalid: ${problems.join('; ')}`);

  const files: Record<string, string> = {};
  files['lok.universe.json'] = JSON.stringify(manifest, null, 2) + '\n';
  files['package.json'] = JSON.stringify({
    name: `@workspace/${input.name}`, version: '0.1.0', private: true, type: 'module',
    scripts: { typecheck: 'tsc -p tsconfig.json --noEmit', test: 'node --import tsx --test "src/**/*.test.ts"' },
    dependencies: { ...(chat ? { '@lok/chat': 'workspace:*' } : {}), ...(errorReport ? { '@lok/error-report': 'workspace:*' } : {}) },
    devDependencies: { '@lok/ecosystem': 'workspace:*', '@types/node': '^25.3.3', tsx: '^4.23.13', typescript: '~5.9.3' },
  }, null, 2) + '\n';
  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: { target: 'ES2022', lib: ['DOM', 'DOM.Iterable', 'ES2022'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noUncheckedIndexedAccess: true, skipLibCheck: true, noEmit: true, isolatedModules: true, allowImportingTsExtensions: true, types: ['node'] },
    include: ['src'],
  }, null, 2) + '\n';

  if (chat) {
    files['src/chat/cast.ts'] = input.starterCast
      .replace("from '../../src'", "from '@lok/chat'")
      .replace(/LIGHTHOUSE_CAST/g, 'APP_CAST')
      .replace(/LIGHTHOUSE_PEOPLE/g, 'APP_PEOPLE')
      .replace('The smallest useful cast: three people in a lighthouse. It exists to prove `@lok/chat` has no\n * 616-specific assumptions, and as a copy-paste starting point for a new app (docs/LOK_CHAT.md).', `Your app's cast: replace these three lighthouse people with your own (docs/LOK_CHAT.md).`);
    files['src/chat/runtime.ts'] = `/** The chat runtime for this app: the shared engine bound to your cast, with device-local saves. */
import { createChatActions, createChatEngine, createChatStore, mergeFeatures, type FeatureFlags } from '@lok/chat';

import manifest from '../../lok.universe.json';
import { APP_CAST } from './cast';

const manifestFlags = (): FeatureFlags => {
  const block = (manifest as { lokChat?: { enabled?: boolean; features?: FeatureFlags } }).lokChat;
  return { ...(block?.features ?? {}), ...(block?.enabled === false ? { chat: false } : {}) };
};

/** Add the player's own choices here (a Settings section that writes localStorage) when you build one. */
export const features = (): FeatureFlags => mergeFeatures(manifestFlags(), {});

export const chatEngine = createChatEngine(APP_CAST, { features });
export const chatStore = createChatStore({ key: '${appKey}.lokchat.v1' });
export const chatActions = createChatActions({ engine: chatEngine, store: chatStore, features });
`;
  }
  if (errorReport) {
    files['src/errors.ts'] = `/** Crash capture for this app. Reports stay on the device until the player chooses to send one. */
import { createReporter } from '@lok/error-report';
import { localSink } from '@lok/error-report/sinks';

export const crashLog = localSink('${appKey}.crashlog.v1', 25);

export const reporter = createReporter({
  appKey: '${appKey}',
  appVersion: '0.1.0',
  mode: (import.meta as { env?: { DEV?: boolean } }).env?.DEV ? 'dev' : 'prod',
  enabled: () => true,
  sinks: [crashLog],
});
`;
  }
  files['src/starter.test.ts'] = `import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkManifest } from '@lok/ecosystem';
${chat ? "import { runTranscript, validateCast } from '@lok/chat';\n\nimport { APP_CAST, APP_PEOPLE } from './chat/cast';\nimport { chatEngine } from './chat/runtime';" : ''}
import manifest from '../lok.universe.json';

describe('${label} follows the LOK ecosystem contract', () => {
  it('has a valid manifest', () => {
    assert.deepEqual(checkManifest(manifest), []);
  });
${chat ? `
  it('has a cast that passes the shared safety gate', () => {
    assert.deepEqual(validateCast(APP_CAST, { minTopicsPerPerson: 1 }), []);
  });

  it('holds a scripted conversation without giving up', () => {
    for (const person of APP_PEOPLE) {
      const stats = runTranscript(chatEngine, person, APP_PEOPLE.filter((p) => p.id !== person.id), { tone: 'family', affinity: 15, seed: 3 });
      assert.ok(stats.fallbackRate <= 0.3, \`\${person.id}: \${stats.fallbackRate}\`);
    }
  });` : ''}
});
`;
  files['README.md'] = `# ${label}

Generated by \`pnpm lok:new-app ${input.name}\` (packages/lok-ecosystem). A headless starter: the LOK ecosystem
contract is wired and tested; add your game or app UI on top.

- \`lok.universe.json\` is your manifest. Check it any time with \`pnpm lok:check\`.
${chat ? "- `src/chat/cast.ts` is your cast (replace the three lighthouse people). `src/chat/runtime.ts` binds `@lok/chat` to it.\n" : ''}${errorReport ? "- `src/errors.ts` sets up crash capture (`@lok/error-report`).\n" : ''}- \`pnpm --filter @workspace/${input.name} test\` runs the contract tests.

Plugin catalog and conventions: \`docs/LOK_ECOSYSTEM.md\`.
`;
  return files;
}

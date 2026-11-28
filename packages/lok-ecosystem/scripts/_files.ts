import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { AppManifest } from '../src/status';

/** The repo root, found by walking up to the folder that holds pnpm-workspace.yaml. */
export function repoRoot(): string {
  let dir = resolve(import.meta.dirname);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('could not find the repo root (pnpm-workspace.yaml)');
}

/** Every `artifacts/*\/lok.universe.json`, parsed; an unreadable file is reported as `null` so the checker can complain. */
export function readManifests(root: string): AppManifest[] {
  const dir = join(root, 'artifacts');
  const found: AppManifest[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const file = join(dir, name, 'lok.universe.json');
    if (!existsSync(file)) continue;
    let manifest: unknown = null;
    try { manifest = JSON.parse(readFileSync(file, 'utf8')); } catch { /* reported by checkManifest as not an object */ }
    found.push({ path: `artifacts/${name}/lok.universe.json`, manifest });
  }
  return found;
}

export function sdkVersion(root: string): string {
  const text = readFileSync(join(root, 'lib/lok-universe/src/types.ts'), 'utf8');
  return /SDK_VERSION = "([^"]+)"/.exec(text)?.[1] ?? '?';
}

/**
 * `checkManifest`: validates an app's `lok.universe.json`. The vendored SDK owns the base shape
 * (`PlatformManifest`); newer plugin blocks (`lokErrorReport`, `lokChat`) are checked here until the SDK
 * carries them (`SDK_SCHEMA_PATCH` says what to add). Returns readable problems; empty means fine.
 */
import { CHAT_FEATURES } from '@lok/chat';

const ART_KINDS = ['sprite-rig', 'lokpet-silhouette', 'pixel-grid'];
const KNOWN_KEYS = ['schema', 'schemaVersion', 'appKey', 'namespace', 'label', 'draws', 'publishes', 'publicLore', 'supporterBar', 'walletStrip', 'lokErrorReport', 'lokChat', 'sdkVersion'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function checkManifest(manifest: unknown): string[] {
  const problems: string[] = [];
  if (!isObject(manifest)) return ['the manifest must be a JSON object'];
  const bad = (msg: string): void => { problems.push(msg); };

  if (manifest.schema !== 'lok.universe.platform') bad('schema must be "lok.universe.platform"');
  if (manifest.schemaVersion !== 1) bad('schemaVersion must be 1');
  if (!isString(manifest.appKey) || !/^[a-z][a-z0-9_]*$/.test(String(manifest.appKey))) bad('appKey must be lowercase letters, digits and underscores');
  if (!isString(manifest.namespace) || !String(manifest.namespace).startsWith('g6.')) bad('namespace must start with "g6."');
  if (!isString(manifest.label)) bad('label is required');
  if (!isString(manifest.sdkVersion) || !/^\d+\.\d+\.\d+$/.test(String(manifest.sdkVersion))) bad('sdkVersion must look like 1.2.0');
  for (const key of ['draws', 'publishes'] as const) {
    const list = manifest[key];
    if (!Array.isArray(list)) bad(`${key} must be a list`);
    else for (const kind of list) if (!ART_KINDS.includes(String(kind))) bad(`${key}: unknown art kind "${String(kind)}"`);
  }
  for (const key of Object.keys(manifest)) if (!KNOWN_KEYS.includes(key)) bad(`unknown key "${key}" (add it to the SDK schema first, see SDK_SCHEMA_PATCH)`);

  const pl = manifest.publicLore;
  if (pl !== undefined && pl !== null && !(isObject(pl) && isString(pl.script) && isString(pl.hubKey))) bad('publicLore needs { script, hubKey }');
  const bar = manifest.supporterBar;
  if (bar !== undefined && !(isObject(bar) && Array.isArray(bar.mount) && bar.mount.every((m) => m === 'shell' || m === 'shop'))) bad('supporterBar.mount must list "shell" and/or "shop"');
  const wallet = manifest.walletStrip;
  if (wallet !== undefined && !(isObject(wallet) && Array.isArray(wallet.mount) && wallet.mount.every((m) => m === 'shop'))) bad('walletStrip.mount must list "shop"');

  for (const block of ['lokErrorReport', 'lokChat'] as const) {
    const value = manifest[block];
    if (value === undefined) continue;
    if (!isObject(value)) { bad(`${block} must be an object`); continue; }
    if (typeof value.enabled !== 'boolean') bad(`${block}.enabled must be true or false`);
    if (!isString(value.source)) bad(`${block}.source is required (the app's feedback source id)`);
    for (const key of Object.keys(value)) if (!['enabled', 'source', 'features'].includes(key) || (block === 'lokErrorReport' && key === 'features')) bad(`${block}: unknown key "${key}"`);
  }
  const features = isObject(manifest.lokChat) ? manifest.lokChat.features : undefined;
  if (features !== undefined) {
    if (!isObject(features)) bad('lokChat.features must be an object of true/false switches');
    else for (const [name, value] of Object.entries(features)) {
      if (!(CHAT_FEATURES as readonly string[]).includes(name)) bad(`lokChat.features: unknown feature "${name}" (known: ${CHAT_FEATURES.join(', ')})`);
      else if (typeof value !== 'boolean') bad(`lokChat.features.${name} must be true or false`);
    }
  }
  return problems;
}

/** What `Lok-EcoSystsem/universe-sdk` needs so these blocks are part of `PlatformManifest` (we never edit the vendored copy). */
export const SDK_SCHEMA_PATCH = `// Add to PlatformManifest in universe-sdk/src/types.ts, then run sync-sdk.sh in every platform.
/** LokErrorReport (packages/lok-error-report): crash capture and the themed pop-up. */
lokErrorReport?: { enabled: boolean; source: string };
/** LOK Chat (packages/lok-chat): per-feature switches, unset means on. */
lokChat?: { enabled: boolean; source: string; features?: Partial<Record<"chat" | "depth" | "questionsBack" | "twoBubbles" | "proactive" | "memory" | "strip" | "scenes" | "group" | "moods" | "presence" | "reactions", boolean>> };
`;

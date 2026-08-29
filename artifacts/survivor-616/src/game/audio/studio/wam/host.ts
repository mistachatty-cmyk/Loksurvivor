/**
 * WebAudioModules (WAM v2) plugin host.
 *
 * WAM is the browser's equivalent of VST: a plugin is WASM DSP plus a GUI
 * element, and it exposes a plain `AudioNode`. Because the track chain routes
 * everything through `TrackGraph.rewire()` and connects with `Tone.connect`,
 * a plugin drops into an insert slot with no change to playback code -- which
 * is what that indirection was for.
 *
 * ## Why this is opt-in, and stays opt-in
 *
 * Everything else in this app is local: the soundtrack plays the player's own
 * files, imported stems are decoded in the browser, nothing is uploaded. A
 * plugin breaks that shape, because loading one means **fetching and executing
 * code from another origin**, with whatever that code can reach.
 *
 * So: nothing is bundled, nothing loads at startup, and no plugin URL ships as
 * a default. A plugin is loaded only when the player asks for one by URL, and
 * the UI says plainly what that means. The SDK itself is also fetched on
 * demand rather than added to `package.json`, so a player who never opens this
 * feature never downloads a byte of it.
 *
 * This module is deliberately the whole blast radius: if plugin support is
 * ever removed, nothing else in the studio changes.
 */

import * as Tone from 'tone';

/** Pinned rather than floating: `@latest` would silently change what executes. */
const WAM_SDK_URL = 'https://www.unpkg.com/@webaudiomodules/sdk@2.0.0-alpha.6/dist/index.js';

export interface LoadedPlugin {
  /** Stable id for the insert slot holding this plugin. */
  id: string;
  name: string;
  /** Where it came from, shown in the UI so the source is never hidden. */
  url: string;
  /** The plugin's audio node, ready to sit in an insert slot. */
  node: AudioNode;
  /** Its GUI element, to be mounted in a dialog. Null when it ships none. */
  gui: HTMLElement | null;
  destroy(): Promise<void>;
}

/** Minimal shape of the SDK surface actually used here. */
interface WamSdk {
  initializeWamHost(context: BaseAudioContext): Promise<[string]>;
}

interface WamDescriptor {
  name?: string;
  vendor?: string;
}

interface WamInstance {
  audioNode: AudioNode & { destroy?: () => void };
  descriptor?: WamDescriptor;
  createGui?: () => Promise<HTMLElement>;
  destroyGui?: (gui: HTMLElement) => void;
}

interface WamModule {
  createInstance(hostGroupId: string, context: BaseAudioContext): Promise<WamInstance>;
  descriptor?: WamDescriptor;
}

export class PluginError extends Error {}

let hostGroupId: string | null = null;
let sdkPromise: Promise<WamSdk> | null = null;

/** Whether plugin support has been initialised in this session. */
export function pluginHostReady(): boolean {
  return hostGroupId !== null;
}

/**
 * Fetches the SDK and registers this app as a WAM host.
 *
 * Deferred until the first plugin load rather than done at startup: this is
 * the network request that takes the studio off-device, and it should happen
 * because the player asked for it, not because they opened a screen.
 */
async function ensureHost(context: BaseAudioContext): Promise<string> {
  if (hostGroupId) return hostGroupId;

  sdkPromise ??= import(/* @vite-ignore */ WAM_SDK_URL) as Promise<WamSdk>;
  let sdk: WamSdk;
  try {
    sdk = await sdkPromise;
  } catch {
    // Reset so a later attempt can retry rather than being stuck on a failure
    // that was only ever a dropped connection.
    sdkPromise = null;
    throw new PluginError('Could not reach the plugin runtime. Check your connection and try again.');
  }

  try {
    const [groupId] = await sdk.initializeWamHost(context);
    hostGroupId = groupId;
    return groupId;
  } catch {
    throw new PluginError('This browser could not start the plugin runtime.');
  }
}

/**
 * Loads one plugin from its module URL.
 *
 * The URL is the player's, and it is executed -- there is no sandbox that would
 * make an arbitrary plugin safe while still letting it process audio. The
 * honest handling is to be explicit about that at the point of asking, which
 * the UI does, rather than to imply a safety this cannot provide.
 */
export async function loadPlugin(url: string, context?: BaseAudioContext): Promise<LoadedPlugin> {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PluginError('That is not a valid plugin URL.');
  }
  // A plugin served over http: would be modifiable in transit by anything
  // between here and the origin, on a page that then executes it.
  if (parsed.protocol !== 'https:') {
    throw new PluginError('Plugins must be served over https.');
  }

  const audioContext = context ?? (Tone.getContext().rawContext as unknown as BaseAudioContext);
  const groupId = await ensureHost(audioContext);

  let module: { default: WamModule };
  try {
    module = (await import(/* @vite-ignore */ trimmed)) as { default: WamModule };
  } catch {
    throw new PluginError(`Could not load a plugin from ${parsed.host}.`);
  }

  const factory = module.default;
  if (!factory || typeof factory.createInstance !== 'function') {
    throw new PluginError('That URL did not point at a Web Audio Module.');
  }

  let instance: WamInstance;
  try {
    instance = await factory.createInstance(groupId, audioContext);
  } catch {
    throw new PluginError('The plugin failed to start.');
  }

  // A plugin without a GUI is still perfectly usable through its audio node,
  // so a failed GUI must not fail the load.
  let gui: HTMLElement | null = null;
  try {
    gui = (await instance.createGui?.()) ?? null;
  } catch {
    gui = null;
  }

  const name = instance.descriptor?.name ?? factory.descriptor?.name ?? parsed.hostname;

  return {
    id: `wam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    url: trimmed,
    node: instance.audioNode,
    gui,
    async destroy() {
      try {
        if (gui) instance.destroyGui?.(gui);
        instance.audioNode.disconnect();
        instance.audioNode.destroy?.();
      } catch {
        // A plugin that throws on teardown must not strand the track it was on.
      }
    },
  };
}

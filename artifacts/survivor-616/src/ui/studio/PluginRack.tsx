/**
 * Plugin slots for one track.
 *
 * The interface is deliberately blunt about what it does. Everything else in
 * this app runs on the player's own files and never leaves the device; loading
 * a plugin fetches and runs code from somewhere else, and the only honest way
 * to offer that is to say so where the URL is typed rather than to bury it.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plug, X } from 'lucide-react';

import { loadPlugin, PluginError, type LoadedPlugin } from '@/game/audio/studio/wam/host';
import type { TrackGraph } from '@/game/audio/studio/tracks';

export interface PluginRackProps {
  trackId: string;
  trackName: string;
  graph: TrackGraph;
}

export function PluginRack({ trackId, trackName, graph }: PluginRackProps) {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openGuiId, setOpenGuiId] = useState<string | null>(null);
  const guiHostRef = useRef<HTMLDivElement>(null);

  // Mount the plugin's own element rather than rendering it: the GUI belongs to
  // the plugin, and React must not try to reconcile a subtree it does not own.
  useEffect(() => {
    const host = guiHostRef.current;
    const plugin = plugins.find((candidate) => candidate.id === openGuiId);
    if (!host || !plugin?.gui) return;
    host.appendChild(plugin.gui);
    return () => {
      if (plugin.gui?.parentNode === host) host.removeChild(plugin.gui);
    };
  }, [openGuiId, plugins]);

  // Tear every plugin down with the track, or its worklet outlives the graph.
  useEffect(() => {
    return () => {
      for (const plugin of plugins) {
        graph.removeInsert(trackId, plugin.node);
        void plugin.destroy();
      }
    };
    // Intentionally track-scoped: this runs when the rack goes away, and
    // `plugins` is read through the closure at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const add = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const plugin = await loadPlugin(url);
      graph.addInsert(trackId, plugin.node);
      setPlugins((current) => [...current, plugin]);
      setUrl('');
    } catch (cause) {
      setError(cause instanceof PluginError ? cause.message : 'That plugin could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const remove = (plugin: LoadedPlugin) => {
    graph.removeInsert(trackId, plugin.node);
    void plugin.destroy();
    setPlugins((current) => current.filter((candidate) => candidate.id !== plugin.id));
    if (openGuiId === plugin.id) setOpenGuiId(null);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Plug className="h-3 w-3" /> Plugins
      </span>

      {plugins.map((plugin) => (
        <div key={plugin.id} className="border border-border/60 bg-background/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpenGuiId(openGuiId === plugin.id ? null : plugin.id)}
              disabled={!plugin.gui}
              className="min-w-0 flex-1 truncate text-left text-[10px] font-bold uppercase tracking-widest text-primary disabled:text-muted-foreground"
              title={plugin.url}
            >
              {plugin.name}
            </button>
            <button
              type="button"
              onClick={() => remove(plugin)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label={`Remove ${plugin.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {openGuiId === plugin.id && <div ref={guiHostRef} className="mt-2 overflow-auto" />}
        </div>
      ))}

      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void add();
        }}
        placeholder="https://…/plugin.js"
        aria-label={`Plugin URL for ${trackName}`}
        className="border border-border bg-background px-2 py-1 text-[10px] text-white"
        data-testid={`input-plugin-${trackId}`}
      />
      <button
        type="button"
        onClick={() => void add()}
        disabled={loading || url.trim() === ''}
        className="border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-white disabled:opacity-40"
        data-testid={`button-plugin-load-${trackId}`}
      >
        {loading ? 'Loading…' : 'Load plugin'}
      </button>

      <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
        <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-destructive/80" />
        <span>
          Runs code from the address you give it. Everything else in 616 stays on your device; a
          plugin does not. Only load one you trust.
        </span>
      </p>

      {error && (
        <p className="text-[10px] text-destructive" data-testid={`text-plugin-error-${trackId}`}>
          {error}
        </p>
      )}
    </div>
  );
}

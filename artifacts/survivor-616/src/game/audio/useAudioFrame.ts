/**
 * React access to the beat bus, for UI only.
 *
 * The bus publishes ~60 times a second. Re-rendering the tree that often is
 * wasteful for panels and meters, so this samples on an interval instead. The
 * run loop does not use this -- it polls `beatBus.read()` directly inside its
 * own animation frame.
 */

import { useEffect, useState } from 'react';
import { beatBus, type AudioFrame } from './beatBus';

/** ~15 Hz. Fast enough that a meter looks live, slow enough to be free. */
const DEFAULT_INTERVAL_MS = 66;

export function useAudioFrame(intervalMs: number = DEFAULT_INTERVAL_MS): AudioFrame {
  const [frame, setFrame] = useState<AudioFrame>(() => beatBus.read());

  useEffect(() => {
    const id = window.setInterval(() => setFrame(beatBus.read()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return frame;
}

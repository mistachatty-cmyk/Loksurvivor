/**
 * React access to gameplay SFX playback. Lazily builds an `SfxEngine` bound
 * to the app's one shared `AudioContext` (via `useMusicPlayer().
 * ensureAudioContext()`, never a context of its own) the first time
 * something actually plays, so mounting this hook never forces an
 * `AudioContext` into existence on its own.
 */

import { useEffect, useRef } from 'react';
import { useMusicPlayer } from './musicPlayer';
import { createSfxEngine, type SfxEngine } from './sfxEngine';
import type { SfxCueId, SfxStyleDef } from './sfxCues';

export interface SfxPlayer {
  /** `styleOverride` lets a caller preview a pack other than the equipped one (see `SoundBoothPanel`). */
  play(cueId: SfxCueId, onBeat?: boolean, styleOverride?: SfxStyleDef): void;
}

export function useSfxPlayer(style: SfxStyleDef, enabled: boolean): SfxPlayer {
  const music = useMusicPlayer();
  const engineRef = useRef<SfxEngine | null>(null);
  const styleRef = useRef(style);
  styleRef.current = style;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    engineRef.current?.setEnabled(enabled);
  }, [enabled]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const playerRef = useRef<SfxPlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = {
      play(cueId, onBeat = false, styleOverride) {
        if (!engineRef.current) {
          engineRef.current = createSfxEngine(music.ensureAudioContext());
          engineRef.current.setEnabled(enabledRef.current);
        }
        engineRef.current.play(cueId, styleOverride ?? styleRef.current, onBeat);
      },
    };
  }
  return playerRef.current;
}

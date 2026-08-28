/**
 * Playable pads.
 *
 * This is the one component in the studio where React is deliberately kept out
 * of the hot path. A note is triggered synchronously inside `pointerdown`, and
 * the pad lights up by writing to its own style. Routing either through state
 * costs at least a frame, and a frame of jitter is plainly audible as sloppy
 * timing -- it is the difference between an instrument and a web page that
 * makes noise.
 *
 * Multi-touch is tracked by `pointerId`, so chords and glides work on a phone
 * rather than the second finger stealing the first one's note.
 */

import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import {
  DEFAULT_INSTRUMENT_ID,
  findInstrument,
  INSTRUMENTS,
  triggerInstrument,
  type InstrumentDef,
} from '@/game/audio/studio/instruments';
import { setLiveLatencyMode, unlockStudioAudio } from '@/game/audio/studio/engine';

/**
 * Pointer capture is a convenience -- it keeps a drag reporting to the element
 * it started on. The browser rejects it for a pointer it no longer considers
 * active, and an uncaught throw inside a pointer handler takes the whole
 * interaction down, so failing to capture must degrade rather than break.
 */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Without capture a drag that leaves the element simply stops tracking.
  }
}

function releasePointer(element: Element, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Already released, or the pointer is gone -- nothing to undo.
  }
}

export interface PadGridProps {
  /** Where the instrument's output goes -- normally the studio master. */
  destination: Tone.ToneAudioNode;
}

export function PadGrid({ destination }: PadGridProps) {
  const [instrumentId, setInstrumentId] = useState(DEFAULT_INSTRUMENT_ID);
  const instrument: InstrumentDef = findInstrument(instrumentId);

  const voiceRef = useRef<ReturnType<InstrumentDef['create']> | null>(null);
  const padRefs = useRef(new Map<number, HTMLButtonElement>());
  /** Which pad each active pointer is holding, for multi-touch. */
  const heldRef = useRef(new Map<number, number>());
  const unlockedRef = useRef(false);

  // Rebuild the voice when the instrument changes, and dispose the old one --
  // an orphaned PolySynth keeps its oscillators running.
  useEffect(() => {
    const voice = instrument.create();
    voice.connect(destination);
    voiceRef.current = voice;
    // Pads are played live, so trade scheduling headroom for responsiveness.
    setLiveLatencyMode(true);
    return () => {
      setLiveLatencyMode(false);
      voice.disconnect();
      voice.dispose();
      voiceRef.current = null;
    };
  }, [instrument, destination]);

  const light = (index: number, on: boolean) => {
    const pad = padRefs.current.get(index);
    if (!pad) return;
    pad.style.transform = on ? 'scale(0.94)' : '';
    pad.style.borderColor = on ? 'hsl(var(--primary))' : '';
    pad.style.background = on ? 'hsl(var(--primary) / 0.35)' : '';
  };

  const press = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    const voice = voiceRef.current;
    if (!voice) return;
    event.preventDefault();
    heldRef.current.set(event.pointerId, index);
    light(index, true);
    capturePointer(event.currentTarget, event.pointerId);
    const note = instrument.notes[index]!;

    // A pad can be the first thing touched on the screen, and until a gesture
    // unlocks the context nothing sounds. Unlocking is async, so the very first
    // press waits for it and every press after goes straight through -- paying
    // a promise tick on every note would put the jitter back.
    if (!unlockedRef.current) {
      void unlockStudioAudio().then(() => {
        unlockedRef.current = true;
        triggerInstrument(voice, note, '8n', Tone.now());
      });
      return;
    }
    // Tone.now() rather than a scheduled time: the player already pressed it.
    triggerInstrument(voice, note, '8n', Tone.now());
  };

  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    const index = heldRef.current.get(event.pointerId);
    if (index === undefined) return;
    heldRef.current.delete(event.pointerId);
    light(index, false);
    releasePointer(event.currentTarget, event.pointerId);
  };

  const labels = instrument.padLabels ?? instrument.notes;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Play</h2>
        <div className="flex flex-wrap gap-2" data-testid="list-studio-instruments">
          {INSTRUMENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setInstrumentId(option.id)}
              className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                option.id === instrumentId
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-white'
              }`}
              data-testid={`button-instrument-${option.id}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{instrument.blurb}</p>

      <div
        className="grid grid-cols-4 gap-2 sm:grid-cols-8"
        // Without this the browser treats a pad press as the start of a scroll
        // and swallows it.
        style={{ touchAction: 'none' }}
        data-testid="grid-studio-pads"
      >
        {labels.map((label, index) => (
          <button
            key={`${label}-${index}`}
            ref={(element) => {
              if (element) padRefs.current.set(index, element);
              else padRefs.current.delete(index);
            }}
            type="button"
            className="aspect-square border border-border bg-card/60 text-[10px] font-bold uppercase tracking-wider text-white transition-[background-color,border-color] hover:border-primary/60"
            style={{ touchAction: 'none' }}
            onPointerDown={(event) => press(event, index)}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            data-testid={`pad-${index}`}
            aria-label={`Play ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

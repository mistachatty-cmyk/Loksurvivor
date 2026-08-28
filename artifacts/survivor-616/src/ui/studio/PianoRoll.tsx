/**
 * Note editing for an instrument track.
 *
 * Canvas2D and the same interaction model as `ArrangeView`: drag to move,
 * click empty space to add, click a note to select. Sharing the model matters
 * more than sharing code -- someone who has moved a clip already knows how to
 * move a note.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { StudioNote, StudioTrack } from '@/game/audio/studio/project';

/** Two octaves is what fits on a phone and covers a part; scroll is the escape. */
const LOW_PITCH = 48; // C3
const PITCH_COUNT = 25;
const ROW_HEIGHT = 13;
const PIXELS_PER_BEAT = 40;
const GUTTER = 34;
const HEADER_HEIGHT = 16;
/** Sixteenth notes. Fine enough to be expressive, coarse enough to stay tidy. */
const SNAP_BEATS = 0.25;

const HEIGHT = HEADER_HEIGHT + PITCH_COUNT * ROW_HEIGHT;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Which semitones are black keys, for shading the rows. */
const ACCIDENTAL = [false, true, false, true, false, false, true, false, true, false, true, false];

function noteName(pitch: number): string {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export interface PianoRollProps {
  track: StudioTrack;
  beatsPerBar: number;
  playheadRef: React.RefObject<number>;
  playing: boolean;
  onAddNote: (note: Omit<StudioNote, 'id'>) => void;
  onMoveNote: (noteId: string, pitch: number, startBeat: number) => void;
  onRemoveNote: (noteId: string) => void;
}

interface DragState {
  noteId: string;
  grabOffsetBeats: number;
}

export function PianoRoll({
  track,
  beatsPerBar,
  playheadRef,
  playing,
  onAddNote,
  onMoveNote,
  onRemoveNote,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragPositionRef = useRef<{ pitch: number; beat: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Length used for the next drawn note, inherited from the last one. */
  const lastLengthRef = useRef(1);

  const pitchAt = useCallback((y: number) => {
    const row = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);
    if (row < 0 || row >= PITCH_COUNT) return -1;
    // Rows are drawn high pitch at the top, which is how a piano roll reads.
    return LOW_PITCH + (PITCH_COUNT - 1 - row);
  }, []);

  const beatAt = useCallback((x: number) => Math.max(0, (x - GUTTER) / PIXELS_PER_BEAT), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      if (canvas.width !== width * ratio || canvas.height !== HEIGHT * ratio) {
        canvas.width = width * ratio;
        canvas.height = HEIGHT * ratio;
        canvas.style.height = `${HEIGHT}px`;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);

      // --- keyboard rows ---
      for (let row = 0; row < PITCH_COUNT; row += 1) {
        const pitch = LOW_PITCH + (PITCH_COUNT - 1 - row);
        const y = HEADER_HEIGHT + row * ROW_HEIGHT;
        const black = ACCIDENTAL[pitch % 12]!;
        ctx.fillStyle = black ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(GUTTER, y, width - GUTTER, ROW_HEIGHT - 1);

        // Key gutter.
        ctx.fillStyle = black ? 'rgba(20,20,28,0.95)' : 'rgba(225,225,235,0.85)';
        ctx.fillRect(0, y, GUTTER, ROW_HEIGHT - 1);
        if (pitch % 12 === 0) {
          ctx.fillStyle = 'rgba(20,20,28,0.9)';
          ctx.font = '8px ui-monospace, monospace';
          ctx.textBaseline = 'top';
          ctx.fillText(noteName(pitch), 3, y + 2);
        }
      }

      // --- beat grid ---
      const beatsVisible = (width - GUTTER) / PIXELS_PER_BEAT;
      for (let beat = 0; beat <= beatsVisible; beat += 1) {
        const x = GUTTER + beat * PIXELS_PER_BEAT;
        const isBar = beat % beatsPerBar === 0;
        ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, isBar ? 0 : HEADER_HEIGHT);
        ctx.lineTo(x + 0.5, HEIGHT);
        ctx.stroke();
        if (isBar) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '8px ui-monospace, monospace';
          ctx.fillText(String(beat / beatsPerBar + 1), x + 3, 4);
        }
      }

      // --- notes ---
      for (const note of track.notes) {
        const dragging = dragRef.current?.noteId === note.id;
        const position = dragging ? dragPositionRef.current : null;
        const pitch = position ? position.pitch : note.pitch;
        const startBeat = position
          ? Math.max(0, Math.round(position.beat / SNAP_BEATS) * SNAP_BEATS)
          : note.startBeat;
        const row = PITCH_COUNT - 1 - (pitch - LOW_PITCH);
        // A note outside the visible two octaves is simply not drawn; it still
        // plays, and clamping it into view would silently retune the part.
        if (row < 0 || row >= PITCH_COUNT) continue;

        const x = GUTTER + startBeat * PIXELS_PER_BEAT;
        const y = HEADER_HEIGHT + row * ROW_HEIGHT;
        const w = Math.max(4, note.lengthBeats * PIXELS_PER_BEAT - 1);

        ctx.globalAlpha = dragging ? 0.7 : 1;
        // Velocity reads as brightness, so a part's dynamics are visible.
        const light = 0.35 + note.velocity * 0.45;
        ctx.fillStyle =
          note.id === selectedId ? 'rgba(150,220,255,0.95)' : `rgba(110,170,235,${light})`;
        ctx.fillRect(x, y + 1, w, ROW_HEIGHT - 3);
        ctx.globalAlpha = 1;
      }

      // --- playhead ---
      if (playing) {
        const x = GUTTER + (playheadRef.current ?? 0) * PIXELS_PER_BEAT;
        if (x >= GUTTER && x <= width) {
          ctx.strokeStyle = 'rgba(255,120,120,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, HEIGHT);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [track, beatsPerBar, playing, selectedId, playheadRef]);

  const hitTest = (pitch: number, beat: number) =>
    track.notes.find(
      (note) => note.pitch === pitch && beat >= note.startBeat && beat <= note.startBeat + note.lengthBeats,
    );

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pitch = pitchAt(y);
    if (pitch === -1) return;
    const beat = beatAt(x);

    // The key gutter auditions a pitch rather than editing.
    if (x < GUTTER) return;

    const hit = hitTest(pitch, beat);
    if (hit) {
      setSelectedId(hit.id);
      lastLengthRef.current = hit.lengthBeats;
      dragRef.current = { noteId: hit.id, grabOffsetBeats: beat - hit.startBeat };
      dragPositionRef.current = { pitch, beat: hit.startBeat };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a convenience; the drag still works over the canvas.
      }
      return;
    }

    // Empty space draws a note, inheriting the last length used so a run of
    // sixteenths does not mean resizing every one.
    onAddNote({
      pitch,
      startBeat: Math.max(0, Math.round(beat / SNAP_BEATS) * SNAP_BEATS),
      lengthBeats: lastLengthRef.current,
      velocity: 0.8,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pitch = pitchAt(event.clientY - rect.top);
    if (pitch === -1) return;
    dragPositionRef.current = {
      pitch,
      beat: beatAt(event.clientX - rect.left) - dragRef.current.grabOffsetBeats,
    };
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const position = dragPositionRef.current;
    dragRef.current = null;
    dragPositionRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Already released.
    }
    if (!drag || !position) return;
    onMoveNote(drag.noteId, position.pitch, Math.max(0, position.beat));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {track.name} · notes
        </h3>
        <button
          type="button"
          onClick={() => {
            if (selectedId) onRemoveNote(selectedId);
            setSelectedId(null);
          }}
          disabled={!selectedId}
          className="border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
          data-testid="button-delete-note"
        >
          Delete note
        </button>
      </div>
      <div className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          data-testid="canvas-piano-roll"
          className="w-full min-w-[520px] cursor-crosshair rounded border border-border bg-black/40"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tap an empty row to place a note, drag to move it. Notes snap to sixteenths.
      </p>
    </div>
  );
}

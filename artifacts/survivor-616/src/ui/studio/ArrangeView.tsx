/**
 * The arrangement timeline.
 *
 * Canvas2D rather than DOM, for the same reason the game is: a few dozen clips
 * plus a playhead moving every frame is a repaint DOM does badly, and the
 * project already owns a renderer culture. It also means the playhead can be
 * driven from a ref at 60fps without React seeing it at all.
 */

import { useCallback, useEffect, useRef } from 'react';

import type { StudioProject } from '@/game/audio/studio/project';

const LANE_HEIGHT = 56;
const LANE_GAP = 6;
const HEADER_HEIGHT = 22;
const PIXELS_PER_BEAT = 26;
/** Leftmost column showing track names, outside the scrolling grid. */
const GUTTER = 96;

export interface ArrangeViewProps {
  project: StudioProject;
  /** Beats since playback started. Read per frame, never rendered by React. */
  playheadRef: React.RefObject<number>;
  playing: boolean;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onMoveClip: (clipId: string, startBeat: number, trackId: string) => void;
  /** A clip dragged in from the library, dropped on a lane. */
  onDropBuffer: (bufferId: string, trackId: string, startBeat: number) => void;
}

interface DragState {
  clipId: string;
  /** Beats between the clip's start and where the pointer grabbed it. */
  grabOffsetBeats: number;
  trackId: string;
}

export function ArrangeView({
  project,
  playheadRef,
  playing,
  selectedClipId,
  onSelectClip,
  onMoveClip,
  onDropBuffer,
}: ArrangeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Live pointer position during a drag, so the ghost follows without state. */
  const dragPositionRef = useRef<{ beat: number; laneIndex: number } | null>(null);

  const laneCount = project.tracks.length;

  const laneAt = useCallback(
    (y: number) => {
      const index = Math.floor((y - HEADER_HEIGHT) / (LANE_HEIGHT + LANE_GAP));
      return index >= 0 && index < laneCount ? index : -1;
    },
    [laneCount],
  );

  const beatAt = useCallback((x: number) => Math.max(0, (x - GUTTER) / PIXELS_PER_BEAT), []);

  /* --- drawing ------------------------------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);

      // Match the backing store to the CSS size so lines stay crisp on HiDPI.
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = HEADER_HEIGHT + laneCount * (LANE_HEIGHT + LANE_GAP);
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const beatsVisible = (width - GUTTER) / PIXELS_PER_BEAT;

      // --- bar grid ---
      ctx.font = '9px ui-monospace, monospace';
      ctx.textBaseline = 'top';
      for (let beat = 0; beat <= beatsVisible; beat += 1) {
        const x = GUTTER + beat * PIXELS_PER_BEAT;
        const isBar = beat % project.beatsPerBar === 0;
        ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, isBar ? 0 : HEADER_HEIGHT);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
        if (isBar) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillText(String(beat / project.beatsPerBar + 1), x + 3, 5);
        }
      }

      // --- lanes ---
      project.tracks.forEach((track, index) => {
        const y = HEADER_HEIGHT + index * (LANE_HEIGHT + LANE_GAP);
        ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)';
        ctx.fillRect(GUTTER, y, width - GUTTER, LANE_HEIGHT);

        // Gutter label, drawn over the grid so names stay readable.
        ctx.fillStyle = 'rgba(10,10,16,0.95)';
        ctx.fillRect(0, y, GUTTER, LANE_HEIGHT);
        ctx.fillStyle = track.muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)';
        ctx.font = '10px ui-sans-serif, system-ui';
        ctx.fillText(track.name.slice(0, 14), 8, y + LANE_HEIGHT / 2 - 5);

        for (const clip of track.clips) {
          const dragging = dragRef.current?.clipId === clip.id;
          const position = dragging ? dragPositionRef.current : null;
          const startBeat = position ? Math.max(0, Math.round(position.beat)) : clip.startBeat;
          const laneIndex = position && position.laneIndex >= 0 ? position.laneIndex : index;
          const clipY = HEADER_HEIGHT + laneIndex * (LANE_HEIGHT + LANE_GAP);
          const x = GUTTER + startBeat * PIXELS_PER_BEAT;
          const w = Math.max(8, clip.lengthBeats * PIXELS_PER_BEAT - 2);

          ctx.globalAlpha = dragging ? 0.75 : 1;
          ctx.fillStyle = clip.id === selectedClipId ? 'rgba(120,205,255,0.5)' : 'rgba(90,140,220,0.38)';
          ctx.fillRect(x, clipY + 4, w, LANE_HEIGHT - 8);
          ctx.strokeStyle = clip.id === selectedClipId ? 'rgba(160,225,255,0.95)' : 'rgba(150,190,255,0.5)';
          ctx.strokeRect(x + 0.5, clipY + 4.5, w - 1, LANE_HEIGHT - 9);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = '10px ui-sans-serif, system-ui';
          ctx.save();
          // Clip the label so a short clip does not spill its name across the
          // rest of the arrangement.
          ctx.beginPath();
          ctx.rect(x, clipY + 4, w, LANE_HEIGHT - 8);
          ctx.clip();
          ctx.fillText(clip.name, x + 5, clipY + 10);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      });

      // --- playhead ---
      if (playing) {
        const x = GUTTER + (playheadRef.current ?? 0) * PIXELS_PER_BEAT;
        if (x >= GUTTER && x <= width) {
          ctx.strokeStyle = 'rgba(255,120,120,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [project, playing, selectedClipId, laneCount, playheadRef]);

  /* --- pointer interaction ------------------------------------------ */

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const laneIndex = laneAt(y);
    if (laneIndex === -1 || x < GUTTER) {
      onSelectClip(null);
      return;
    }

    const track = project.tracks[laneIndex]!;
    const beat = beatAt(x);
    const hit = track.clips.find((clip) => beat >= clip.startBeat && beat <= clip.startBeat + clip.lengthBeats);
    if (!hit) {
      onSelectClip(null);
      return;
    }

    onSelectClip(hit.id);
    dragRef.current = { clipId: hit.id, grabOffsetBeats: beat - hit.startBeat, trackId: track.id };
    dragPositionRef.current = { beat: hit.startBeat, laneIndex };
    // Capture so a fast drag that leaves the canvas still delivers moves.
    // Best-effort: the browser rejects capture for a pointer it no longer
    // considers active, and throwing here would abort the drag entirely.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works while the pointer stays over the canvas.
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    dragPositionRef.current = {
      beat: beatAt(x) - dragRef.current.grabOffsetBeats,
      laneIndex: laneAt(y),
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
    const target = position.laneIndex >= 0 ? project.tracks[position.laneIndex]! : null;
    onMoveClip(drag.clipId, Math.max(0, position.beat), (target ?? { id: drag.trackId }).id);
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas-arrange"
      className="w-full cursor-pointer rounded border border-border bg-black/40"
      // Without this a drag scrolls the page on touch instead of moving a clip.
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const bufferId = event.dataTransfer.getData('text/studio-buffer');
        if (!bufferId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const laneIndex = laneAt(event.clientY - rect.top);
        if (laneIndex === -1) return;
        onDropBuffer(bufferId, project.tracks[laneIndex]!.id, beatAt(event.clientX - rect.left));
      }}
    />
  );
}

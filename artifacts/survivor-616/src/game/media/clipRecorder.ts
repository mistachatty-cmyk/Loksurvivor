/**
 * Rolling gameplay-clip capture for the run recap's highlight reel.
 *
 * Records the run's own canvas in short back-to-back segments (not one
 * continuous file) so a handful of them can be pulled out around highlight
 * moments -- a boss kill, a close call -- once the run ends and
 * `runHighlights.ts` knows where those moments were. Segments are complete,
 * independently playable clips (each `MediaRecorder.start()`/`stop()` cycle
 * produces its own valid header), which avoids the header/concatenation
 * problems of slicing one long recording into pieces after the fact.
 *
 * Everything here degrades to a silent no-op on an unsupported browser, a
 * revoked permission, or a mid-run recorder error -- per the additive
 * "protected baseline" rule in `docs/studio-remotion-architecture.md`, a
 * player who can't capture clips still gets the complete stat recap, just
 * without the highlight reel's real footage.
 */
import { saveMediaAsset } from '@/game/audio/localMediaStore';

const SEGMENT_MS = 3000;
const MAX_SEGMENTS = 12; // ~36s ring buffer, bounded so memory doesn't grow over a long endless run.
const MAX_CLIPS = 6; // matches MAX_HIGHLIGHTS in runHighlights.ts
const CLIP_PAD_BEFORE_MS = 1000;
const CLIP_PAD_AFTER_MS = 2000;
const CAPTURE_FPS = 20;
const CAPTURE_BITS_PER_SECOND = 1_500_000;

interface Segment {
  startMs: number;
  endMs: number;
  blob: Blob;
}

interface PendingClip {
  kind: string;
  atMs: number;
  label: string;
}

export interface CapturedHighlightClip {
  kind: string;
  atMs: number;
  label: string;
  assetId: string;
}

function pickMimeType(): string | undefined {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

export function isClipCaptureSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder === 'function'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export function createClipRecorder(getCanvas: () => HTMLCanvasElement | null) {
  const segments: Segment[] = [];
  const pending: PendingClip[] = [];
  const requested = new Set<string>();
  let mimeType: string | undefined;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let segmentStartMs = 0;
  let segmentChunks: BlobPart[] = [];
  let supported = isClipCaptureSupported();
  let started = false;

  function startSegment(nowMs: number) {
    if (!supported || !stream) return;
    segmentChunks = [];
    segmentStartMs = nowMs;
    try {
      recorder = new MediaRecorder(stream, mimeType
        ? { mimeType, videoBitsPerSecond: CAPTURE_BITS_PER_SECOND }
        : undefined);
    } catch {
      supported = false;
      return;
    }
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) segmentChunks.push(event.data);
    };
    recorder.onerror = () => {
      supported = false;
    };
    try {
      recorder.start();
    } catch {
      supported = false;
    }
  }

  function finishSegment(nowMs: number) {
    if (!recorder) return;
    const chunks = segmentChunks;
    const startMs = segmentStartMs;
    try {
      recorder.stop();
    } catch {
      // Already stopped/errored -- nothing to salvage.
    }
    recorder = null;
    if (chunks.length === 0) return;
    segments.push({ startMs, endMs: nowMs, blob: new Blob(chunks, { type: mimeType ?? 'video/webm' }) });
    if (segments.length > MAX_SEGMENTS) segments.shift();
  }

  /** Call once, as soon as the run's canvas exists. */
  function start(nowMs: number) {
    if (started || !supported) return;
    const canvas = getCanvas();
    if (!canvas) return;
    try {
      stream = canvas.captureStream(CAPTURE_FPS);
    } catch {
      supported = false;
      return;
    }
    mimeType = pickMimeType();
    started = true;
    startSegment(nowMs);
  }

  /** Call once per rendered frame with `world.now` to rotate segments. */
  function tick(nowMs: number) {
    if (!supported || !started) return;
    if (nowMs - segmentStartMs >= SEGMENT_MS) {
      finishSegment(nowMs);
      startSegment(nowMs);
    }
  }

  /** Call whenever `runHighlights` reports a newly detected highlight. */
  function requestClip(kind: string, atMs: number, label: string) {
    if (!supported) return;
    const key = `${kind}:${atMs}`;
    if (requested.has(key)) return;
    requested.add(key);
    pending.push({ kind, atMs, label });
  }

  function bestSegmentFor(atMs: number): Segment | null {
    const windowStart = atMs - CLIP_PAD_BEFORE_MS;
    const windowEnd = atMs + CLIP_PAD_AFTER_MS;
    let best: Segment | null = null;
    let bestOverlap = 0;
    for (const segment of segments) {
      const overlap = Math.min(segment.endMs, windowEnd) - Math.max(segment.startMs, windowStart);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = segment;
      }
    }
    return best;
  }

  /**
   * Stop capturing and resolve the queued highlight moments to saved local
   * clips. Content-addressed storage (`saveMediaAsset`) means two highlights
   * that land in the same segment just share one saved clip.
   */
  async function finalize(nowMs: number): Promise<CapturedHighlightClip[]> {
    if (!supported || !started) return [];
    finishSegment(nowMs);
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    started = false;

    const results: CapturedHighlightClip[] = [];
    for (const clip of pending.slice(-MAX_CLIPS)) {
      const segment = bestSegmentFor(clip.atMs);
      if (!segment) continue;
      try {
        const record = await saveMediaAsset(segment.blob, {
          fileName: `highlight-${clip.kind}-${clip.atMs}.webm`,
          kind: 'video',
        });
        results.push({ kind: clip.kind, atMs: clip.atMs, label: clip.label, assetId: record.id });
      } catch {
        // Device storage full/unavailable -- skip this one clip, keep the rest.
      }
    }
    return results;
  }

  return { start, tick, requestClip, finalize };
}

export type ClipRecorder = ReturnType<typeof createClipRecorder>;

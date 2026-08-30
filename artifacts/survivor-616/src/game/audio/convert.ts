/**
 * Client-side MP4/MOV/WebM -> MP3 conversion.
 *
 * Runs entirely in the browser -- the file never leaves the device, matching
 * the guarantee the rest of the soundtrack player makes. Decoding reuses the
 * same `decodeAudioData` the studio's importer relies on: browsers demux
 * whatever container they're handed and return raw PCM regardless of
 * whether the source was an audio or video file, so no separate "strip the
 * video track" step is needed. `@breezystack/lamejs` then encodes that PCM
 * to an actual .mp3 Blob.
 *
 * The encoder is dynamically imported so it never lands in the bundle for
 * players who never convert anything.
 */

export class ConversionError extends Error {}

export interface ConversionProgress {
  phase: 'decoding' | 'encoding';
  /** 0..1, best-effort. */
  ratio: number;
}

const MP3_KBPS = 160;
/** One MP3 frame's worth of samples per encoder call. */
const ENCODE_CHUNK_SAMPLES = 1152;
/** How many chunks to encode between yields back to the event loop. */
const YIELD_EVERY_CHUNKS = 200;

/**
 * Decodes `file` with the app's single `AudioContext` and re-encodes it as
 * MP3. `context` is passed in rather than created here for the same reason
 * `importAudioFile` takes one: a context per conversion leaks one per file
 * and risks iOS suspending the context actually driving playback.
 */
export async function convertToMp3(
  file: File,
  context: BaseAudioContext,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(arrayBuffer);
  } catch {
    throw new ConversionError(
      `Could not decode "${file.name}". The file may be damaged or in a codec this browser can't read.`,
    );
  }
  onProgress?.({ phase: 'decoding', ratio: 1 });

  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channels = Math.min(2, buffer.numberOfChannels) as 1 | 2;
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, MP3_KBPS);

  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPCM(buffer.getChannelData(1)) : null;
  const totalSamples = left.length;

  const chunks: Uint8Array[] = [];
  for (let i = 0, chunkCount = 0; i < totalSamples; i += ENCODE_CHUNK_SAMPLES, chunkCount += 1) {
    const leftChunk = left.subarray(i, i + ENCODE_CHUNK_SAMPLES);
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + ENCODE_CHUNK_SAMPLES))
      : encoder.encodeBuffer(leftChunk);
    if (encoded.length > 0) chunks.push(encoded);

    if (chunkCount % YIELD_EVERY_CHUNKS === 0) {
      onProgress?.({ phase: 'encoding', ratio: Math.min(1, i / totalSamples) });
      // A multi-minute file is tens of thousands of chunks -- yield
      // periodically so encoding doesn't freeze the tab.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);
  onProgress?.({ phase: 'encoding', ratio: 1 });

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

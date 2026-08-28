/**
 * Exports from the studio: rendered audio as WAV, and projects as .616song JSON.
 *
 * WAV rendering uses Tone.Offline for deterministic, sample-accurate output
 * (faster than realtime, no codec surprises). Hand-rolled RIFF encoder
 * avoids a dependency.
 *
 * Projects export as .616song (plain JSON) for shareable remixes.
 */

import * as Tone from 'tone';
import type { StudioProject } from './project';
import { serializeProject } from './project';

/**
 * Render the current studio graph over the given duration and export as WAV.
 * `durationSeconds` should be derived from `projectLengthBeats(project)` and tempo.
 */
export async function renderStudioToWav(durationSeconds: number): Promise<Blob> {
  const context = new OfflineAudioContext(2, durationSeconds * 44100, 44100);

  // Tone must render into the offline context
  const prevContext = Tone.getContext();
  Tone.setContext(new Tone.Context({ context }));

  try {
    // Render the transport state
    Tone.Transport.start(0);
    const renderedBuffer = await context.startRendering();
    const wav = encodeWav(renderedBuffer);
    return new Blob([wav], { type: 'audio/wav' });
  } finally {
    Tone.setContext(prevContext);
  }
}

/**
 * Encodes an AudioBuffer as 16-bit PCM RIFF WAV.
 * ~60 lines, no external codec — suitable for offline render.
 */
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const channelCount = buffer.numberOfChannels;
  const sampleCount = buffer.length;
  const bytesPerSample = 2; // 16-bit

  // Extract and interleave channels, clamping to 16-bit range
  const pcmData = new Int16Array(sampleCount * channelCount);
  let pcmIndex = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    for (let ch = 0; ch < channelCount; ch += 1) {
      const sample = buffer.getChannelData(ch)[i] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcmData[pcmIndex] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      pcmIndex += 1;
    }
  }

  const pcmBytes = new Uint8Array(pcmData.buffer);
  const dataSize = pcmBytes.length;
  const riffSize = 36 + dataSize;

  // Build RIFF header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // "RIFF"
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  // File size - 8
  view.setUint32(4, riffSize, true);
  // "WAVE"
  view.setUint8(8, 0x57); // W
  view.setUint8(9, 0x41); // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // "fmt " subchunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  // Subchunk1Size (16 for PCM)
  view.setUint32(16, 16, true);
  // AudioFormat (1 for PCM)
  view.setUint16(20, 1, true);
  // NumChannels
  view.setUint16(22, channelCount, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  // BlockAlign
  view.setUint16(32, channelCount * bytesPerSample, true);
  // BitsPerSample (16)
  view.setUint16(34, 16, true);

  // "data" subchunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  // Subchunk2Size
  view.setUint32(40, dataSize, true);

  // Concatenate header + PCM data
  const result = new Uint8Array(header.byteLength + pcmBytes.length);
  result.set(new Uint8Array(header), 0);
  result.set(pcmBytes, header.byteLength);

  return result.buffer;
}

/**
 * Export a project as .616song JSON.
 * Suitable for upload to cloud storage or direct sharing.
 */
export function exportProject(project: StudioProject): Blob {
  const json = serializeProject(project);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Trigger a browser download of a Blob with the given filename.
 * Works in all browsers; the user selects a save location or uses defaults.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a .616song JSON file and parse it back into a StudioProject.
 * Uses the same sanitization as loadStoredProject so it handles untrusted data.
 */
export async function importProjectFile(file: File): Promise<StudioProject> {
  const { parseProject } = await import('./project');
  const json = await file.text();
  const data = JSON.parse(json) as unknown;
  return parseProject(data);
}

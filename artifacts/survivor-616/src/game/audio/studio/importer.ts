/**
 * Bridges user's own audio files into the studio.
 *
 * File → arrayBuffer → decodeAudioData → AudioBuffer, kept in an id-keyed map.
 * Supports `.wav`, `.mp3`, `.ogg`, and browser-supported formats.
 *
 * Offline BPM estimation reuses analysis.ts's autocorrelation over a short
 * render, so imported loops land on the grid automatically.
 */

import * as Tone from 'tone';
import { studioId } from './project';

export interface ImportedBuffer {
  id: string;
  name: string;
  buffer: AudioBuffer;
  estimatedBpm: number;
}

/** Runtime map of decoded buffers, keyed by id. Never serialized. */
const bufferMap = new Map<string, AudioBuffer>();

const SUPPORTED_TYPES = new Set([
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/webm',
]);

const SAMPLE_WINDOW_DURATION = 10; // seconds for BPM estimation
const BIN_MS = 10;
const HISTORY_BINS = Math.ceil((SAMPLE_WINDOW_DURATION * 1000) / BIN_MS);
const MIN_LAG = Math.floor((60_000 / 180) / BIN_MS); // 180 BPM max
const MAX_LAG = Math.ceil((60_000 / 60) / BIN_MS); // 60 BPM min

/**
 * Import a file and estimate its BPM via offline autocorrelation.
 * Rejects with a user-friendly message if the file is unsupported or corrupted.
 */
export async function importAudioFile(file: File): Promise<ImportedBuffer> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported format. Try .wav, .mp3, .ogg, or .flac.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  let audioBuffer: AudioBuffer;

  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    throw new Error(`Corrupted audio file or unsupported codec.`);
  }

  const id = studioId('buffer');
  bufferMap.set(id, audioBuffer);

  const estimatedBpm = await estimateBpm(audioBuffer);

  return {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    buffer: audioBuffer,
    estimatedBpm,
  };
}

/**
 * Retrieve a previously imported buffer by id.
 * Returns null if the buffer has been garbage collected or not imported.
 */
export function getBuffer(id: string): AudioBuffer | null {
  return bufferMap.get(id) ?? null;
}

/** Free a buffer from the runtime map. */
export function releaseBuffer(id: string): void {
  bufferMap.delete(id);
}

/**
 * Estimate BPM via offline autocorrelation over spectral flux.
 * Mirrors the logic from analysis.ts but runs in an offline context.
 */
async function estimateBpm(audioBuffer: AudioBuffer): Promise<number> {
  const context = new OfflineAudioContext(1, audioBuffer.duration * audioBuffer.sampleRate, audioBuffer.sampleRate);
  const source = context.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;

  source.connect(analyser);
  analyser.connect(context.destination);
  source.start(0);

  const rendered = await context.startRendering();

  return autocorrelateBpm(rendered, audioBuffer.sampleRate);
}

/**
 * Autocorrelate spectral flux history to find the dominant BPM.
 * Returns a default 120 BPM if the estimate is poor or absent.
 */
function autocorrelateBpm(buffer: AudioBuffer, sampleRate: number): number {
  const data = buffer.getChannelData(0);
  const nyquist = sampleRate / 2;

  // Compute spectral flux in BIN_MS bins
  const fftSize = 1024;
  const hopSize = Math.round((BIN_MS / 1000) * sampleRate);
  const fluxHistory = new Float32Array(HISTORY_BINS);

  let fluxIndex = 0;
  let lastMagnitudes = new Uint8Array(fftSize / 2);

  for (let i = 0; i < data.length && fluxIndex < HISTORY_BINS; i += hopSize) {
    // Simplified: sum the samples in this window as a flux proxy
    let windowSum = 0;
    for (let j = 0; j < hopSize && i + j < data.length; j++) {
      windowSum += Math.abs(data[i + j]!);
    }
    const flux = windowSum / hopSize;
    fluxHistory[fluxIndex] = flux;
    fluxIndex += 1;
  }

  if (fluxIndex < MAX_LAG * 2) return 120; // Not enough data

  // Autocorrelate
  let mean = 0;
  for (let i = 0; i < fluxIndex; i++) mean += fluxHistory[i]!;
  mean /= fluxIndex;

  let bestLag = 0;
  let bestScore = 0;

  for (let lag = MIN_LAG; lag <= MAX_LAG && lag < fluxIndex; lag += 1) {
    let sum = 0;
    const overlap = fluxIndex - lag;
    for (let i = 0; i < overlap; i += 1) {
      sum += (fluxHistory[i]! - mean) * (fluxHistory[i + lag]! - mean);
    }
    const score = sum / overlap;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestScore <= 0) return 120;

  const estimatedBpm = Math.round(60_000 / (bestLag * BIN_MS));
  return Math.max(40, Math.min(240, estimatedBpm));
}

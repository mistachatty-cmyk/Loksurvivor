/**
 * The BandLab bridge: the player's own audio files into the studio.
 *
 * There is no third-party catalog and nothing is uploaded -- a stem gets here
 * by being exported from wherever it was made and dropped on the window, which
 * is the same guarantee the soundtrack player makes.
 *
 * Decoded buffers live in a runtime map keyed by id and are deliberately never
 * serialised: a project references the player's files, it does not carry them.
 * A project reloaded in a fresh session therefore has clips whose buffers are
 * missing, which the graph handles by skipping them rather than failing.
 */

import { studioId } from './project';

export interface ImportedBuffer {
  id: string;
  name: string;
  buffer: AudioBuffer;
  /** Best-effort tempo of the file itself, for snapping a loop to the grid. */
  estimatedBpm: number;
  /** 0..1 confidence in `estimatedBpm`; low means "we guessed 120". */
  bpmConfidence: number;
}

/** Runtime buffer store. Keyed by the id clips reference. */
const bufferMap = new Map<string, AudioBuffer>();

/** Matches `musicPlayer.tsx` -- dragged files often have an empty `type`. */
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i;

/* --- tempo estimation ------------------------------------------------ */

/** Envelope resolution. 10ms matches `analysis.ts` so the two agree. */
const BIN_MS = 10;
const MIN_BPM = 60;
const MAX_BPM = 180;
const MIN_LAG = Math.floor(60_000 / MAX_BPM / BIN_MS);
const MAX_LAG = Math.ceil(60_000 / MIN_BPM / BIN_MS);
/** Analysing more than this is slower without being more accurate. */
const MAX_ANALYSIS_SECONDS = 30;
const DEFAULT_BPM = 120;

export class ImportError extends Error {}

/**
 * Decodes one file and estimates its tempo.
 *
 * `context` is the app's single `AudioContext`, passed in rather than created:
 * a context per import would leak one per dropped file and, on iOS, risk the
 * browser suspending the one actually playing.
 */
export async function importAudioFile(file: File, context: BaseAudioContext): Promise<ImportedBuffer> {
  if (!file.type.startsWith('audio/') && !AUDIO_EXTENSIONS.test(file.name)) {
    throw new ImportError(`${file.name} is not an audio file. Try .wav, .mp3, .m4a, .ogg or .flac.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(arrayBuffer);
  } catch {
    // Decoding fails for a genuinely corrupt file and for a codec this browser
    // does not carry; the player cannot tell those apart and neither can we.
    throw new ImportError(`Could not decode ${file.name}. The file may be damaged or in an unsupported codec.`);
  }

  const { bpm, confidence } = estimateBufferBpm(buffer);
  const id = studioId('buffer');
  bufferMap.set(id, buffer);

  return {
    id,
    name: file.name.replace(AUDIO_EXTENSIONS, '').replace(/[_-]+/g, ' ').trim() || file.name,
    buffer,
    estimatedBpm: bpm,
    bpmConfidence: confidence,
  };
}

export function getBuffer(id: string): AudioBuffer | null {
  return bufferMap.get(id) ?? null;
}

export function releaseBuffer(id: string): void {
  bufferMap.delete(id);
}

/** Ids of every buffer currently held, for the clip library. */
export function loadedBufferIds(): string[] {
  return [...bufferMap.keys()];
}

export function clearBuffers(): void {
  bufferMap.clear();
}

/**
 * Estimates tempo from a decoded buffer by autocorrelating its onset envelope.
 *
 * This is the offline sibling of `analysis.ts`'s live estimator and runs the
 * same way: build a coarse amplitude envelope, half-wave rectify its
 * derivative so only *rises* count (a note starting is a beat; a note ending is
 * not), then look for the lag that best correlates with itself.
 *
 * Synchronous and on the main thread by choice -- 30 seconds of envelope is
 * ~3000 bins, which autocorrelates in single-digit milliseconds, and a worker
 * would cost more in ceremony than it saves.
 */
export function estimateBufferBpm(buffer: AudioBuffer): { bpm: number; confidence: number } {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const binSamples = Math.max(1, Math.round((BIN_MS / 1000) * sampleRate));
  const analysed = Math.min(samples.length, Math.floor(MAX_ANALYSIS_SECONDS * sampleRate));
  const binCount = Math.floor(analysed / binSamples);

  // Two full cycles of the slowest tempo, or there is nothing to correlate.
  if (binCount < MAX_LAG * 2) return { bpm: DEFAULT_BPM, confidence: 0 };

  // RMS envelope.
  const envelope = new Float32Array(binCount);
  for (let bin = 0; bin < binCount; bin += 1) {
    const from = bin * binSamples;
    let sum = 0;
    for (let i = from; i < from + binSamples; i += 1) sum += samples[i]! * samples[i]!;
    envelope[bin] = Math.sqrt(sum / binSamples);
  }

  // Rising-edge flux: what makes a beat audible is the attack.
  const flux = new Float32Array(binCount);
  for (let bin = 1; bin < binCount; bin += 1) {
    const delta = envelope[bin]! - envelope[bin - 1]!;
    flux[bin] = delta > 0 ? delta : 0;
  }

  let mean = 0;
  for (let i = 0; i < binCount; i += 1) mean += flux[i]!;
  mean /= binCount;

  let bestLag = 0;
  let bestScore = 0;
  let totalScore = 0;
  let scored = 0;
  const scores = new Map<number, number>();

  for (let lag = MIN_LAG; lag <= MAX_LAG && lag < binCount; lag += 1) {
    let sum = 0;
    const overlap = binCount - lag;
    for (let i = 0; i < overlap; i += 1) sum += (flux[i]! - mean) * (flux[i + lag]! - mean);
    const score = sum / overlap;
    scores.set(lag, score);
    totalScore += Math.max(0, score);
    scored += 1;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestScore <= 0) return { bpm: DEFAULT_BPM, confidence: 0 };

  // Octave correction: half and double tempo correlate nearly as well, so
  // prefer whichever lands closest to a danceable 120 -- the same tie-break
  // `analysis.ts` makes, so live and offline estimates agree on one file.
  let chosenLag = bestLag;
  for (const candidate of [bestLag * 2, Math.round(bestLag / 2)]) {
    if (candidate < MIN_LAG || candidate > MAX_LAG) continue;
    const score = scores.get(candidate);
    if (score === undefined || score < bestScore * 0.8) continue;
    const candidateBpm = 60_000 / (candidate * BIN_MS);
    const chosenBpm = 60_000 / (chosenLag * BIN_MS);
    if (Math.abs(candidateBpm - 120) < Math.abs(chosenBpm - 120)) chosenLag = candidate;
  }

  const meanScore = totalScore / Math.max(1, scored);
  const peakRatio = meanScore > 0 ? bestScore / meanScore : 0;
  const confidence = Math.max(0, Math.min(1, (peakRatio - 1) / 3));

  return { bpm: Math.round(60_000 / (chosenLag * BIN_MS)), confidence };
}

/**
 * How many beats a buffer occupies at the project tempo, rounded to a sensible
 * musical length so a dropped loop lands on the grid instead of ending a
 * fraction of a beat late.
 */
export function clipLengthInBeats(buffer: AudioBuffer, projectBpm: number): number {
  const raw = (buffer.duration * projectBpm) / 60;
  if (raw <= 0) return 4;
  // Snap to a bar when within 12% of one; loops are the common case and a bar
  // is what a loop almost always is.
  const bars = raw / 4;
  const nearestBar = Math.round(bars);
  if (nearestBar >= 1 && Math.abs(bars - nearestBar) / nearestBar < 0.12) return nearestBar * 4;
  return Math.max(1, Math.round(raw));
}
